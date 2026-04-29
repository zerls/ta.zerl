/* ============================================================
   ComputeToy — UI & Controls
   Depends on: engine.js (state, $, log, runShader, stopShader)
               presets.js (PRESETS)
   ============================================================ */

/* ─── Editor DOM refs ─── */
const codeEditor = $('code-editor');
const lineNums   = $('line-numbers');
const codeHighlight = $('code-highlight');
const highlightCode = codeHighlight.querySelector('code');

/* ─── Per-preset, per-tab code storage ─── */
const codeStore = {};

function initCodeStore() {
  for (const key of Object.keys(PRESETS)) {
    codeStore[key] = {
      compute:  PRESETS[key].compute,
      vertex:   PRESETS[key].vertex,
      fragment: PRESETS[key].fragment,
    };
  }
}

/* ─── Syntax highlighting ─── */
function updateHighlight() {
  highlightCode.textContent = codeEditor.value;
  if (typeof hljs !== 'undefined') {
    // 必须删除 highlight.js 留下的标记，否则它会拒绝重新渲染
    delete highlightCode.dataset.highlighted; 
    hljs.highlightElement(highlightCode);
  }
}

/* ─── Editor: line numbers ─── */
function updateLineNumbers() {
  const lines = codeEditor.value.split('\n').length;
  const activeLine = codeEditor.value.substr(0, codeEditor.selectionStart).split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    html += `<span class="ln${i===activeLine?' active-line':''}">${i}</span>`;
  }
  lineNums.innerHTML = html;
  lineNums.scrollTop = codeEditor.scrollTop;
}

codeEditor.addEventListener('input',  () => { updateLineNumbers(); updateHighlight(); });
codeEditor.addEventListener('scroll', () => {
  lineNums.scrollTop = codeEditor.scrollTop;
  codeHighlight.scrollTop = codeEditor.scrollTop;
  codeHighlight.scrollLeft = codeEditor.scrollLeft;
});
codeEditor.addEventListener('click',  updateLineNumbers);
codeEditor.addEventListener('keyup',  updateLineNumbers);

// Tab key → 4 spaces
codeEditor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = codeEditor.selectionStart;
    const v = codeEditor.value;
    codeEditor.value = v.slice(0,s) + '    ' + v.slice(codeEditor.selectionEnd);
    codeEditor.selectionStart = codeEditor.selectionEnd = s + 4;
    updateLineNumbers();
    updateHighlight();
  }
});

/* ─── Preset + Tab switching ─── */
function loadPreset(name) {
  state.currentPreset = name;
  state.particlesInitialized = false;
  loadTab(state.currentTab);
  document.querySelectorAll('.preset-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.preset === name);
  });
}

function loadTab(tab) {
  state.currentTab = tab;
  codeEditor.value = codeStore[state.currentPreset][tab] || '';
  updateLineNumbers();
  updateHighlight();
  document.querySelectorAll('.editor-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.etab === tab);
  });
}

function saveCurrentTab() {
  codeStore[state.currentPreset][state.currentTab] = codeEditor.value;
}

document.querySelectorAll('.preset-tab').forEach(t => {
  t.addEventListener('click', () => { saveCurrentTab(); loadPreset(t.dataset.preset); });
});
document.querySelectorAll('.editor-tab').forEach(t => {
  t.addEventListener('click', () => { saveCurrentTab(); loadTab(t.dataset.etab); });
});

/* ─── Run / Stop buttons ─── */
$('btn-run').addEventListener('click', runShader);
$('btn-stop').addEventListener('click', stopShader);

/* ─── Canvas controls ─── */
$('btn-pause-play').addEventListener('click', () => {
  state.paused = !state.paused;
  $('btn-pause-play').textContent = state.paused ? '▶ Play' : '❚❚ Pause';
  $('btn-pause-play').classList.toggle('active', state.paused);
});

$('btn-reset-time').addEventListener('click', () => {
  state.uTime = 0;
  state.uFrame = 0;
  state.startTime = performance.now() / 1000;
  log('Time reset to 0', 'info');
});

$('btn-snapshot').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `computetoy_${state.currentPreset}_f${state.uFrame}.png`;
  a.click();
  log('Snapshot saved ✓', 'ok');
});

$('res-select').addEventListener('change', e => {
  state.resolution = parseInt(e.target.value);
  if (state.running) runShader();
});

