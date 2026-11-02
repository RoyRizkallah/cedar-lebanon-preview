// Sample programs: two built by the therapists, with residents on them.
import { addDays } from './dates.js';

export function seedPrograms(state, today) {
  const s = (day, time, minutes, kind, title, leader) => ({ day, time, minutes, kind, title, leader });
  state.programs.push(
    {
      id: 'PRG-0001', name: 'Foundations: first 28 days', focus: 'Stabilise, build routine and name the patterns behind use.', weeks: 4, status: 'Active',
      goals: ['Keep a daily routine for two weeks', 'Name three personal triggers', 'Write a first relapse-prevention plan'],
      createdBy: 'clinical-director', createdAt: `${addDays(today, -40)}T09:00:00.000Z`,
      sessions: [
        s('Mon', '08:30', 45, 'Fitness', 'Morning walk', 'john'), s('Mon', '10:00', 60, 'Group', 'Process group', 'clinical-director'), s('Mon', '15:00', 50, 'Individual', 'Individual therapy', 'nabila'),
        s('Tue', '10:00', 60, 'Psychoeducation', 'How addiction works', 'clinical-director'), s('Tue', '16:00', 60, 'Fitness', 'Movement & yoga', 'zeina'),
        s('Wed', '10:00', 60, 'Group', 'Process group', 'clinical-director'), s('Wed', '15:00', 60, 'Drama therapy', 'Role play: saying no', 'nazha'),
        s('Thu', '10:00', 60, 'Mindfulness', 'Urge surfing', 'nabila'), s('Thu', '15:00', 50, 'Individual', 'Individual therapy', 'nabila'),
        s('Fri', '10:00', 60, 'Group', 'Relapse prevention', 'clinical-director'), s('Fri', '16:00', 60, 'Fitness', 'Boxing basics', 'raymond'),
        s('Sat', '11:00', 90, 'Family', 'Family session', 'clinical-director')
      ].map((item, index) => ({ ...item, id: `PRG-0001-S-${index + 1}` }))
    },
    {
      id: 'PRG-0002', name: 'Expression & reconnection', focus: 'Drama and movement work for residents who find talking hard.', weeks: 3, status: 'Active',
      goals: ['Take part in every drama session', 'Rebuild one family relationship'],
      createdBy: 'nazha', createdAt: `${addDays(today, -20)}T11:00:00.000Z`,
      sessions: [
        s('Mon', '15:00', 60, 'Drama therapy', 'Warm-up and story', 'nazha'), s('Tue', '10:00', 60, 'Group', 'Process group', 'clinical-director'),
        s('Wed', '15:00', 60, 'Drama therapy', 'Playback theatre', 'nazha'), s('Thu', '16:00', 60, 'Fitness', 'Tennis', 'tony-j'),
        s('Fri', '15:00', 60, 'Drama therapy', 'Letters not sent', 'nazha'), s('Sat', '11:00', 90, 'Family', 'Family session', 'clinical-director')
      ].map((item, index) => ({ ...item, id: `PRG-0002-S-${index + 1}` }))
    }
  );
  const residents = state.patients.filter(patient => patient.status === 'Admitted' && patient.program !== 'Outpatient');
  residents.slice(0, 5).forEach((patient, index) => {
    const programId = index < 3 ? 'PRG-0001' : 'PRG-0002';
    const weeks = programId === 'PRG-0001' ? 4 : 3;
    const start = patient.admittedAt > addDays(today, -14) ? patient.admittedAt : addDays(today, -7 * (index + 1));
    state.programAssignments.push({ id: `PA-${String(index + 1).padStart(4, '0')}`, programId, patientId: patient.id, start, end: addDays(start, weeks * 7), status: 'Active', by: programId === 'PRG-0001' ? 'clinical-director' : 'nazha', at: `${start}T09:00:00.000Z` });
  });
}
