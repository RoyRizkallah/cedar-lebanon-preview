<script>
  import Icon from './Icon.svelte';
  import { readAttachment, extractDocumentText } from './clinicalFiles.js';
  import { buildPatientEvidence, buildVerifiedPatientReview, validateModelReview, evidenceFingerprint } from './patientIntelligence.js';

  export let patient;
  export let record;
  export let sessions = [];
  export let followups = [];
  export let staff;
  export let onPersist = () => {};
  export let onNotice = () => {};
  export let onOpenSource = () => {};
  export let onOpenReports = () => {};

  let loading = false;
  let activeReviewId = '';
  let statusNote = '';
  const reviewDeploy = import.meta.env.MODE === 'review';
  let currentPatientId = '';
  $: if (patient.id !== currentPatientId) { currentPatientId = patient.id; activeReviewId = ''; statusNote = ''; }
  $: evidence = buildPatientEvidence(patient, record, sessions, followups);
  $: fingerprint = evidenceFingerprint(evidence);
  $: reviews = record.aiReviews || [];
  $: review = reviews.find(item => item.id === activeReviewId) || reviews[0];
  $: draftSaved = !!record.reports.find(item => item.reviewId === review?.id);
  $: canSaveReport = ['Director', 'Therapist'].includes(staff.role);

  function sourceFor(id) { return evidence.sources.find(item => item.id === id); }
  function openSource(id) { const source = sourceFor(id); if (source) onOpenSource(source); }

  async function generate() {
    if (loading) return;
    loading = true;
    statusNote = 'Reading the available case record…';
    const extractionErrors = [];
    try {
      for (const document of record.documents || []) {
        if (!document.hasFile || document.extractedText) continue;
        try {
          const file = await readAttachment(document.id);
          if (!file) throw new Error('The browser attachment is missing.');
          const extracted = await extractDocumentText(file);
          document.extractedText = extracted.text;
          document.extractionTruncated = !!extracted.truncated;
          document.extractionError = '';
        } catch (error) {
          document.extractionError = error.message || 'Could not read this document.';
          extractionErrors.push(document.name);
        }
      }
      if (extractionErrors.length) onPersist('Document reading attempted for case review.');
      const current = buildPatientEvidence(patient, record, sessions, followups);
      const verified = buildVerifiedPatientReview(patient, record, current, sessions, followups);
      let result = verified;
      if (reviewDeploy) statusNote = 'Verified case summary ready. Optional AI synthesis is available in the local Cedar workspace.';
      else {
        statusNote = 'Checking for a local AI synthesis…';
        try {
          const response = await fetch('/api/patient-review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ patientId: patient.id, documentCoverage: current.coverage, sources: current.sources.filter(item => item.readable) })
          });
          const payload = await response.json();
          if (response.ok) {
            const modelReview = validateModelReview(payload, current);
            if (modelReview) result = modelReview;
            else statusNote = 'The local model response lacked valid source links. A verified summary was saved instead.';
          } else statusNote = payload.error || 'Local AI is unavailable. A verified summary was saved.';
        } catch { statusNote = 'Local AI is unavailable. A verified summary was saved.'; }
      }
      if (result.mode === 'Local AI synthesis') statusNote = 'Local AI draft ready. Review every finding against its sources.';
      if (extractionErrors.length) result.limitations = [...result.limitations, `Could not read ${extractionErrors.length} attached document${extractionErrors.length === 1 ? '' : 's'}: ${extractionErrors.join(', ')}.`];
      const saved = {
        id: `REV-${Date.now()}`,
        patientId: patient.id,
        generatedAt: new Date().toISOString(),
        reviewer: staff.name,
        fingerprint: evidenceFingerprint(current),
        coverage: current.coverage,
        sourceIndex: current.sources.map(({ id, type, title, date, tab, readable, truncated }) => ({ id, type, title, date, tab, readable, truncated })),
        ...result
      };
      record.aiReviews.unshift(saved);
      activeReviewId = saved.id;
      onPersist('Source-linked case review generated.');
    } catch (error) { statusNote = error.message || 'The case review could not be generated.'; }
    finally { loading = false; }
  }

  function saveAsReport() {
    if (!review || !canSaveReport || draftSaved) return;
    const refs = [...new Set(Object.values(review.draft).flatMap(item => item.sourceIds || []))];
    const withRefs = item => `${item.text}\n\nSources: ${(item.sourceIds || []).join(', ') || 'None'}`;
    record.reports.unshift({
      id: `RPT-${Date.now()}`,
      type: 'Case review',
      title: `Case review · ${new Date(review.generatedAt).toLocaleDateString('en-LB')}`,
      periodStart: patient.admitted,
      periodEnd: new Date(review.generatedAt).toISOString().slice(0, 10),
      overview: withRefs(review.draft.overview),
      engagement: withRefs(review.draft.engagement),
      goals: withRefs(review.draft.goals),
      nextSteps: withRefs(review.draft.nextSteps),
      status: 'Draft',
      author: staff.name,
      createdAt: new Date().toISOString().slice(0, 10),
      generatedBy: 'Cedar case review',
      reviewId: review.id,
      sourceRefs: refs
    });
    onPersist('Case review saved as an editable report draft.');
    onNotice('Draft saved in this patient’s Reports tab. Staff review is required before finalizing.');
    onOpenReports();
  }

  function printReview() {
    if (!review) return;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const labels = { overview: '01 / Case context and documentation', engagement: '02 / Engagement and sessions', goals: '03 / Care plan', nextSteps: '04 / Follow-through and transition' };
    const sections = Object.entries(labels).map(([key, label]) => `<section><h2>${label}</h2><p>${escape(review.draft[key].text)}</p><div class="refs">Sources: ${escape(review.draft[key].sourceIds.join(', '))}</div></section>`).join('');
    const used = [...new Set(Object.values(review.draft).flatMap(item => item.sourceIds || []))];
    const appendix = used.map(id => { const item = review.sourceIndex.find(source => source.id === id); return `<li><strong>${escape(id)}</strong> · ${escape(item?.title || 'Source')} · ${escape(item?.date || 'Undated')}</li>`; }).join('');
    const limits = (review.limitations || []).map(item => `<li>${escape(item)}</li>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Case review · ${escape(patient.id)}</title><style>body{max-width:800px;margin:42px auto;padding:0 26px;color:#244132;font:14px/1.65 Arial,sans-serif}header{border-bottom:3px solid #265642;padding-bottom:22px}header small,.eyebrow{color:#638269;font-size:10px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase}h1{font:normal 36px Georgia,serif;margin:12px 0 4px}h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:27px 0 9px;color:#43704b}p{white-space:pre-wrap;margin:0}section{border-bottom:1px solid #e2eae0;padding-bottom:23px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:22px 0}.meta div{background:#f3f7f0;padding:11px}.meta span{display:block;color:#839b86;font-size:10px}.meta strong{display:block;font-size:12px;margin-top:3px}.refs{font-size:10px;color:#698671;margin-top:12px}.appendix{margin-top:30px}.appendix li{font-size:11px;margin:4px 0}.notice{background:#fff7e9;border:1px solid #eadbbd;padding:12px;margin-top:25px;color:#7e6542;font-size:11px}@media print{body{margin:14mm auto}section{break-inside:avoid}}</style></head><body><header><small>CEDAR LEBANON · FICTIONAL STAFF PREVIEW</small><h1>Clinical case review</h1><div>Working draft for staff verification · ${escape(review.mode)}</div></header><div class="meta"><div><span>PATIENT</span><strong>${escape(patient.name)} · ${escape(patient.id)}</strong></div><div><span>PROGRAM</span><strong>${escape(record.pathway)}</strong></div><div><span>PREPARED</span><strong>${escape(new Date(review.generatedAt).toLocaleString('en-LB'))} · ${escape(review.reviewer)}</strong></div><div><span>SOURCES</span><strong>${review.coverage.readable} readable of ${review.coverage.total} record items</strong></div></div><section><h2>Review summary</h2><p>${escape(review.summary)}</p></section>${sections}<div class="appendix"><h2>Source index</h2><ol>${appendix}</ol></div>${limits ? `<div class="appendix"><h2>Limitations</h2><ul>${limits}</ul></div>` : ''}<div class="notice">Draft generated from fictional data. An authorized staff member must verify every statement and source. This document is not a diagnosis, risk score or treatment decision.</div></body></html>`;
    const view = window.open('', '_blank');
    if (!view) { onNotice('Allow pop-ups to print this case review.'); return; }
    view.opener = null;
    view.document.write(html);
    view.document.close();
    setTimeout(() => view.print(), 400);
  }
</script>

<div class="case-review">
  <section class="case-hero"><div><span class="case-hero-kicker"><Icon name="sparkle" size={15}/> CEDAR CASE REVIEW</span><h3>See the whole story.<br/><em>Keep the sources close.</em></h3><p>Bring this patient’s documents, signed notes, team comments, sessions, attendance, goals and follow-ups into one source-linked working review.</p><div class="case-hero-actions"><button class="btn case-generate" on:click={generate} disabled={loading}>{loading ? 'Reading case record…' : review ? 'Refresh case review' : 'Generate case review'} <Icon name="arrow" size={15}/></button><span>{reviewDeploy ? 'Fictional data · verified summary' : 'Fictional data · local model only'}</span></div></div><div class="case-hero-mark"><Icon name="leaf" size={96} stroke={1}/></div></section>

  <div class="case-coverage"><div><span>RECORD ITEMS</span><strong>{evidence.coverage.total}</strong><small>Linked to this patient</small></div><div><span>READABLE SOURCES</span><strong>{evidence.coverage.readable}</strong><small>Included in review</small></div><div><span>DOCUMENT CONTENT</span><strong>{evidence.coverage.readableDocuments}<em> / {evidence.coverage.documents}</em></strong><small>Readable text available</small></div><div><span>LAST REVIEW</span><strong class="case-date">{review ? new Date(review.generatedAt).toLocaleDateString('en-LB',{day:'numeric',month:'short'}) : '—'}</strong><small>{review ? review.mode : 'Ready to generate'}</small></div></div>

  {#if statusNote}<div class="case-status" role="status"><Icon name="shield" size={16}/>{statusNote}</div>{/if}
  {#if evidence.coverage.unavailableDocuments.length}<div class="case-caution"><strong>Document content unavailable</strong><span>{evidence.coverage.unavailableDocuments.join(', ')}. These files are listed in the record, but their contents cannot be analyzed until readable text is attached.</span></div>{/if}

  {#if review}
    <div class="case-review-toolbar"><div><span class="record-section-kicker">REVIEW HISTORY</span><h3>Source-linked case picture</h3><p>Generated by {review.reviewer} · {new Date(review.generatedAt).toLocaleString('en-LB')} · {review.mode}</p></div><select aria-label="Choose case review" bind:value={activeReviewId}><option value="">Latest review</option>{#each reviews as item}<option value={item.id}>{new Date(item.generatedAt).toLocaleString('en-LB')} · {item.mode}</option>{/each}</select></div>
    {#if review.fingerprint !== fingerprint}<div class="case-stale"><Icon name="refresh" size={16}/> This record changed after the review. Refresh it before relying on the draft.</div>{/if}
    <div class="case-layout"><div class="case-main"><section class="record-panel case-summary"><span class="record-section-kicker">EXECUTIVE SUMMARY</span><p>{review.summary}</p><div class="case-mode">{review.mode === 'Local AI synthesis' ? 'Local AI synthesis · verify against linked sources' : 'Calculated record summary · no model interpretation'}</div></section>
      <section class="record-panel case-findings"><div class="record-section-head"><div><span class="record-section-kicker">GROUNDED FINDINGS</span><h3>What the record shows</h3></div><span class="record-soft-tag">{review.findings.length} findings</span></div>{#each review.findings as finding, index}<article><span class="case-finding-number">0{index + 1}</span><div><h4>{finding.title}</h4><p>{finding.text}</p><div class="case-source-links">{#each finding.sourceIds as id}<button title={`Open ${id}`} on:click={() => openSource(id)}>{id} ↗</button>{/each}</div></div></article>{/each}</section>
      <section class="record-panel case-draft"><div class="record-section-head"><div><span class="record-section-kicker">CLINICAL CASE REVIEW / WORKING DRAFT</span><h3>{patient.name} · {patient.id}</h3><p>Prepared {new Date(review.generatedAt).toLocaleDateString('en-LB')} by {review.reviewer} · {record.pathway}</p></div></div><div class="case-report-banner"><span>Staff verification required</span><strong>{review.coverage.readable} source items reviewed</strong></div>{#each [['overview','01 / Case context & documentation'],['engagement','02 / Engagement & sessions'],['goals','03 / Care plan'],['nextSteps','04 / Follow-through & transition']] as entry}<div class="case-draft-section"><span>{entry[1]}</span><p>{review.draft[entry[0]].text}</p><div class="case-source-links">{#each review.draft[entry[0]].sourceIds as id}<button on:click={() => openSource(id)}>{id} ↗</button>{/each}</div></div>{/each}<div class="case-draft-footer"><button class="btn btn-outline" on:click={printReview}><Icon name="download" size={14}/> Print / PDF</button>{#if canSaveReport}<button class="btn btn-primary" on:click={saveAsReport} disabled={draftSaved || review.fingerprint !== fingerprint}>{draftSaved ? 'Draft saved in Reports' : 'Save as report draft'} <Icon name="arrow" size={14}/></button>{:else}<span>Therapists and directors can save clinical report drafts. Coordinators can use this review for handoffs.</span>{/if}</div></section></div>
      <aside class="case-side"><section class="record-panel case-evidence"><div class="record-section-head"><div><span class="record-section-kicker">SOURCE REGISTER</span><h3>Everything considered</h3><p>{review.coverage.readable} readable of {review.coverage.total} record items</p></div></div><div class="case-evidence-list">{#each review.sourceIndex as source}<button on:click={() => openSource(source.id)} disabled={!sourceFor(source.id)}><span class:unreadable={!source.readable} class="case-evidence-mark"></span><span><strong>{source.title}</strong><small>{source.type} · {source.date || 'Undated'} · {source.id}</small>{#if !source.readable}<em>Content unavailable</em>{:else if source.truncated}<em>Text truncated to 16,000 characters</em>{/if}</span><Icon name="chevron" size={14}/></button>{/each}</div></section>{#if review.limitations?.length}<section class="case-limits"><span class="record-section-kicker">REVIEW LIMITS</span>{#each review.limitations as item}<p>{item}</p>{/each}</section>{/if}</aside></div>
  {:else}<div class="case-empty"><Icon name="sparkle" size={28}/><h3>A useful view of one person’s record</h3><p>Generate the first review to see documented patterns, source coverage, open questions, and a report draft. Missing documents are shown openly.</p><button class="btn btn-primary" on:click={generate} disabled={loading}>Generate case review</button></div>{/if}
  <p class="record-safety-note">This preview supports documentation review. It does not diagnose, predict outcomes, or replace the assigned team’s judgment. Never use real patient information in this fictional preview.</p>
</div>
