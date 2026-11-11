import { backend, filesUrl } from './backend.svelte.js';
// Uploaded files (scans, prescriptions, invoices) live in this browser's IndexedDB; records keep only the id.
const DB_NAME = 'cedar-rehab-files';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putFile(file) {
  if (backend.on) {
    const response = await fetch('/api/files', { method: 'POST', credentials: 'same-origin', headers: { 'x-cedar-upload': '1', 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type || 'application/octet-stream' }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The file was not uploaded.');
    return body;
  }
  const id = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob: file, name: file.name, type: file.type }, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return { id, name: file.name };
}

export async function openFile(id) {
  if (backend.on) { window.open(filesUrl(id), '_blank', 'noopener'); return; }
  const db = await open();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!record) throw new Error('This file is not stored in this browser.');
  window.open(URL.createObjectURL(record.blob), '_blank', 'noopener');
}

export async function clearFiles() {
  const db = await open();
  db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
}
