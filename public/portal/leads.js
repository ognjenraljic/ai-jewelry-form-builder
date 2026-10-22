// Keep complete recent results in memory so status filters do not need a round trip.
// Incomplete pages still use server filtering, including search across older leads.
export function createLeadStore(request, now = Date.now) {
  const cache = new Map();
  const fresh = (entry) => entry && now() - entry.at < 30_000;
  const keyOf = (status, q) => JSON.stringify([status, q.toLowerCase()]);
  let pending, sequence = 0;
  return {
    async load({ status = '', q = '', before = null, previous = [] } = {}) {
      const seq = ++sequence;
      pending?.abort();
      const key = keyOf(status, q);
      const all = cache.get(keyOf('', ''));
      const cached = cache.get(key);
      if (!before && fresh(all) && !all.next) {
        const search = q.toLowerCase();
        return { ...all, leads: all.leads.filter((l) => (!status || l.status === status) && (!search || [l.name, l.email, l.phone].some((s) => String(s || '').toLowerCase().includes(search)))) };
      }
      if (!before && fresh(cached)) return cached;
      pending = new AbortController();
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (q) qs.set('q', q);
      if (before) qs.set('before', before);
      try {
        const r = await request(`/api/portal/leads?${qs}`, { signal: pending.signal });
        if (seq !== sequence) return null;
        const entry = { leads: before ? [...previous, ...r.leads] : r.leads, next: r.next, counts: r.counts || {}, at: now() };
        cache.set(key, entry);
        return entry;
      } catch (error) {
        if (seq !== sequence || error.name === 'AbortError') return null;
        throw error;
      }
    },
    update(id, patch, counts) {
      // A changed status invalidates filtered pages. Preserve a complete pool for
      // immediate switching and update notes there as well as on visible cards.
      const all = cache.get(keyOf('', ''));
      cache.clear();
      if (all && !all.next) {
        all.leads = all.leads.map((l) => l.id === id ? { ...l, ...patch } : l);
        all.counts = { ...counts };
        cache.set(keyOf('', ''), all);
      }
    },
  };
}
