const DATABASE = 'cedar-fictional-demo-files';

function database() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Local file storage is unavailable in this browser.'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('attachments');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = operation(db.transaction('attachments', mode).objectStore('attachments'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const saveAttachment = (id, file) => transaction('readwrite', store => store.put(file, id));
export const readAttachment = id => transaction('readonly', store => store.get(id));
export const deleteAttachment = id => transaction('readwrite', store => store.delete(id));
export const clearAttachments = () => transaction('readwrite', store => store.clear());

export async function extractDocumentText(file) {
  if (file.size > 10_000_000) throw new Error('Use a fictional file smaller than 10 MB.');
  const name = file.name?.toLowerCase() || '';
  const type = name.endsWith('.pdf') ? 'pdf' : name.endsWith('.docx') ? 'docx' : null;
  if (!type && !/\.(txt|md|csv|json)$/i.test(name)) throw new Error('Readable analysis supports PDF, DOCX, TXT, MD, CSV, and JSON files.');
  if (!type) {
    const text = await file.text();
    if (!text.trim()) throw new Error('The document has no readable text.');
    return { text: text.slice(0, 16000), truncated: text.length > 16000, parts: 1 };
  }
  if (import.meta.env.MODE === 'review') throw new Error('PDF and DOCX reading is available in the local Cedar workspace. This public review accepts TXT, MD, CSV, and JSON files.');
  let response;
  try { response = await fetch(`/api/document-text?type=${type}`, { method: 'POST', body: file }); }
  catch { throw new Error('Start the local Node server to read PDF or DOCX documents.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('The local document reader is unavailable. Run npm run build, then npm start.'); }
  if (!response.ok) throw new Error(result.error || 'The document could not be read locally.');
  return result;
}
