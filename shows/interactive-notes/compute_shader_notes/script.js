/* ============================================================
   Compute Shader Notes — script.js
   ============================================================ */

// ---------- highlight.js init ----------
document.addEventListener('DOMContentLoaded', () => {

  // Register HLSL as an alias of GLSL (closest available grammar)
  // If hlsl grammar is loaded, it will override this
  if (hljs.getLanguage('glsl')) {
    hljs.registerAliases(['hlsl'], { languageName: 'glsl' });
  }

  // Configure hljs
  hljs.configure({
    ignoreUnescapedHTML: true,
    languages: ['glsl', 'hlsl', 'cpp', 'csharp']
  });

  // Highlight all code blocks
  document.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });

  // ---------- Tab System ----------
  initTabs();

  // ---------- Sidebar nav active tracking ----------
  initNavHighlight();

  // ---------- Back to top ----------
  initBackToTop();

  // ---------- Keyboard shortcut ----------
  initKeyboardShortcuts();
});

/* ——— Tabs ——————————————————————————————————————————— */
function initTabs() {
  document.querySelectorAll('.tab-bar').forEach(bar => {
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const container = bar.closest('.tab-container');
        const targetId  = 'tab-' + btn.dataset.tab;

        // Deactivate all
        bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Activate selected
        btn.classList.add('active');
        const panel = container.querySelector('#' + targetId);
        if (panel) {
          panel.classList.add('active');

          // Re-run highlight on newly visible code (in case it was hidden)
          panel.querySelectorAll('pre code:not(.hljs)').forEach(block => {
            hljs.highlightElement(block);
          });

          // Re-run MathJax on newly visible content
          if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([panel]).catch(err => console.warn(err));
          }
        }
      });
    });
  });
}

/* ——— Sidebar Active Nav ————————————————————————————— */
function initNavHighlight() {
  const sections = document.querySelectorAll('.chapter[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    },
    {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }
  );

  sections.forEach(sec => observer.observe(sec));

  // Smooth scroll for sidebar links
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        const offset = 24;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ——— Back To Top ————————————————————————————————————— */
function initBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ——— Keyboard Shortcuts ————————————————————————————— */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Press [ or ] to navigate sections
    const sections = Array.from(document.querySelectorAll('.chapter[id]'));
    if (!sections.length) return;

    const scrollY = window.scrollY + 80;
    let currentIdx = sections.findIndex((s, i) => {
      const next = sections[i + 1];
      return s.offsetTop <= scrollY && (!next || next.offsetTop > scrollY);
    });
    if (currentIdx < 0) currentIdx = 0;

    if (e.key === ']' || e.key === 'j') {
      const next = sections[Math.min(currentIdx + 1, sections.length - 1)];
      if (next) window.scrollTo({ top: next.offsetTop - 24, behavior: 'smooth' });
    }

    if (e.key === '[' || e.key === 'k') {
      const prev = sections[Math.max(currentIdx - 1, 0)];
      if (prev) window.scrollTo({ top: prev.offsetTop - 24, behavior: 'smooth' });
    }

    // Press T to scroll to top
    if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });
}

