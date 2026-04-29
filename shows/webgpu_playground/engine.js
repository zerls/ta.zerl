/* ============================================================
   ComputeToy — WebGPU Engine
   Depends on: presets.js (PRESETS)
   ============================================================ */

/* ─── State ─── */
const state = {
  device: null,
  adapter: null,
  context: null,
  swapchainFormat: 'bgra8unorm',

  running:  false,
  paused:   false,
  frame:    0,
  startTime: 0,
  lastTime: 0,
  rafId:    null,

  resolution: 512,
  currentPreset: 'plasma',
  currentTab: 'compute',

  uniformBuffer:  null,
  storageBuffers: [],
  pipeline: { compute: null, render: null },
  bindGroups: { compute: null, render: null },

  uTime: 0, uFrame: 0, uMouse: [0,0],
  uSpeed: 1, uScale: 1, uParam: 0.5,

  fpsHistory: new Array(60).fill(0),
  lastFpsUpdate: 0,

  particlesInitialized: false,
};

/* ─── DOM refs ─── */
const $ = id => document.getElementById(id);
const canvas     = $('gpu-canvas');
const consoleOut = $('console-output');
const fpsCanvas  = $('fps-canvas');

/* ─── Logger ─── */
function log(msg, type='info') {
  const d = new Date();
  const t = d.toLocaleTimeString('en',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const el = document.createElement('div');
  el.className = 'log-line';
  el.innerHTML = `<span class="log-time">[${t}]</span><span class="log-${type}">${msg}</span>`;
  consoleOut.appendChild(el);
  consoleOut.scrollTop = consoleOut.scrollHeight;
}

/* ─── WebGPU Init ─── */
async function initWebGPU() {
  if (!navigator.gpu) {
    $('no-webgpu').style.display = 'flex';
    $('api-badge').className = 'canvas-badge badge-fallback';
    $('api-badge').textContent = 'No WebGPU';
    log('WebGPU not supported. Using editor-only mode.', 'warn');
    return false;
  }

  try {
    state.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!state.adapter) throw new Error('No GPU adapter found');

    state.device = await state.adapter.requestDevice();
    state.device.lost.then(info => {
      log(`GPU device lost: ${info.reason} — ${info.message}`, 'error');
      state.running = false;
    });

    state.context = canvas.getContext('webgpu');
    state.swapchainFormat = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({
      device: state.device,
      format: state.swapchainFormat,
      alphaMode: 'opaque',
    });

    const info = state.adapter.info || { description: 'unknown' };
    const gpuName = info.description || info.device || 'GPU';
    $('gpu-name').textContent = gpuName;
    $('api-badge').className = 'canvas-badge badge-webgpu';
    $('api-badge').textContent = 'WebGPU ✓';
    log(`WebGPU ready — ${gpuName}`, 'ok');
    return true;
  } catch(e) {
    $('no-webgpu').style.display = 'flex';
    $('api-badge').className = 'canvas-badge badge-error';
    $('api-badge').textContent = 'Error';
    log(`WebGPU init error: ${e.message}`, 'error');
    return false;
  }
}

