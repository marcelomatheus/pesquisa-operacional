import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDraft } from './storage.js';

test('persistence reports unavailable IndexedDB rather than claiming success', async () => {
  const original = globalThis.indexedDB;
  try {
    delete globalThis.indexedDB;
    await assert.rejects(loadDraft(), /IndexedDB não está disponível/);
  } finally {
    if (original !== undefined) globalThis.indexedDB = original;
  }
});

test('IndexedDB writes a draft and manages the personal model library', async () => {
  const prior = globalThis.indexedDB;
  const backing = new Map();
  const db = {
    objectStoreNames: { contains: name => backing.has(name) },
    createObjectStore(name) { backing.set(name, new Map()); },
    transaction(name) {
      const records = backing.get(name);
      const tx = { oncomplete: null, onerror: null, onabort: null };
      const operation = valueFn => {
        const req = { result: undefined };
        queueMicrotask(() => {
          req.result = valueFn();
          req.onsuccess?.({ target: req });
          queueMicrotask(() => tx.oncomplete?.());
        });
        return req;
      };
      tx.objectStore = () => ({
        get: key => operation(() => records.get(key)),
        getAll: () => operation(() => [...records.values()]),
        put: record => operation(() => { records.set(record.id ?? record.key, record); return record.id ?? record.key; }),
        delete: key => operation(() => { records.delete(key); return undefined; }),
      });
      return tx;
    },
  };
  globalThis.indexedDB = { open: () => {
    const req = { result: db, onupgradeneeded: null, onsuccess: null };
    queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
    return req;
  }};
  try {
    const store = await import('./storage.js');
    const model = { id: 'id1', name: 'Teste', sense: 'max', variables: [], objective: [], constraints: [] };
    await store.writeDraft(model);
    assert.equal((await store.loadDraft()).name, 'Teste');
    await store.saveModel(model);
    assert.equal((await store.listSavedModels()).length, 1);
    const dup = await store.duplicateSavedModel(model, () => 'id2');
    assert.equal(dup.id, 'id2');
    assert.equal((await store.listSavedModels()).length, 2);
    await store.deleteSavedModel('id1');
    assert.equal((await store.listSavedModels()).length, 1);
  } finally {
    if (prior === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = prior;
  }
});