// A form field: the tag on the paper form becomes `type` here.
// text | notes | date | time | number | one | all | lmh | scale5 | auto | signature | photo | table
export const field = (id, label, type, extra = {}) => ({ id, label, type, ...extra });

export const LEVELS = ['Not cleared', 'Low', 'Moderate', 'High'];
export const YES_NO = ['Yes', 'No'];
export const ACTIVITIES = ['Gym', 'Tennis', 'MMA / boxing', 'Movement / yoga', 'Physio'];