/* ─── Buffer helpers ─── */
function createUniformBuffer() {
  return state.device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createStorageBuffer(sizePixels) {
  return state.device.createBuffer({
    size: sizePixels * 4 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
}

function createParticleBuffer(count) {
  return state.device.createBuffer({
    size: count * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
}

/* ─── Pipeline Build ─── */
async function buildPipeline() {
  const dev = state.device;
  const res = state.resolution;
  const preset = state.currentPreset;
  const codes  = codeStore[preset];

  $('compile-spinner').classList.add('show');
  log(`Compiling shaders for [${preset}] @ ${res}²...`, 'info');

  const hasSecondBuffer  = ['life','reaction'].includes(preset);
  const hasParticleBuffer = preset === 'particles';

  state.storageBuffers.forEach(b => b?.destroy());
  state.storageBuffers = [];
  state.uniformBuffer?.destroy();

  state.uniformBuffer = createUniformBuffer();
  state.storageBuffers.push(createStorageBuffer(res * res));

  if (hasSecondBuffer)   state.storageBuffers.push(createStorageBuffer(res * res));
  if (hasParticleBuffer) state.storageBuffers.push(createParticleBuffer(2048));

  const computeEntries = [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
  ];
  const renderEntries = [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
  ];

  if (state.storageBuffers.length > 1) {
    computeEntries.push({ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } });
    renderEntries.push({ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } });
  }

  const bgLayoutCompute = dev.createBindGroupLayout({ entries: computeEntries });
  const bgLayoutRender  = dev.createBindGroupLayout({ entries: renderEntries });
  const pipelineLayoutCompute = dev.createPipelineLayout({ bindGroupLayouts: [bgLayoutCompute] });
  const pipelineLayoutRender  = dev.createPipelineLayout({ bindGroupLayouts: [bgLayoutRender] });

  const csModule = dev.createShaderModule({ code: codes.compute,  label: 'compute'  });
  const vsModule = dev.createShaderModule({ code: codes.vertex,   label: 'vertex'   });
  const fsModule = dev.createShaderModule({ code: codes.fragment, label: 'fragment' });

  let computeOk = true, renderOk = true;
  for (const [mod, name] of [[csModule,'compute'],[vsModule,'vertex'],[fsModule,'fragment']]) {
    const info = await mod.getCompilationInfo();
    for (const msg of info.messages) {
      const type = msg.type === 'error' ? 'error' : msg.type === 'warning' ? 'warn' : 'info';
      log(`[${name}] line ${msg.lineNum}: ${msg.message}`, type);
      if (msg.type === 'error') {
        if (name === 'compute') computeOk = false;
        else renderOk = false;
      }
    }
  }

  if (!computeOk || !renderOk) {
    log('Pipeline build failed. Fix errors above.', 'error');
    $('api-badge').className = 'canvas-badge badge-error';
    $('api-badge').textContent = 'Compile Error';
    $('compile-spinner').classList.remove('show');
    return false;
  }

  try {
    state.pipeline.compute = dev.createComputePipeline({
      layout: pipelineLayoutCompute,
      compute: { module: csModule, entryPoint: 'CSMain' },
    });
  } catch(e) {
    log(`Compute pipeline error: ${e.message}`, 'error');
    $('compile-spinner').classList.remove('show');
    return false;
  }

  try {
    state.pipeline.render = dev.createRenderPipeline({
      layout: pipelineLayoutRender,
      vertex:   { module: vsModule, entryPoint: 'VSMain' },
      fragment: { module: fsModule, entryPoint: 'FSMain',
                  targets: [{ format: state.swapchainFormat }] },
      primitive: { topology: 'triangle-list' },
    });
  } catch(e) {
    log(`Render pipeline error: ${e.message}`, 'error');
    $('compile-spinner').classList.remove('show');
    return false;
  }

  const bgDataEntries = [
    { binding: 0, resource: { buffer: state.uniformBuffer } },
    { binding: 1, resource: { buffer: state.storageBuffers[0] } },
  ];
  if (state.storageBuffers.length > 1) {
    bgDataEntries.push({ binding: 2, resource: { buffer: state.storageBuffers[1] } });
  }

  state.bindGroups.compute = dev.createBindGroup({ layout: bgLayoutCompute, entries: bgDataEntries });
  state.bindGroups.render  = dev.createBindGroup({ layout: bgLayoutRender,  entries: bgDataEntries });

  if (hasParticleBuffer && !state.particlesInitialized) {
    initParticles(res);
    state.particlesInitialized = true;
  }

  $('dispatch-info').textContent = `${Math.ceil(res/8)}×${Math.ceil(res/8)}×1 groups`;
  log('Pipeline compiled OK ✓', 'ok');
  $('api-badge').className = 'canvas-badge badge-webgpu';
  $('api-badge').textContent = 'WebGPU ✓';
  $('compile-spinner').classList.remove('show');
  return true;
}

function initParticles(res) {
  const N = 2048;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i*4+0] = Math.random() * res;
    data[i*4+1] = Math.random() * res;
    const angle = Math.random() * Math.PI * 2;
    const spd   = 30 + Math.random() * 80;
    data[i*4+2] = Math.cos(angle) * spd;
    data[i*4+3] = Math.sin(angle) * spd;
  }
  state.device.queue.writeBuffer(state.storageBuffers[1], 0, data);
}

/* ─── Uniform upload ─── */
function uploadUniforms() {
  const data = new ArrayBuffer(48);
  const f32  = new Float32Array(data);
  const u32  = new Uint32Array(data);
  f32[0] = state.uTime;
  u32[1] = state.uFrame;
  f32[2] = state.resolution;
  f32[3] = state.resolution;
  f32[4] = state.uMouse[0];
  f32[5] = state.uMouse[1];
  f32[6] = state.uSpeed;
  f32[7] = state.uScale;
  f32[8] = state.uParam;
  f32[9] = 0;
  state.device.queue.writeBuffer(state.uniformBuffer, 0, data);
}

/* ─── Render loop ─── */
function renderFrame(ts) {
  if (!state.running) return;

  const now = ts / 1000;
  const dt  = now - state.lastTime;
  state.lastTime = now;

  if (!state.paused) {
    state.uTime  = now - state.startTime;
    state.uFrame++;
  }

  uploadUniforms();

  const dev = state.device;
  const cmd = dev.createCommandEncoder();
  const res = state.resolution;

  let dispX = Math.ceil(res / 8);
  let dispY = Math.ceil(res / 8);
  if (state.currentPreset === 'reduce') {
    dispX = Math.ceil(res / 64); dispY = 1;
  }
  if (state.currentPreset === 'particles') {
    dispX = Math.ceil(Math.max(2048, res*res) / 64);
    dispY = 1;
  }

  const cp = cmd.beginComputePass({ label: 'compute' });
  cp.setPipeline(state.pipeline.compute);
  cp.setBindGroup(0, state.bindGroups.compute);
  cp.dispatchWorkgroups(dispX, dispY, 1);
  cp.end();

  const view = state.context.getCurrentTexture().createView();
  const rp = cmd.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp:  'clear',
      clearValue: { r:0, g:0, b:0, a:1 },
      storeOp: 'store',
    }]
  });
  rp.setPipeline(state.pipeline.render);
  rp.setBindGroup(0, state.bindGroups.render);
  rp.draw(3);
  rp.end();

  dev.queue.submit([cmd.finish()]);

  $('stat-frame').textContent = state.uFrame;
  $('stat-time').textContent  = state.uTime.toFixed(2);
  $('uv-time').textContent    = state.uTime.toFixed(2);
  $('uv-frame').textContent   = state.uFrame;

  updateFPS(dt);
  state.rafId = requestAnimationFrame(renderFrame);
}

