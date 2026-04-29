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

/* ============================================================
   Playground Integration — script.js extension
   ============================================================ */

// ── Preset WGSL code map (mirrors playground presets) ──────────
const PLAYGROUND_PRESETS = {
  plasma: {
    label: 'Plasma Field',
    tab: 'compute',
    code: `// Plasma field — classic demo effect via Compute Shader
struct Uniforms {
  iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f,
  uSpeed:f32, uScale:f32, uParam:f32, _pad:f32,
}
@group(0) @binding(0) var<uniform>           u  : Uniforms;
@group(0) @binding(1) var<storage,read_write> buf: array<vec4f>;

fn plasma(p:vec2f, t:f32)->vec4f {
  let q = p * u.uScale * 0.012;
  var v = sin(q.x+t)+sin(q.y+t*0.7)+sin((q.x+q.y)+t*0.5);
  let cx=q.x+0.5*sin(t*0.3); let cy=q.y+0.5*cos(t*0.4);
  v += sin(sqrt(cx*cx+cy*cy+1.0)+t);
  v = v*0.25+0.5;
  let r=sin(v*6.28+t*u.uParam*3.0)*0.5+0.5;
  let g=sin(v*6.28+2.094+t*u.uParam*2.0)*0.5+0.5;
  let b=sin(v*6.28+4.189)*0.5+0.5;
  return vec4f(r,g,b,1.0);
}
@compute @workgroup_size(8,8,1)
fn CSMain(@builtin(global_invocation_id) gid:vec3u) {
  let res=vec2u(u32(u.iResolution.x),u32(u.iResolution.y));
  if(gid.x>=res.x||gid.y>=res.y){return;}
  buf[gid.y*res.x+gid.x]=plasma(vec2f(f32(gid.x),f32(gid.y)),u.iTime*u.uSpeed);
}`
  },
  particles: {
    label: 'GPU Particles',
    tab: 'compute',
    code: `// 2048-particle GPU simulation with swirl attractor
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
struct Particle{pos:vec2f,vel:vec2f}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read_write>buf:array<vec4f>;
@group(0)@binding(2)var<storage,read_write>parts:array<Particle>;
const N=2048u;
@compute @workgroup_size(64,1,1)
fn CSMain(@builtin(global_invocation_id)gid:vec3u){
  let res=vec2u(u32(u.iResolution.x),u32(u.iResolution.y));
  if(gid.x<N){
    let i=gid.x; var p=parts[i]; let dt=0.016*u.uSpeed;
    if(u.uParam>0.5){let d=u.iMouse-p.pos;let dist=max(length(d),10.0);p.vel+=normalize(d)*(500.0/(dist*dist))*dt;}
    let tc=p.pos-u.iResolution*0.5;
    p.vel+=vec2f(-tc.y,tc.x)*0.0003*u.uScale*dt*60.0;
    p.vel*=0.985; let spd=length(p.vel); if(spd>300.0){p.vel=normalize(p.vel)*300.0;}
    p.pos+=p.vel*dt; p.pos=((p.pos%u.iResolution)+u.iResolution)%u.iResolution; parts[i]=p;
  }
  if(gid.x<res.x*res.y){buf[gid.x]=vec4f(0.0)*0.88+buf[gid.x]*0.12;}
  storageBarrier();
  if(gid.x<N){
    let i=gid.x; let px=vec2u(u32(parts[i].pos.x)%res.x,u32(parts[i].pos.y)%res.y);
    let age=f32(i)/f32(N);
    buf[px.y*res.x+px.x]=vec4f(sin(age*6.28+u.iTime)*0.5+0.5,cos(age*6.28+u.iTime*0.7)*0.5+0.5,sin(age*3.14+u.iTime*1.3+1.0)*0.5+0.5,1.0);
  }
}`
  },
  life: {
    label: 'Game of Life',
    tab: 'compute',
    code: `// Conway's Game of Life — double-buffered pingpong
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>U:Uniforms;
@group(0)@binding(1)var<storage,read_write>bufA:array<vec4f>;
@group(0)@binding(2)var<storage,read_write>bufB:array<vec4f>;
fn getCell(buf:ptr<storage,array<vec4f>,read_write>,x:i32,y:i32,W:i32,H:i32)->f32{
  return (*buf)[u32(((y%H+H)%H)*W+((x%W+W)%W))].r;
}
@compute @workgroup_size(8,8)
fn CSMain(@builtin(global_invocation_id)gid:vec3u){
  let W=i32(U.iResolution.x);let H=i32(U.iResolution.y);
  if(i32(gid.x)>=W||i32(gid.y)>=H){return;}
  let x=i32(gid.x);let y=i32(gid.y);
  if(U.iFrame==0u){
    let h=fract(sin(f32(x*7+y*13))*43758.5);
    bufA[u32(y*W+x)]=vec4f(select(0.0,1.0,h>0.55));bufB[u32(y*W+x)]=vec4f(0.0);return;
  }
  let freq=max(1u,u32(8.0/max(U.uSpeed,0.1)));
  let parity=(U.iFrame/freq)%2u;
  var n=0.0;var alive:f32;
  if(parity==0u){
    alive=getCell(&bufA,x,y,W,H);
    for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){if(dx==0&&dy==0){continue;}n+=getCell(&bufA,x+dx,y+dy,W,H);}}
    if((U.iFrame%freq)==0u){let na=select(0.0,1.0,(alive==0.0&&n==3.0)||(alive==1.0&&(n==2.0||n==3.0)));bufB[u32(y*W+x)]=select(bufA[u32(y*W+x)]*0.6,vec4f(0.1,1.0,0.5,1.0),na>0.5);}
    else{bufB[u32(y*W+x)]=bufA[u32(y*W+x)];}
  }else{
    alive=getCell(&bufB,x,y,W,H);
    for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){if(dx==0&&dy==0){continue;}n+=getCell(&bufB,x+dx,y+dy,W,H);}}
    if((U.iFrame%freq)==0u){let na=select(0.0,1.0,(alive==0.0&&n==3.0)||(alive==1.0&&(n==2.0||n==3.0)));bufA[u32(y*W+x)]=select(bufB[u32(y*W+x)]*0.6,vec4f(0.1,1.0,0.5,1.0),na>0.5);}
    else{bufA[u32(y*W+x)]=bufB[u32(y*W+x)];}
  }
}`
  },
  mandelbrot: {
    label: 'Mandelbrot Set',
    tab: 'compute',
    code: `// Mandelbrot — smooth colouring + auto-zoom
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read_write>buf:array<vec4f>;
fn mandelbrot(c:vec2f)->f32{
  var z=vec2f(0.0);var i=0;
  loop{if(i>=256||dot(z,z)>4.0){break;}z=vec2f(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c;i++;}
  if(i==256){return 0.0;}
  return f32(i)-log2(log2(dot(z,z))*0.5)+4.0;
}
fn palette(t:f32)->vec3f{
  return vec3f(0.5)+vec3f(0.5)*cos(6.28318*(vec3f(1.0)*t+vec3f(0.0,0.1,0.2)));
}
@compute @workgroup_size(8,8)
fn CSMain(@builtin(global_invocation_id)gid:vec3u){
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  if(gid.x>=W||gid.y>=H){return;}
  let uv=(vec2f(f32(gid.x),f32(gid.y))-u.iResolution*0.5)/f32(H);
  let zoom=pow(0.5,(u.uScale-1.0)*3.0+u.iTime*u.uSpeed*0.05);
  let c=uv*zoom*2.5+vec2f(-0.7269,0.1889);
  let n=mandelbrot(c);
  let col=select(palette(fract(n/256.0+u.uParam+u.iTime*u.uSpeed*0.01)),vec3f(0.0),n==0.0);
  buf[gid.y*W+gid.x]=vec4f(pow(col,vec3f(0.4545)),1.0);
}`
  },
  reaction: {
    label: 'Reaction-Diffusion',
    tab: 'compute',
    code: `// Gray-Scott Reaction-Diffusion
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>U:Uniforms;
@group(0)@binding(1)var<storage,read_write>bufA:array<vec4f>;
@group(0)@binding(2)var<storage,read_write>bufB:array<vec4f>;
fn gc(buf:ptr<storage,array<vec4f>,read_write>,x:i32,y:i32,W:i32,H:i32)->vec2f{
  return (*buf)[u32(((y%H+H)%H)*W+((x%W+W)%W))].rg;
}
@compute @workgroup_size(8,8)
fn CSMain(@builtin(global_invocation_id)gid:vec3u){
  let W=i32(U.iResolution.x);let H=i32(U.iResolution.y);
  if(i32(gid.x)>=W||i32(gid.y)>=H){return;}
  let x=i32(gid.x);let y=i32(gid.y);
  if(U.iFrame==0u){
    let inside=abs(x-W/2)<20&&abs(y-H/2)<20;
    let c=select(vec2f(1.0,0.0),vec2f(0.5,0.25),inside);
    bufA[u32(y*W+x)]=vec4f(c,0.0,1.0);bufB[u32(y*W+x)]=vec4f(c,0.0,1.0);return;
  }
  let f=0.055+U.uParam*0.01;let k=0.062+U.uScale*0.006;
  let par=U.iFrame%2u;
  var uvc:vec2f;var lap=vec2f(0.0);
  if(par==0u){uvc=gc(&bufA,x,y,W,H);lap+=gc(&bufA,x-1,y,W,H)*0.2+gc(&bufA,x+1,y,W,H)*0.2+gc(&bufA,x,y-1,W,H)*0.2+gc(&bufA,x,y+1,W,H)*0.2+gc(&bufA,x-1,y-1,W,H)*0.05+gc(&bufA,x+1,y-1,W,H)*0.05+gc(&bufA,x-1,y+1,W,H)*0.05+gc(&bufA,x+1,y+1,W,H)*0.05-uvc;}
  else{uvc=gc(&bufB,x,y,W,H);lap+=gc(&bufB,x-1,y,W,H)*0.2+gc(&bufB,x+1,y,W,H)*0.2+gc(&bufB,x,y-1,W,H)*0.2+gc(&bufB,x,y+1,W,H)*0.2+gc(&bufB,x-1,y-1,W,H)*0.05+gc(&bufB,x+1,y-1,W,H)*0.05+gc(&bufB,x-1,y+1,W,H)*0.05+gc(&bufB,x+1,y+1,W,H)*0.05-uvc;}
  let a=uvc.x;let b=uvc.y;let uvv=a*b*b;
  let na=clamp(a+1.0*lap.x-uvv+f*(1.0-a),0.0,1.0);
  let nb=clamp(b+0.5*lap.y+uvv-(f+k)*b,0.0,1.0);
  let col=vec4f(na,nb,0.3-nb*0.3,1.0);
  if(par==0u){bufB[u32(y*W+x)]=col;}else{bufA[u32(y*W+x)]=col;}
}`
  },
  raycast: {
    label: 'Raycast SDF',
    tab: 'compute',
    code: `// Ray-marching SDF — spheres, soft shadows, mouse camera
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read_write>buf:array<vec4f>;
fn smin(a:f32,b:f32,k:f32)->f32{let h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
fn scene(p:vec3f)->f32{
  let t=u.iTime*u.uSpeed;
  return smin(smin(length(p-vec3f(sin(t)*1.2,0.2+sin(t*1.7)*0.3,cos(t)*1.2))-0.4,length(p-vec3f(cos(t*0.7)*0.8,0.0,sin(t*0.5)*0.8))-0.25,0.3),smin(length(p-vec3f(0.0,sin(t*2.1+1.0)*0.6,0.0))-(0.15+u.uParam*0.3),p.y+0.6,0.1),0.2);
}
fn norm(p:vec3f)->vec3f{let e=vec2f(0.001,0.0);return normalize(vec3f(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));}
fn shadow(ro:vec3f,rd:vec3f)->f32{var r=1.0;var t=0.01;for(var i=0;i<24;i++){let h=scene(ro+rd*t);if(h<0.0001){return 0.0;}r=min(r,8.0*h/t);t+=clamp(h,0.01,0.2);if(t>5.0){break;}}return clamp(r,0.0,1.0);}
@compute @workgroup_size(8,8)
fn CSMain(@builtin(global_invocation_id)gid:vec3u){
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  if(gid.x>=W||gid.y>=H){return;}
  let uv=(vec2f(f32(gid.x),f32(gid.y))-u.iResolution*0.5)/f32(H);
  let mx=(u.iMouse/u.iResolution-0.5)*vec2f(6.28,3.14);
  let d=3.5/u.uScale;let ro=vec3f(sin(mx.x)*d,1.2+mx.y,cos(mx.x)*d);
  let fwd=normalize(-ro);let right=normalize(cross(vec3f(0,1,0),fwd));let up2=cross(fwd,right);
  let rd=normalize(fwd+uv.x*right+uv.y*up2);
  var t=0.0;var hit=false;
  for(var i=0;i<128;i++){let dd=scene(ro+rd*t);if(dd<0.0002){hit=true;break;}if(t>20.0){break;}t+=dd;}
  var col:vec3f;
  if(hit){let p=ro+rd*t;let n=norm(p);let L=normalize(vec3f(0.8,1.5,0.6));let sha=shadow(p+n*0.002,L);let dif=clamp(dot(n,L),0.0,1.0);let spe=pow(clamp(dot(reflect(rd,n),L),0.0,1.0),32.0)*sha;col=mix(vec3f(0.2,0.5,0.9),vec3f(0.9,0.4,0.2),clamp(p.y+0.5,0.0,1.0))*(dif*sha+0.05)+vec3f(0.8)*spe;col=mix(col,vec3f(0.05,0.05,0.1),1.0-exp(-t*0.05));}
  else{col=mix(vec3f(0.05,0.06,0.12),vec3f(0.3,0.5,0.8),clamp(rd.y+0.2,0.0,1.0))+vec3f(1.0,0.8,0.5)*pow(max(dot(rd,normalize(vec3f(0.8,1.5,0.6))),0.0),64.0);}
  buf[gid.y*W+gid.x]=vec4f(pow(col,vec3f(0.4545)),1.0);
}`
  },
  reduce: {
    label: 'Prefix Sum (Scan)',
    tab: 'compute',
    code: `// Parallel Prefix Sum (Blelloch algorithm)
// Demonstrates GroupMemoryBarrierWithGroupSync
struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read_write>buf:array<vec4f>;
const WG:u32=64u;
var<workgroup>shared:array<f32,64>;
@compute @workgroup_size(64,1,1)
fn CSMain(@builtin(global_invocation_id)gid:vec3u,@builtin(local_invocation_id)lid:vec3u,@builtin(workgroup_id)wid:vec3u){
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  let col=lid.x;
  let x=f32(wid.x*WG+col)/f32(W);
  let input=sin(x*6.28318*u.uScale+u.iTime*u.uSpeed)*0.5+0.5;
  shared[col]=input;
  // Up-sweep
  var stride=1u;loop{if(stride>=WG){break;}GroupMemoryBarrierWithGroupSync();if(col%(stride*2u)==(stride*2u-1u)){shared[col]+=shared[col-stride];}stride*=2u;}
  if(col==WG-1u){shared[col]=0.0;}
  // Down-sweep
  stride=WG/2u;loop{if(stride==0u){break;}GroupMemoryBarrierWithGroupSync();if(col%(stride*2u)==(stride*2u-1u)){let tmp=shared[col-stride];shared[col-stride]=shared[col];shared[col]+=tmp;}stride/=2u;}
  GroupMemoryBarrierWithGroupSync();
  let norm=clamp(shared[col]/max(shared[WG-1u]+input,0.001),0.0,1.0);
  let r=clamp(norm*2.0-1.0,0.0,1.0);let g=clamp(1.0-abs(norm-0.5)*2.5,0.0,1.0);let b=clamp(1.0-norm*2.0,0.0,1.0);
  let px_x=wid.x*WG+col;
  if(px_x<W){for(var py=0u;py<H;py++){let dist=abs(f32(py)/f32(H)-(1.0-norm));buf[py*W+px_x]=vec4f(r,g,b,1.0)*(exp(-dist*f32(H)*0.06)*0.8+0.2);}}
}`
  }
};

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
