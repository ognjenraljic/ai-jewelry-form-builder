// Local integration: library access, catalogue, upload reuse, pagination and saving card art.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE || 'http://127.0.0.1:8809';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use a local QA server.');
const headers = { 'x-admin-token': process.env.QA_ADMIN_TOKEN || 'qa-local-only' };
const call = async (path, { method = 'GET', body, auth = true } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(auth ? headers : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json() };
};
const post = (path, body) => call(path, { method: 'POST', body });
const client = (await post('/api/admin/clients', { name: `Image library QA ${Date.now().toString(36)}` })).data.client;
const form = (await post('/api/admin/forms', { clientId: client.id, template: 'custom-enquiry', name: 'Image library test' })).data.form;
const other = (await post('/api/admin/forms', { clientId: client.id, template: 'grillz' })).data.form;
assert.ok(form?.id && other?.id);
const path = `/api/admin/forms/${form.id}/images`;
assert.equal((await call(path, { auth: false })).status, 403);
assert.equal((await call('/api/admin/forms/missing-form-for-library/images')).status, 404);
const catalogue = (await call(path)).data;
assert.ok(catalogue.images.length >= 25 && catalogue.images.every((x) => x.image.startsWith('/library/') || x.image.startsWith('/site/')));
assert.ok(catalogue.images.some((x) => x.image === '/site/gallery/chain-category-v2.webp'));
for (const image of catalogue.images) assert.equal((await fetch(base + image.image)).status, 200);

const bytes = await (await fetch(base + '/library/ring/signet.webp')).arrayBuffer();
const upload = async (id, name) => {
  const fd = new FormData(); fd.set('file', new Blob([bytes], { type: 'image/webp' }), 'image.webp'); fd.set('name', name);
  const res = await fetch(`${base}/api/admin/forms/${id}/upload`, { method: 'POST', headers, body: fd });
  assert.equal(res.status, 200); return (await res.json()).url;
};
const url = await upload(form.id, 'My custom card.webp');
const foreign = await upload(other.id, 'Other form.webp');
const uploaded = (await call(path)).data;
assert.ok(uploaded.images.some((x) => x.image === url && x.label === 'My custom card.webp' && x.category === 'uploads'));
assert.ok(!uploaded.images.some((x) => x.image === foreign));
assert.equal((await fetch(base + url)).headers.get('content-type'), 'image/webp');
const piece = form.steps.flatMap((s) => s.fields).find((f) => f.id === 'type').options[0];
piece.image = url;
assert.equal((await call(`/api/admin/forms/${form.id}`, { method: 'PUT', body: { form } })).status, 200);
const saved = (await call(`/api/admin/forms/${form.id}`)).data.form;
assert.equal(saved.steps.flatMap((s) => s.fields).find((f) => f.id === 'type').options[0].image, url);
piece.image = foreign;
assert.equal((await call(`/api/admin/forms/${form.id}`, { method: 'PUT', body: { form } })).status, 400);

// More than one R2 page: no upload is lost when loading the remainder.
const urls = [url];
for (let i = 0; i < 60; i += 6) urls.push(...await Promise.all(Array.from({ length: 6 }, (_, j) => upload(form.id, `Card ${i + j}.webp`))));
let page = (await call(path)).data;
assert.ok(page.next);
const found = new Set(page.images.filter((x) => x.category === 'uploads').map((x) => x.image));
while (page.next) {
  page = (await call(`${path}?cursor=${encodeURIComponent(page.next)}`)).data;
  assert.ok(page.images.every((x) => x.category === 'uploads'));
  page.images.forEach((x) => found.add(x.image));
}
assert.equal(found.size, 61);
assert.ok(urls.every((u) => found.has(u)));
writeFileSync('/tmp/jewelrylead-image-library-qa.json', JSON.stringify({ base, clientId: client.id, formId: form.id, url }), { mode: 0o600 });
console.log('Image library: admin access, 26 built-in images, upload metadata and isolation, saved card image and 61-upload pagination passed.');
