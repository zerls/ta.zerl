/* ═══════════════════════════════════════════════════════════════
   runtime.js — Interactive Notes 共享运行时
   提供：back-to-top、fitCanvas、switchTab、TOC observer、
         togglePipe、MathJax 初始化触发
   ═══════════════════════════════════════════════════════════════ */

/* ── Back to top ── */
(function initBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ── Canvas resize helper ── */
function fitCanvas(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const w = el.parentElement.clientWidth || 400;
  el.width = w;
  return el;
}

/* ── Tab switching（带 MathJax 重排） ── */
function switchTab(id, btn) {
  // 找到最近的 tabs 容器，只影响同组 tab
  const tabsEl = btn.parentElement;
  const container = tabsEl.parentElement;
  container.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([document.getElementById(id)]);
  }
}

/* ── Pipeline accordion ── */
function togglePipe(el) {
  const detail = el.querySelector('.pipe-detail');
  const wasOpen = detail.classList.contains('open');
  document.querySelectorAll('.pipe-detail').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.pipe-step').forEach(s => s.classList.remove('active'));
  if (!wasOpen) {
    detail.classList.add('open');
    el.classList.add('active');
  }
}

/* ── TOC scroll helper（带可选偏移） ── */
function tocScroll(id, btn) {
  const target = document.getElementById(id);
  if (!target) return;
  const navH = document.querySelector('nav.toc')?.offsetHeight || 48;
  const top = target.getBoundingClientRect().top + window.scrollY - navH - 16;
  window.scrollTo({ top, behavior: 'smooth' });
  document.querySelectorAll('.toc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* scrollToSec 的别名（cg-math 用法） */
function scrollToSec(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: 'smooth' });
}

/* ── IntersectionObserver 自动高亮 TOC ── */
(function initTocObserver() {
  const sections = document.querySelectorAll('section[id], .section[id]');
  if (!sections.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      document.querySelectorAll('.toc-btn').forEach(b => {
        // 兼容 onclick="tocScroll('id',this)" 和 onclick="scrollToSec('id')" 两种写法
        const matches = b.getAttribute('onclick')?.includes("'" + id + "'")
          || b.getAttribute('onclick')?.includes('"' + id + '"');
        b.classList.toggle('active', !!matches);
      });
    });
  }, { rootMargin: '-10% 0px -70% 0px' });
  sections.forEach(s => observer.observe(s));
})();

/* ── MathJax 初始化（页面加载后触发全页排版） ── */
window.addEventListener('load', () => {
  if (window.MathJax?.startup?.promise) {
    MathJax.startup.promise.then(() => MathJax.typesetPromise());
  }
  // 触发各笔记自己注册的初始化函数（如果存在）
  if (typeof noteInit === 'function') noteInit();
  // 触发 resize 以正确初始化 canvas 尺寸
  window.dispatchEvent(new Event('resize'));
});
