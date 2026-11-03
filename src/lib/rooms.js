// Rooms and beds: who is in each bed, what is held for an admission, and whether the room is ready.
import { daysBetween, todayISO } from './dates.js';
import { isActive } from './admission.js';
import { log } from './activity.js';
import { canDo } from './people.js';
import { plannedDischarge } from './discharge.js';

export const ROOM_STATUSES = ['Ready', 'Cleaning', 'Maintenance'];
export const WINGS = ['Ground', 'Upper'];
const allowed = staffId => { if (!canDo(staffId, 'manageRooms')) throw new Error('Rooms are managed by Mazen, Melyssa or the partners.'); };
const occupants = (state, roomId) => state.patients.filter(patient => patient.status === 'Admitted' && patient.roomId === roomId);
// Beds promised to an admission in progress count as taken for any change to the room.
const held = (state, roomId) => state.onboardings.filter(item => isActive(state, item) && item.steps.room?.done && item.steps.room.roomId === roomId);
const heldFor = (state, item) => state.inquiries.find(entry => entry.id === item.inquiryId)?.name || 'an admission';
function guardHeld(state, roomId, beds = 0) {
  const hold = held(state, roomId).find(item => item.steps.room.bed > beds);
  if (hold) throw new Error(`Room ${roomId}, bed ${hold.steps.room.bed} is held for ${heldFor(state, hold)}.`);
}
const find = (state, id) => { const room = state.rooms.find(item => item.id === id); if (!room) throw new Error('This room was not found.'); return room; };

export function roomBoard(state, now = new Date()) {
  const today = todayISO(now);
  return state.rooms.map(room => {
    const beds = Array.from({ length: room.beds }, (_, index) => {
      const bed = index + 1;
      const patient = occupants(state, room.id).find(item => item.bed === bed);
      const hold = state.onboardings.find(item => isActive(state, item) && item.steps.room.done && item.steps.room.roomId === room.id && item.steps.room.bed === bed);
      const planned = patient && plannedDischarge(state, patient.id);
      return { bed, patient: patient || null, heldFor: hold ? state.inquiries.find(item => item.id === hold.inquiryId)?.name : null, day: patient ? daysBetween(patient.admittedAt, today) + 1 : null, plannedDischarge: planned || null };
    });
    return { ...room, status: room.status || 'Ready', beds, free: beds.filter(bed => !bed.patient && !bed.heldFor).length };
  });
}

export function setRoomStatus(state, roomId, status, staffId) {
  allowed(staffId);
  const room = find(state, roomId);
  if (!ROOM_STATUSES.includes(status)) throw new Error('Choose Ready, Cleaning or Maintenance.');
  if (status === 'Maintenance' && occupants(state, roomId).length) throw new Error(`Room ${roomId} has patients in it.`);
  if (status === 'Maintenance') guardHeld(state, roomId);
  room.status = status;
  log(state, staffId, `Room ${roomId} set to ${status}`, '#/rooms');
  return room;
}

export function addRoom(state, { id, wing = 'Ground', beds = 2, access = 'Standard', notes = '' }, staffId) {
  allowed(staffId);
  const code = String(id || '').trim();
  if (!code) throw new Error('Give the room a number.');
  if (state.rooms.some(room => room.id === code)) throw new Error(`Room ${code} already exists.`);
  const count = Number(beds);
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('A room has 1 to 4 beds.');
  const room = { id: code, name: `Room ${code}`, wing, beds: count, access, notes: String(notes).trim(), status: 'Ready' };
  state.rooms.push(room);
  log(state, staffId, `Added room ${code}`, '#/rooms');
  return room;
}

export function updateRoom(state, roomId, patch, staffId) {
  allowed(staffId);
  const room = find(state, roomId);
  const next = { ...room, ...patch };
  next.beds = Number(next.beds);
  if (!Number.isInteger(next.beds) || next.beds < 1 || next.beds > 4) throw new Error('A room has at least 1 bed and at most 4.');
  if (occupants(state, roomId).some(patient => patient.bed > next.beds)) throw new Error(`Room ${roomId} has a patient in a bed you are removing; it is occupied.`);
  guardHeld(state, roomId, next.beds);
  Object.assign(room, { wing: next.wing, beds: next.beds, access: next.access, notes: String(next.notes || '').trim() });
  log(state, staffId, `Updated room ${roomId}`, '#/rooms');
  return room;
}

export function removeRoom(state, roomId, staffId) {
  allowed(staffId);
  find(state, roomId);
  if (occupants(state, roomId).length) throw new Error(`Room ${roomId} has patients in it.`);
  guardHeld(state, roomId);
  state.rooms = state.rooms.filter(room => room.id !== roomId);
  log(state, staffId, `Removed room ${roomId}`, '#/rooms');
}
