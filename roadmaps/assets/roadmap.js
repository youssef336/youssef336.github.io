/* Roadmap pages — shared behaviour: theme toggle, collapse/expand, progress (localStorage), reset. */
(function () {
  'use strict';
  var root = document.documentElement;
  var body = document.body;
  var THEME_KEY = 'roadmap-theme';
  var PROG_KEY = body.getAttribute('data-progress-key') || 'roadmap-progress';
  var COLLAPSE_KEY = PROG_KEY + ':collapsed';

  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
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

  /* ---- Phases: collapse / expand ---- */
  var phases = Array.prototype.slice.call(document.querySelectorAll('.phase'));
  var collapsed = load(COLLAPSE_KEY, {});
  phases.forEach(function (ph) {
    var head = ph.querySelector('.phead');
    var body = ph.querySelector('.pbody');
    if (!head || !body) return;
    if (!body.id) body.id = ph.id + '-body';
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-controls', body.id);
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
  });
  /* Expand a phase when its anchor is targeted (#p3) */
  function openTarget() {
    var id = location.hash.replace('#', '');
    if (!id) return;
    var ph = document.getElementById(id);
    if (ph && ph.classList.contains('phase') && ph.classList.contains('collapsed')) {
      ph.classList.remove('collapsed'); collapsed[id] = false; save(COLLAPSE_KEY, collapsed);
      var head = ph.querySelector('.phead'); if (head) head.setAttribute('aria-expanded', 'true');
    }
  }
  window.addEventListener('hashchange', openTarget); openTarget();

  /* ---- Progress ---- */
  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[data-phase]'));
  var fill = document.getElementById('pf');
  var txt = document.getElementById('pt');
  var saved = load(PROG_KEY, []);
  boxes.forEach(function (b, i) { b.checked = !!saved[i]; });
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
  }
  boxes.forEach(function (b) {
    b.addEventListener('change', function (e) { e.stopPropagation(); update(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.check'), function (l) {
    l.addEventListener('click', function (e) { e.stopPropagation(); });
  });
  var reset = document.getElementById('reset');
  if (reset) {
    reset.addEventListener('click', function (e) {
      e.preventDefault();
      if (!boxes.some(function (b) { return b.checked; })) return;
      if (!window.confirm('Reset your progress on this roadmap?')) return;
      boxes.forEach(function (b) { b.checked = false; });
      try { localStorage.removeItem(PROG_KEY); } catch (err) { /* ignore */ }
      update(false);
    });
  }
  update(false);
})();
