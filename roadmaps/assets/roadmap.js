/* Roadmap pages — shared behaviour:
   theme toggle, collapse/expand, progress (localStorage), reset, next-step banner,
   shareable progress link (#done=…), per-phase resource counters, optional EN/AR titles. */
(function () {
  'use strict';
  var root = document.documentElement;
  var body = document.body;
  var THEME_KEY = 'roadmap-theme';
  var LANG_KEY = 'roadmap-lang';
  var PROG_KEY = body.getAttribute('data-progress-key') || 'roadmap-progress';
  var COLLAPSE_KEY = PROG_KEY + ':collapsed';

  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
  }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var toastEl = el('div', 'toast'); toastEl.setAttribute('role', 'status'); body.appendChild(toastEl);
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ---- Theme ---- */
  var themeBtn = document.getElementById('theme');
  function applyTheme(t) {
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
  }
  applyTheme(load(THEME_KEY, null));
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var current = root.getAttribute('data-theme') || (systemDark ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next); save(THEME_KEY, next);
    });
  }

  /* ---- Language (EN / AR titles) — only when the page provides data-ar text ---- */
  var arNodes = Array.prototype.slice.call(document.querySelectorAll('[data-ar]'));
  var langBtn = document.getElementById('lang');
  if (arNodes.length && langBtn) {
    arNodes.forEach(function (n) { n.setAttribute('data-en', n.innerHTML); });
    function applyLang(l) {
      var ar = l === 'ar';
      arNodes.forEach(function (n) { n.innerHTML = ar ? esc(n.getAttribute('data-ar')) : n.getAttribute('data-en'); });
      if (ar) body.setAttribute('data-lang', 'ar'); else body.removeAttribute('data-lang');
      langBtn.textContent = ar ? 'EN' : 'عربي';
      langBtn.setAttribute('aria-pressed', ar ? 'true' : 'false');
    }
    applyLang(load(LANG_KEY, 'en'));
    langBtn.addEventListener('click', function () {
      var next = body.getAttribute('data-lang') === 'ar' ? 'en' : 'ar';
      applyLang(next); save(LANG_KEY, next);
    });
  } else if (langBtn) { langBtn.hidden = true; }

  /* ---- Phases: collapse / expand ---- */
  var phases = Array.prototype.slice.call(document.querySelectorAll('.phase'));
  var collapsed = load(COLLAPSE_KEY, {});
  function expand(ph) {
    if (!ph.classList.contains('collapsed')) return;
    ph.classList.remove('collapsed'); collapsed[ph.id] = false; save(COLLAPSE_KEY, collapsed);
    var head = ph.querySelector('.phead'); if (head) head.setAttribute('aria-expanded', 'true');
  }
  phases.forEach(function (ph) {
    var head = ph.querySelector('.phead');
    var pbody = ph.querySelector('.pbody');
    if (!head || !pbody) return;
    if (!pbody.id) pbody.id = ph.id + '-body';
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-controls', pbody.id);
    if (collapsed[ph.id]) ph.classList.add('collapsed');
    function sync() { head.setAttribute('aria-expanded', ph.classList.contains('collapsed') ? 'false' : 'true'); }
    function toggle() {
      ph.classList.toggle('collapsed');
      collapsed[ph.id] = ph.classList.contains('collapsed');
      save(COLLAPSE_KEY, collapsed); sync();
    }
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    sync();

    /* Resource counter in the header */
    var free = ph.querySelectorAll('.tag.free').length;
    var paid = ph.querySelectorAll('.tag.paid').length;
    var mix = ph.querySelectorAll('.tag.mix').length;
    var videos = ph.querySelectorAll('a.ytbtn').length;
    var docs = ph.querySelectorAll('a.chip').length;
    var parts = [];
    if (free || paid || mix) {
      if (free) parts.push('<span class="rc-free">' + free + ' free</span>');
      if (paid) parts.push('<span class="rc-paid">' + paid + ' paid</span>');
      if (mix) parts.push('<span>' + mix + ' freemium</span>');
    } else {
      if (videos) parts.push('<span>' + videos + ' video' + (videos > 1 ? 's' : '') + '</span>');
    }
    if (docs) parts.push('<span>' + docs + ' docs</span>');
    if (parts.length) {
      var rc = el('div', 'rescount', parts.join(''));
      rc.setAttribute('aria-label', 'Resources in this phase');
      var title = ph.querySelector('.ptitle'); if (title) title.appendChild(rc);
    }
  });

  /* ---- Progress ---- */
  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[data-phase]'));
  var fill = document.getElementById('pf');
  var txt = document.getElementById('pt');
  var progwrap = document.querySelector('.progwrap');
  var saved = load(PROG_KEY, []);
  boxes.forEach(function (b, i) { b.checked = !!saved[i]; });

  /* Shared progress in the URL: #done=1,3,4 (1-based phase numbers as listed by checkboxes) */
  var shareMatch = /[#&]done=([\d,]*)/.exec(location.hash);
  if (shareMatch) {
    var idx = shareMatch[1].split(',').filter(Boolean).map(Number);
    boxes.forEach(function (b, i) { b.checked = idx.indexOf(i + 1) !== -1; });
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () { toast('Progress loaded from the shared link'); }, 300);
  }

  var banner = null;
  function renderNext() {
    if (!progwrap || !boxes.length) return;
    if (!banner) { banner = el('div', 'nextstep'); banner.setAttribute('aria-live', 'polite'); progwrap.parentNode.insertBefore(banner, progwrap.nextSibling); }
    var next = null, done = 0;
    for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) done++; else if (!next) next = boxes[i]; }
    if (!next) {
      banner.className = 'nextstep all-done';
      banner.innerHTML = '<span class="ns-label">Done</span><div class="ns-title">You completed every phase 🎉<small>Share it, then keep practising with the projects.</small></div><a class="ns-go" href="#" data-share>Share progress</a>';
      banner.querySelector('[data-share]').addEventListener('click', function (e) { e.preventDefault(); share(); });
      return;
    }
    var ph = next.closest('.phase');
    var h2 = ph.querySelector('.ptitle h2');
    var num = ph.querySelector('.pnum');
    var small = ph.querySelector('.stars small');
    banner.className = 'nextstep';
    banner.style.setProperty('--pc', getComputedStyle(ph).getPropertyValue('--pc'));
    banner.innerHTML = '<span class="ns-label">' + (done ? 'Next up' : 'Start here') + '</span>' +
      '<div class="ns-title">Phase ' + esc(num ? num.textContent.trim() : '') + ' — ' + esc(h2 ? h2.textContent.trim() : '') +
      (small ? '<small>' + esc(small.textContent.trim()) + '</small>' : '') + '</div>' +
      '<a class="ns-go" href="#' + ph.id + '">' + (done ? 'Continue →' : 'Begin →') + '</a>';
    banner.querySelector('.ns-go').addEventListener('click', function () { expand(ph); });
  }

  function update(persist) {
    var n = 0;
    boxes.forEach(function (b) {
      var ph = b.closest('.phase');
      if (ph) ph.classList.toggle('done', b.checked);
      if (b.checked) n++;
    });
    if (fill) fill.style.width = (boxes.length ? n / boxes.length * 100 : 0) + '%';
    if (txt) txt.textContent = n + ' / ' + boxes.length + ' phases done';
    if (persist !== false) save(PROG_KEY, boxes.map(function (b) { return b.checked; }));
    renderNext();
  }
  boxes.forEach(function (b) {
    b.addEventListener('change', function (e) { e.stopPropagation(); update(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.check'), function (l) {
    l.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  function share() {
    var done = []; boxes.forEach(function (b, i) { if (b.checked) done.push(i + 1); });
    var url = location.origin + location.pathname + '#done=' + done.join(',');
    var copy = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(url) : Promise.reject();
    copy.then(function () { toast('Link copied — ' + done.length + ' / ' + boxes.length + ' phases'); },
      function () { window.prompt('Copy this link to share your progress:', url); });
  }
  var reset = document.getElementById('reset');
  if (reset) {
    reset.addEventListener('click', function (e) {
      e.preventDefault();
      if (!boxes.some(function (b) { return b.checked; })) { toast('Nothing to reset yet'); return; }
      if (!window.confirm('Reset your progress on this roadmap?')) return;
      boxes.forEach(function (b) { b.checked = false; });
      try { localStorage.removeItem(PROG_KEY); } catch (err) { /* ignore */ }
      update(false);
    });
  }
  var shareBtn = document.getElementById('share');
  if (shareBtn) shareBtn.addEventListener('click', function (e) { e.preventDefault(); share(); });

  update(!!shareMatch);

  /* Expand a phase when its anchor is targeted (#p3) */
  function openTarget() {
    var id = location.hash.replace('#', '');
    if (!id || id.indexOf('done=') === 0) return;
    var ph = document.getElementById(id);
    if (ph && ph.classList.contains('phase')) expand(ph);
  }
  window.addEventListener('hashchange', openTarget); openTarget();
})();
