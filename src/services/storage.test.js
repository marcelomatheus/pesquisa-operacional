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
