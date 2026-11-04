/** IndexedDB persistence: local-only models, draft and lightweight run history. */
const DB_NAME = 'pivonauta-v1';
const VERSION = 1;
const MAX_RUNS = 30;
let connection;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB não está disponível neste navegador.'));
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(request.error || new Error('Falha ao abrir IndexedDB.')); };
  });
  return connection;
}

async function operation(storeName, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let request;
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    try { request = action(store); }
    catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error || new Error('Falha ao acessar o armazenamento.'));
    tx.onabort = () => reject(tx.error || new Error('Operação de armazenamento cancelada.'));
  });
}

export async function loadDraft() {
  const record = await operation('meta', 'readonly', store => store.get('draft'));
  return record?.value || null;
}
export async function writeDraft(model) {
  return operation('meta', 'readwrite', store => store.put({ key: 'draft', value: model, updated_at: new Date().toISOString() }));
}
export async function listSavedModels() {
  const records = await operation('models', 'readonly', store => store.getAll());
  return (records || []).sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));
}
export async function getSavedModel(id) {
  return operation('models', 'readonly', store => store.get(id));
}
export async function saveModel(model) {
  const record = { ...model, saved_at: new Date().toISOString() };
  await operation('models', 'readwrite', store => store.put(record));
  return record;
}
export async function deleteSavedModel(id) {
  return operation('models', 'readwrite', store => store.delete(id));
}
export async function duplicateSavedModel(model, createId) {
  const duplicate = { ...model, id: createId('model'), name: `${model.name} (cópia)` };
  return saveModel(duplicate);
}
export async function rememberRun(entry) {
  const record = { ...entry, id: entry.id, recorded_at: new Date().toISOString() };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('runs', 'readwrite');
    const store = tx.objectStore('runs');
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      const existing = getAll.result || [];
      existing.sort((a, b) => (a.recorded_at || '').localeCompare(b.recorded_at || ''));
      existing.slice(0, Math.max(0, existing.length - MAX_RUNS + 1)).forEach(item => store.delete(item.id));
      store.put(record);
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Falha ao registrar execução.'));
    tx.onabort = () => reject(tx.error || new Error('Registro cancelado.'));
  });
  return record;
}
export async function listRuns() {
  const records = await operation('runs', 'readonly', store => store.getAll());
  return (records || []).sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''));
}
