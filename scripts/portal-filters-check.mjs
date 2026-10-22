import assert from 'node:assert/strict';
import { createLeadStore } from '../public/portal/leads.js';

const lead = (id, status = 'new') => ({ id, status, name: `Customer ${id}`, email: `${id}@example.invalid`, phone: '5550100', note: '' });
const counts = { new: 1, contacted: 1 };
let calls = 0, time = 0;
const store = createLeadStore(async () => { calls++; return { leads: [lead('a'), lead('b', 'contacted')], next: null, counts }; }, () => time);
await store.load();
assert.deepEqual((await store.load({ status: 'contacted' })).leads.map((l) => l.id), ['b']);
assert.deepEqual((await store.load({ q: 'A@EXAMPLE' })).leads.map((l) => l.id), ['a']);
assert.equal(calls, 1, 'complete results switch status and search without requests');
store.update('a', { status: 'won', note: 'Quote accepted' }, { new: 0, contacted: 1, won: 1 });
assert.equal((await store.load({ status: 'new' })).leads.length, 0);
const won = await store.load({ status: 'won' });
assert.equal(won.leads[0].note, 'Quote accepted');
assert.equal(won.counts.won, 1);
assert.equal(calls, 1, 'edits remain available while switching cached filters');
time = 30_001;
await store.load();
assert.equal(calls, 2, 'expired results refresh so incoming leads are not permanently hidden');

const requests = [];
const paged = createLeadStore(async (url) => {
  requests.push(url);
  const q = new URL(url, 'http://localhost').searchParams;
  if (q.get('status') === 'won') return { leads: [lead('older', 'won')], next: null, counts: { new: 50, won: 1 } };
  if (q.has('before')) return { leads: [lead('older', 'won')], next: null, counts: { new: 50, won: 1 } };
  return { leads: Array.from({ length: 50 }, (_, i) => lead(String(i))), next: 'cursor', counts: { new: 50, won: 1 } };
});
const first = await paged.load();
assert.equal((await paged.load({ status: 'won' })).leads[0].id, 'older', 'status filter includes leads outside the first page');
assert.ok(requests[1].includes('status=won'));
assert.equal((await paged.load({ status: 'won' })).leads.length, 1);
assert.equal(requests.length, 2, 'filtered page is reused on repeat selection');
const all = await paged.load({ before: first.next, previous: first.leads });
assert.equal(all.leads.length, 51);
await paged.load({ status: 'new' });
assert.equal(requests.length, 3, 'after all pages load status filters become local');

const pending = [];
const racing = createLeadStore((url, { signal }) => new Promise((resolve) => pending.push({ url, signal, resolve })));
const slow = racing.load({ status: 'new' });
const fast = racing.load({ status: 'contacted' });
assert.equal(pending[0].signal.aborted, true);
pending[1].resolve({ leads: [lead('latest', 'contacted')], next: null });
assert.equal((await fast).leads[0].id, 'latest');
pending[0].resolve({ leads: [lead('stale')], next: null });
assert.equal(await slow, null, 'late responses cannot overwrite the latest filter');

let fail = true;
const retry = createLeadStore(async () => { if (fail) throw new Error('offline'); return { leads: [], next: null }; });
await assert.rejects(retry.load(), /offline/);
fail = false;
assert.equal((await retry.load()).leads.length, 0);
console.log('Portal filters: complete and paginated results, search, edits, freshness, racing requests and retry passed.');