/* ─── Uniform sliders ─── */
$('sl-speed').addEventListener('input', e => {
  state.uSpeed = parseFloat(e.target.value);
  $('uv-speed').textContent = state.uSpeed.toFixed(2);
});
$('sl-scale').addEventListener('input', e => {
  state.uScale = parseFloat(e.target.value);
  $('uv-scale').textContent = state.uScale.toFixed(2);
});
$('sl-param').addEventListener('input', e => {
  state.uParam = parseFloat(e.target.value);
  $('uv-param').textContent = state.uParam.toFixed(3);
});

/* ─── Mouse tracking ─── */
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width  * state.resolution;
  const y = (e.clientY - rect.top)  / rect.height * state.resolution;
  state.uMouse = [x, y];
  $('uv-mouse').textContent = `${Math.round(x)},${Math.round(y)}`;
  $('mouse-pos').textContent = `mouse: ${Math.round(x)}, ${Math.round(y)}`;
});

/* ─── Console clear ─── */
$('console-clear').addEventListener('click', () => { consoleOut.innerHTML = ''; });

/* ─── Panel resize (horizontal) ─── */
const resizeHandle = $('resize-handle');
let resizing = false;
resizeHandle.addEventListener('mousedown', () => {
  resizing = true;
  resizeHandle.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!resizing) return;
  const panel = $('editor-panel');
  const main  = $('main');
  const rect  = main.getBoundingClientRect();
  const newW  = Math.max(240, Math.min(e.clientX - rect.left, rect.width - 240));
  panel.style.width = newW + 'px';
});
document.addEventListener('mouseup', () => {
  if (!resizing) return;
  resizing = false;
  resizeHandle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

/* ─── Console resize (vertical) ─── */
const consoleResize = $('console-resize');
let consoleResizing = false, consoleStartY = 0, consoleStartH = 0;
consoleResize.addEventListener('mousedown', e => {
  consoleResizing = true;
  consoleStartY = e.clientY;
  consoleStartH = $('console-panel').offsetHeight;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!consoleResizing) return;
  const delta = consoleStartY - e.clientY;
  const newH  = Math.max(60, Math.min(consoleStartH + delta, 400));
  $('console-panel').style.height = newH + 'px';
});
document.addEventListener('mouseup', () => {
  if (!consoleResizing) return;
  consoleResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

/* ─── Keyboard shortcuts ─── */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault(); runShader();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '.') {
    e.preventDefault(); stopShader();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentTab();
    log('Code saved (Ctrl+S). Press Ctrl+Enter to run.', 'info');
  }
});

/* ─── Tooltips ─── */
const tooltip = $('tooltip');
function addTooltip(el, text) {
  el.addEventListener('mouseenter', () => {
    tooltip.textContent = text;
    tooltip.classList.add('show');
  });
  el.addEventListener('mousemove', e => {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top  = (e.clientY - 8 ) + 'px';
  });
  el.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
}
addTooltip($('btn-run'),        'Run shader  [Ctrl+Enter]');
addTooltip($('btn-stop'),       'Stop  [Ctrl+.]');
addTooltip($('btn-snapshot'),   'Save PNG screenshot');
addTooltip($('btn-reset-time'), 'Reset iTime to 0');

/* ─── postMessage receiver (code injection from parent notes page) ─── */
window.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'computetoy-inject') return;

  if (msg.preset && PRESETS[msg.preset]) {
    saveCurrentTab();
    state.currentPreset = msg.preset;
    state.particlesInitialized = false;
    codeStore[msg.preset] = {
      compute:  PRESETS[msg.preset].compute,
      vertex:   PRESETS[msg.preset].vertex,
      fragment: PRESETS[msg.preset].fragment,
    };
    document.querySelectorAll('.preset-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.preset === msg.preset);
    });
  }

  const targetTab = msg.tab || 'compute';
  if (msg.code) {
    codeStore[state.currentPreset][targetTab] = msg.code;
  }

  loadTab(targetTab);
  log(`⬇ Injected from notes: "${msg.label || msg.preset}"`, 'ok');
  log('Press Ctrl+Enter or click ▶ Run to execute.', 'info');

  if (msg.autoRun) await runShader();

  try { e.source?.postMessage({ type: 'computetoy-ready' }, '*'); } catch(_){}
});

/* ─── Init ─── */
(async function init() {
  initCodeStore();
  loadPreset('plasma');
  loadTab('compute');

  log('ComputeToy ready. Select a preset and press ▶ Run.', 'ok');
  log('Keyboard: Ctrl+Enter = Run | Ctrl+. = Stop | Ctrl+S = Save code', 'info');
  log('Tip: Edit any WGSL shader and Ctrl+Enter to hot-reload.', 'info');

  const ok = await initWebGPU();
  if (ok) await runShader();

  try { window.parent?.postMessage({ type: 'computetoy-ready' }, '*'); } catch(_){}
})();