/* ——— Copy Button for Code Blocks ———————————————————— */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.code-block-wrap').forEach(wrap => {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'copy';
    copyBtn.setAttribute('aria-label', '复制代码');

    // Insert into label bar
    const label = wrap.querySelector('.code-label');
    if (label) {
      label.style.display       = 'flex';
      label.style.justifyContent = 'space-between';
      label.style.alignItems    = 'center';
      label.appendChild(copyBtn);
    }

    copyBtn.addEventListener('click', async () => {
      const code = wrap.querySelector('pre code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.innerText);
        copyBtn.textContent = '✓ copied';
        copyBtn.style.color = 'var(--c-green)';
        setTimeout(() => {
          copyBtn.textContent = 'copy';
          copyBtn.style.color = '';
        }, 1800);
      } catch {
        copyBtn.textContent = 'failed';
        setTimeout(() => { copyBtn.textContent = 'copy'; }, 1800);
      }
    });
  });

  // Inject copy button styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .copy-btn {
      font-family: var(--font-mono, monospace);
      font-size: 0.68rem;
      padding: 2px 9px;
      border-radius: 4px;
      border: 1px solid var(--border-hi, #2e3448);
      background: transparent;
      color: var(--c-muted, #4a5568);
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
      letter-spacing: 0.05em;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .copy-btn:hover {
      color: var(--c-cyan, #00e5ff);
      border-color: var(--c-cyan, #00e5ff);
    }
  `;
  document.head.appendChild(style);
});

/* ——— Section Progress Indicator ————————————————————— */
document.addEventListener('DOMContentLoaded', () => {
  // Create thin progress bar at top
  const bar = document.createElement('div');
  bar.id = 'progress-bar';
  Object.assign(bar.style, {
    position:   'fixed',
    top:        '0',
    left:       '0',
    height:     '2px',
    width:      '0%',
    background: 'linear-gradient(90deg, #00e5ff, #b47aff)',
    zIndex:     '9999',
    transition: 'width 0.1s linear',
    pointerEvents: 'none'
  });
  document.body.appendChild(bar);

  window.addEventListener('scroll', () => {
    const scrollTop    = window.scrollY;
    const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
    const pct          = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width    = pct + '%';
  }, { passive: true });
});

// ── iframe communication ────────────────────────────────────────
let playgroundReady = false;
let pendingInject = null;

const iframe = document.getElementById('playground-iframe');
const iframeLoading = document.getElementById('iframe-loading');

if (iframe) {
  iframe.addEventListener('load', () => {
    // Small delay to allow playground JS to fully boot
    setTimeout(() => {
      iframeLoading?.classList.add('hidden');
      playgroundReady = true;
      // If there was a pending inject, send it now
      if (pendingInject) {
        sendToPlayground(pendingInject);
        pendingInject = null;
      }
    }, 1200);
  });
}

// Listen for messages back from playground (optional)
window.addEventListener('message', (e) => {
  if (e.data?.type === 'computetoy-ready') {
    playgroundReady = true;
    iframeLoading?.classList.add('hidden');
  }
});

function sendToPlayground(payload) {
  if (!iframe) return;
  // Scroll to section 10 first
  const s10 = document.getElementById('s10');
  if (s10) s10.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    iframe.contentWindow.postMessage(payload, '*');
  } catch(e) {
    console.warn('postMessage failed:', e);
  }
}

function injectPreset(presetKey) {
  const preset = PLAYGROUND_PRESETS[presetKey];
  if (!preset) return;

  const payload = {
    type: 'computetoy-inject',
    preset: presetKey,
    tab: preset.tab,
    code: preset.code,
    label: preset.label,
    autoRun: true,
  };

  if (playgroundReady) {
    sendToPlayground(payload);
  } else {
    pendingInject = payload;
    // Ensure iframe is loaded
    if (iframe && !iframe.src) {
      iframe.src = '../webgpu_playground/index.html';
    }
  }

  // Visual feedback
  document.querySelectorAll('.preset-inject-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === presetKey);
  });
  setTimeout(() => {
    document.querySelectorAll('.preset-inject-btn').forEach(b => b.classList.remove('active'));
  }, 2000);
}

// ── "Open in Playground" button handlers ───────────────────────
document.querySelectorAll('.open-in-playground').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const presetKey = btn.dataset.preset || 'plasma';
    const override  = btn.dataset.override;

    // Visual flash
    btn.classList.add('clicked');
    setTimeout(() => btn.classList.remove('clicked'), 600);

    // Show inject preview
    showInjectPreview(presetKey, override, btn);
  });
});

function showInjectPreview(presetKey, override, sourceBtn) {
  const preset = PLAYGROUND_PRESETS[presetKey];
  if (!preset) return;

  const preview  = document.getElementById('inject-preview');
  const nameEl   = document.getElementById('inject-name');
  const codeEl   = document.getElementById('inject-code-text');
  const confirm  = document.getElementById('inject-confirm');
  const cancel   = document.getElementById('inject-cancel');

  if (!preview) return;

  let displayCode = preset.code;
  let displayName = preset.label;

  // Special override for grayscale — show the section's actual HLSL
  if (override === 'grayscale') {
    displayName = '图像去色 (运行 plasma 兼容版)';
    displayCode = `// 亮度加权灰度化 — 运行于 plasma 兼容模式
// 注：WGSL 版将在 plasma 框架内演示相同算法

struct Uniforms {
  iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f,
  uSpeed:f32, uScale:f32, uParam:f32, _pad:f32,
}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read_write>buf:array<vec4f>;

// ITU-R BT.601: L = 0.299R + 0.587G + 0.114B
fn grayscale(col:vec3f)->f32 {
  return dot(col, vec3f(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8,8,1)
fn CSMain(@builtin(global_invocation_id) gid:vec3u){
  let W=u32(u.iResolution.x); let H=u32(u.iResolution.y);
  if(gid.x>=W||gid.y>=H){return;}
  let uv=vec2f(f32(gid.x)/f32(W), f32(gid.y)/f32(H));
  let t=u.iTime*u.uSpeed;
  // Synthetic colour input (plasma)
  let q=uv*u.uScale*6.28318;
  let rgb=vec3f(sin(q.x+t)*0.5+0.5, cos(q.y+t*0.7)*0.5+0.5, sin(q.x+q.y+t*0.5)*0.5+0.5);
  // Apply grayscale conversion based on uParam (0=colour, 1=grey)
  let gray=grayscale(rgb);
  let result=mix(rgb, vec3f(gray), u.uParam);
  buf[gid.y*W+gid.x]=vec4f(result,1.0);
}`;
  }

  nameEl.textContent = displayName;
  // Show first 12 lines of code
  codeEl.textContent = displayCode.split('\n').slice(0,14).join('\n') + '\n// ...';

  preview.style.display = 'block';

  // Confirm handler
  const onConfirm = () => {
    preview.style.display = 'none';
    confirm.removeEventListener('click', onConfirm);

    const payload = {
      type: 'computetoy-inject',
      preset: override === 'grayscale' ? 'plasma' : presetKey,
      tab: 'compute',
      code: displayCode,
      label: displayName,
      autoRun: true,
    };

    if (playgroundReady) {
      sendToPlayground(payload);
    } else {
      pendingInject = payload;
    }

    // Scroll to playground
    document.getElementById('s10')?.scrollIntoView({ behavior: 'smooth' });
  };

  confirm.addEventListener('click', onConfirm);
  cancel.addEventListener('click', () => {
    preview.style.display = 'none';
    confirm.removeEventListener('click', onConfirm);
  });
}

// ── Preset inject buttons in section 10 ────────────────────────
document.querySelectorAll('.preset-inject-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    injectPreset(btn.dataset.preset);
  });
});

// ── Playground fullscreen toggle ───────────────────────────────
const fsBtn = document.getElementById('playground-fullscreen');
const frameWrap = document.getElementById('playground-frame-wrap');

if (fsBtn && frameWrap) {
  fsBtn.addEventListener('click', () => {
    const isFs = frameWrap.classList.toggle('is-fullscreen');
    fsBtn.textContent = isFs ? '⊡' : '⛶';
    fsBtn.title = isFs ? '退出全屏' : '切换全屏';
    // Lock body scroll when fullscreen
    document.body.style.overflow = isFs ? 'hidden' : '';
  });

  // ESC to exit fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && frameWrap.classList.contains('is-fullscreen')) {
      frameWrap.classList.remove('is-fullscreen');
      fsBtn.textContent = '⛶';
      document.body.style.overflow = '';
    }
  });
}

// ── Playground reload ──────────────────────────────────────────
document.getElementById('playground-reload')?.addEventListener('click', () => {
  if (!iframe) return;
  playgroundReady = false;
  iframeLoading?.classList.remove('hidden');
  iframe.src = iframe.src; // force reload
});
