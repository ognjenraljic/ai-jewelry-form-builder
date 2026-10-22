/* Snippet za sajt zlatara:
   <div id="aik-form"></div>
   <script src="https://<host>/embed.js" data-form="demo" data-target="aik-form" async></script>
   Analitika zlatara: window.addEventListener('jewelrylead', (e) => e.detail.type) = 'step' | 'lead' | 'render' | 'tryon'. */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var origin = new URL(s.src).origin;
  var form = s.getAttribute('data-form') || 'demo';
  var f = document.createElement('iframe');
  f.src = origin + '/f/' + encodeURIComponent(form);
  f.title = 'Design your custom piece';
  f.loading = 'lazy';
  f.allow = 'fullscreen';
  f.style.cssText = 'width:100%;border:0;display:block;height:760px;transition:height .25s ease;background:transparent';

  // Gdje ide forma: element iz data-target, inače odmah poslije ove skripte (nikad u <head>).
  function mountIt() {
    var target = document.getElementById(s.getAttribute('data-target') || '');
    if (target) return target.appendChild(f);
    if (s.parentNode && s.parentNode.nodeName !== 'HEAD') return s.parentNode.insertBefore(f, s.nextSibling);
    document.body.appendChild(f);
  }
  if (document.body) mountIt(); else document.addEventListener('DOMContentLoaded', mountIt);

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Formi javljamo koji njen dio se vidi na ekranu (za traku sa Continue i padajuće menije). Nema ličnih podataka.
  var queued = false;
  function sendViewport() {
    queued = false;
    if (!f.contentWindow) return;
    var r = f.getBoundingClientRect();
    var top = Math.max(0, -r.top);
    var height = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
    f.contentWindow.postMessage({ type: 'aik:viewport', top: top, height: height }, origin);
  }
  function queue() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(sendViewport); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  f.addEventListener('load', queue);

  window.addEventListener('message', function (e) {
    // Poruke primamo samo od našeg porijekla i samo iz našeg iframe-a.
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data) return;
    if (e.data.type === 'aik:resize' && Number.isFinite(e.data.height) && e.data.height > 0) {
      f.style.height = Math.max(560, Math.ceil(e.data.height)) + 'px';
      queue();
    }
    if (e.data.type === 'aik:step' && f.getBoundingClientRect().top < 0) f.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // Događaj za analitiku zlatara (Meta pixel, GA): bez imena, mejla i telefona kupca.
    var t = { 'aik:step': 'step', 'aik:lead': 'lead', 'aik:render': 'render', 'aik:tryon': 'tryon' }[e.data.type];
    if (t) {
      try { window.dispatchEvent(new CustomEvent('jewelrylead', { detail: { type: t, form: form, step: e.data.step || null } })); } catch (err) {}
    }
  });
})();