function updateFPS(dt) {
  const fps = dt > 0 ? Math.round(1/dt) : 0;
  state.fpsHistory.push(fps);
  state.fpsHistory.shift();

  const now = performance.now();
  if (now - state.lastFpsUpdate > 250) {
    state.lastFpsUpdate = now;
    const avg = Math.round(state.fpsHistory.reduce((a,b)=>a+b,0)/state.fpsHistory.length);
    $('fps-display').textContent = avg + ' fps';

    const fc = fpsCanvas;
    const ctx = fc.getContext('2d');
    const W = fc.offsetWidth; const H = fc.offsetHeight;
    fc.width = W; fc.height = H;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#060810';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(30,37,56,0.8)';
    ctx.lineWidth = 1;
    for (let y=0; y<H; y+=H/4) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    const max = 144;
    ctx.beginPath();
    ctx.strokeStyle = '#39ff8e';
    ctx.lineWidth = 1.5;
    state.fpsHistory.forEach((v,i) => {
      const x = (i / state.fpsHistory.length) * W;
      const y = H - (v/max)*H;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    ctx.fillStyle = 'rgba(57,255,142,0.07)';
    ctx.fill();
  }
}

/* ─── Buffer peek ─── */
let peekInterval = null;
function startBufferPeek() {
  if (peekInterval) clearInterval(peekInterval);
  peekInterval = setInterval(async () => {
    if (!state.running || !state.storageBuffers[0]) return;
    const readBuf = state.device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const cmd = state.device.createCommandEncoder();
    cmd.copyBufferToBuffer(state.storageBuffers[0], 0, readBuf, 0, 16*4);
    state.device.queue.submit([cmd.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const arr = new Float32Array(readBuf.getMappedRange());
    let html = '';
    for (let i = 0; i < 4; i++) {
      const r=arr[i*4].toFixed(2), g=arr[i*4+1].toFixed(2), b=arr[i*4+2].toFixed(2);
      html += `px[${i}] = <span>(${r}, ${g}, ${b})</span>\n`;
    }
    $('buf-preview').innerHTML = html;
    readBuf.unmap();
    readBuf.destroy();
  }, 1000);
}

/* ─── Run / Stop ─── */
async function runShader() {
  if (state.running) stopShader();
  saveCurrentTab();

  if (!state.device) {
    const ok = await initWebGPU();
    if (!ok) return;
  }

  const res = state.resolution;
  canvas.width = res; canvas.height = res;
  $('canvas-res').textContent = `${res} × ${res}`;
  state.context.configure({
    device: state.device,
    format: state.swapchainFormat,
    alphaMode: 'opaque',
  });

  const ok = await buildPipeline();
  if (!ok) return;

  state.running = true;
  state.frame   = 0;
  state.uFrame  = 0;
  state.startTime = performance.now() / 1000 - state.uTime;
  state.lastTime  = performance.now() / 1000;

  $('btn-run').classList.add('running');
  $('btn-run').textContent = '↺ Running';

  startBufferPeek();
  state.rafId = requestAnimationFrame(renderFrame);
  log(`Started [${state.currentPreset}]`, 'ok');
}

function stopShader() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  $('btn-run').classList.remove('running');
  $('btn-run').textContent = '▶ Run';
  if (peekInterval) { clearInterval(peekInterval); peekInterval = null; }
  log('Stopped.', 'warn');
}
