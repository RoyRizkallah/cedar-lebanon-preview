import { iso, prettyDate } from './data.js';

const sources = ['Website', 'Phone', 'Referral', 'Family', 'Website', 'Phone', 'Referral', 'Website', 'Family', 'Referral', 'Website', 'Phone'];
const previousHours = [2, 4, 6, 8, 12, 18, 3, 5, 26, 34, 48, 30];
const currentHours = [3, 4, 8, 25, 32, 38, 42, 48, 50, 60, 7, 10];
const previousAdmitted = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1];
const currentAdmitted = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export function seedAnalytics() {
  return [...previousHours.map((hours, index) => ({
    id: `HX-${String(index + 1).padStart(3, '0')}`,
    date: iso(-28 + index), source: sources[index], responseHours: hours,
    outcome: previousAdmitted[index] ? 'Admitted' : 'Not admitted'
  })), ...currentHours.map((hours, index) => ({
    id: `HX-${String(index + 13).padStart(3, '0')}`,
    date: iso(-14 + index), source: sources[index], responseHours: hours,
    outcome: currentAdmitted[index] ? 'Admitted' : 'Not admitted'
  }))];
}

const percent = (n, d) => d ? Math.round((n / d) * 100) : 0;
const signed = n => `${n > 0 ? '+' : ''}${n}`;

export function analyzeAdmissions(rows, metric = 'conversion') {
  const previous = rows.filter(row => row.date >= iso(-28) && row.date <= iso(-15));
  const current = rows.filter(row => row.date >= iso(-14) && row.date <= iso(-1));
  const count = (list, key) => key === 'conversion'
    ? list.filter(row => row.outcome === 'Admitted').length
    : list.filter(row => Number(row.responseHours) <= 24).length;
  const prevCount = count(previous, metric);
  const currCount = count(current, metric);
  const prevRate = percent(prevCount, previous.length);
  const currRate = percent(currCount, current.length);
  const delta = currRate - prevRate;
  const delayedPrev = previous.filter(row => Number(row.responseHours) > 24);
  const delayedCurr = current.filter(row => Number(row.responseHours) > 24);
  const bySource = ['Website', 'Phone', 'Referral', 'Family'].map(source => {
    const before = previous.filter(row => row.source === source);
    const after = current.filter(row => row.source === source);
    return { source, before: `${count(before, metric)}/${before.length}`, after: `${count(after, metric)}/${after.length}`, beforeRate: percent(count(before, metric), before.length), afterRate: percent(count(after, metric), after.length) };
  });
  const evidence = metric === 'conversion'
    ? [
        `${prevCount} of ${previous.length} prior inquiries and ${currCount} of ${current.length} recent inquiries resulted in admission.`,
        `Inquiries first answered after 24 hours: ${delayedPrev.length} before, ${delayedCurr.length} recently.`,
        `Among the ${delayedCurr.length} recently delayed inquiries, ${delayedCurr.filter(row => row.outcome === 'Admitted').length} resulted in admission. This is an association, not proof of cause.`
      ]
    : [
        `${prevCount} of ${previous.length} prior inquiries and ${currCount} of ${current.length} recent inquiries received a first reply within 24 hours.`,
        `The count answered after 24 hours moved from ${delayedPrev.length} to ${delayedCurr.length}.`,
        `Review the delayed records to identify which handoffs need a named owner.`
      ];
  return {
    metric, previous, current, prevCount, currCount, prevRate, currRate, delta, bySource, evidence,
    title: metric === 'conversion' ? 'Inquiry to admission' : 'First reply within 24 hours',
    definition: metric === 'conversion' ? 'Admitted ÷ all inquiries created in each 14-day window' : 'First reply within 24 hours ÷ all inquiries created in each 14-day window',
    headline: metric === 'conversion' ? `Admission rate ${delta < 0 ? 'fell' : delta > 0 ? 'rose' : 'held steady'} ${Math.abs(delta)} points` : `Timely replies ${delta < 0 ? 'fell' : delta > 0 ? 'rose' : 'held steady'} ${Math.abs(delta)} points`,
    previousLabel: `${prettyDate(iso(-28))}–${prettyDate(iso(-15))}`,
    currentLabel: `${prettyDate(iso(-14))}–${prettyDate(iso(-1))}`,
    countLabel: `${signed(currCount - prevCount)} records`,
    hasData: previous.length > 0 && current.length > 0
  };
}
