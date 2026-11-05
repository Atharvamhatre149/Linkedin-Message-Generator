import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../src/storage.js';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
beforeEach(() => memory.clear());

test('storage recovers from malformed data and wrong JSON shapes', () => {
  memory.set('lmg-drafts', '[]');
  assert.deepEqual(storage.loadDrafts(), {});
  memory.set('lmg-history', '{broken');
  assert.deepEqual(storage.loadHistory(), []);
});
test('history retains at most twenty entries with exact edited text', () => {
  for (let i=0; i<25; i++) storage.saveMessage({ company: 'Amazon', message: `Edited message ${i}` });
  assert.equal(storage.loadHistory().length, 20);
  assert.equal(storage.loadHistory()[0].message, 'Edited message 24');
});
