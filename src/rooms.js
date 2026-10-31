export function roomCapacity(rooms) {
  return rooms.reduce((total, room) => total + room.beds.length, 0);
}

export function roomLabel(room) {
  return room.beds.length === 1 ? 'Single room' : 'Twin room';
}

export function nextRoomNumber(rooms, wing = 'A') {
  const numbers = rooms.filter(room => room.id.startsWith(wing + '-')).map(room => Number(room.id.split('-')[1]) || 0);
  return String(Math.max(0, ...numbers) + 1).padStart(2, '0');
}

export function saveRoomRecord(data, draft, editingId = '') {
  const wing = String(draft.wing || '').toUpperCase();
  const number = Number(draft.roomNumber);
  const count = Number(draft.bedCount);
  const status = draft.status || 'Preparing';
  const access = draft.access || 'Standard';
  const notes = String(draft.notes || '').trim();
  if (!['A', 'B'].includes(wing) || !Number.isInteger(number) || number < 1 || number > 99)
    return { error: 'Choose a wing and a room number from 01 to 99.' };
  if (![1, 2].includes(count)) return { error: 'Choose a single or twin room.' };
  if (!['Ready', 'Preparing', 'Maintenance'].includes(status)) return { error: 'Choose a valid readiness status.' };
  if (!['Standard', 'Step-free'].includes(access)) return { error: 'Choose a valid access type.' };
  if (notes.length > 240) return { error: 'Keep room notes under 240 characters.' };
  const id = wing + '-' + String(number).padStart(2, '0');
  if (data.rooms.some(room => room.id === id && room.id !== editingId)) return { error: id + ' already exists. Choose another number.' };
  const existing = editingId ? data.rooms.find(room => room.id === editingId) : null;
  if (editingId && !existing) return { error: 'This room no longer exists.' };
  if (existing && count < existing.beds.length && existing.beds.slice(count).some(Boolean))
    return { error: 'Release the occupied bed before reducing this room’s capacity.' };
  if (status === 'Maintenance' && existing?.beds.some(Boolean))
    return { error: 'Release occupied beds before marking a room for maintenance.' };
  const beds = existing ? Array.from({ length: count }, (_, index) => existing.beds[index] || null) : Array(count).fill(null);
  const record = { ...existing, id, status, beds, access, notes };
  if (existing) Object.assign(existing, record);
  else data.rooms.push(record);
  if (existing && editingId !== id) data.patients.forEach(patient => { if (patient.room === editingId) patient.room = id; });
  data.rooms.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { room: record, created: !existing };
}

export function removeRoomRecord(data, id) {
  const room = data.rooms.find(item => item.id === id);
  if (!room) return { error: 'This room no longer exists.' };
  if (room.beds.some(Boolean)) return { error: 'Release all beds before removing this room.' };
  data.rooms = data.rooms.filter(item => item.id !== id);
  return { room };
}
