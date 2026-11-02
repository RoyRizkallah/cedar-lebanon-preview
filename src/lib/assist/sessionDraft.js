// Cedar Assist preview: turns a clinician's spoken or typed words into a draft Individual Session Note.
// Runs entirely in the browser. The clinician reviews every field and signs; nothing is filed automatically.

const RISKS = [
  ['Self-harm', /self[- ]?harm|suicid|kill (?:him|her|them)?self|end (?:his|her|their) life|hurt (?:him|her|them)self|cutting|انتحار|إيذاء النفس|ايذاء النفس|automutil|se faire du mal/i],
  ['Absconding', /run(?:ning)? away|abscond|escape|walk(?:ed)? out|leave the (?:cent(?:er|re)|program(?:me)?)|wants? to (?:leave|go home)|يهرب|الهروب|fugue|s['’]enfuir|quitter le centre/i],
  ['Aggression', /aggress|threat|shout|yell|fight|punch|violen|عدوان|عنف|صراخ|agressi|menac/i],
  ['Relapse / craving', /crav|urge(?!\s*surf)|relapse|used again|using again|slipped|انتكاس|رغبة|rechute|envie de (?:boire|consommer)/i]
];
const NEGATION = /(?:^|[\s,;])(?:no|not|denies|denied|deny|without|never|nor|لا|لم|ليس|بدون|pas de|aucune?|sans|nie)(?=[\s,;]|$)/i;
const MEDICAL = /medic|withdrawal|pain|dose|vomit|seizure|tremor|sweat|blood pressure|fever|انسحاب|ألم|دواء|sevrage|douleur|médic/i;
const PLAN = /\b(?:next|plan|homework|will|practi[cs]e|goal|follow[- ]?up)\b|الجلسة القادمة|prochaine/i;
const ONLY_ATTENDANCE = /^(?:attended|present|came|حضر|présent)\.?$/i;

const sentences = text => String(text || '').split(/(?<=[.!?؟])\s+|\n+/).map(part => part.trim()).filter(Boolean);

// A mention counts unless a negation sits just before it in the same sentence ("denies self-harm", "no cravings").
function mentions(sentence, pattern) {
  const match = sentence.match(pattern);
  if (!match) return false;
  const before = sentence.slice(Math.max(0, match.index - 30), match.index);
  return !NEGATION.test(before);
}

function attendanceOf(text) {
  if (!text.trim()) return undefined;
  if (/refus|declin|did(?:n't| not) (?:attend|come)|no[- ]show|رفض|a refusé/i.test(text)) return 'Refused';
  if (/reschedul|moved to|postpon|بدل|reporté/i.test(text)) return 'Rescheduled';
  return 'Attended';
}

export function draftSessionNote(text) {
  const parts = sentences(text);
  const riskFlags = RISKS.filter(([, pattern]) => parts.some(sentence => mentions(sentence, pattern))).map(([flag]) => flag);
  const flagged = riskFlags.length > 0;
  const values = {
    attendance: attendanceOf(String(text || '')),
    themes: parts.filter(sentence => !PLAN.test(sentence) && !ONLY_ATTENDANCE.test(sentence)).slice(0, 3).join(' '),
    riskFlags: parts.length ? (flagged ? riskFlags : ['None']) : [],
    escalatedTo: flagged ? (MEDICAL.test(text) ? 'Ahmed, Fadia' : 'Ahmed') : '',
    progress: parts.filter(sentence => PLAN.test(sentence)).join(' ')
  };
  const filled = Object.entries(values).filter(([, value]) => Array.isArray(value) ? value.length : !!value).map(([key]) => key);
  return { values, filled };
}
