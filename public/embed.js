/* Snippet za sajt zlatara:
   <div id="aik-form"></div>
   <script src="https://<host>/embed.js" data-form="demo" data-target="aik-form" async></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var origin = new URL(s.src).origin;
  var form = s.getAttribute('data-form') || 'demo';
  var mount = document.getElementById(s.getAttribute('data-target') || '') || s.parentNode;
  var f = document.createElement('iframe');
  f.src = origin + '/f/' + encodeURIComponent(form);
  f.title = 'Design your custom piece';
  f.loading = 'lazy';
  f.allow = 'fullscreen';
  f.style.cssText = 'width:100%;border:0;display:block;height:760px;transition:height .25s ease;background:transparent';
  mount.appendChild(f);
  window.addEventListener('message', function (e) {
    // Visinu primamo samo od našeg porijekla i samo iz našeg iframe-a.
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data) return;
    if (e.data.type === 'aik:resize' && typeof e.data.height === 'number') {
      f.style.height = Math.max(560, Math.min(2400, e.data.height)) + 'px';
    }
    if (e.data.type === 'aik:step' && f.getBoundingClientRect().top < 0) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
