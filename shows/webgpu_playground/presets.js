/* ============================================================
   ComputeToy — Preset Shaders
   ============================================================ */

const PRESETS = {

plasma: {
  label: 'plasma',
  compute: `// Plasma field — classic demo effect via Compute Shader
// Writes color into a storage texture each frame.

struct Uniforms {
  iTime       : f32,
  iFrame      : u32,
  iResolution : vec2f,
  iMouse      : vec2f,
  uSpeed      : f32,
  uScale      : f32,
  uParam      : f32,
  _pad        : f32,
}

@group(0) @binding(0) var<uniform>           u     : Uniforms;
@group(0) @binding(1) var<storage, read_write> buf  : array<vec4f>;

fn plasma(p: vec2f, t: f32) -> vec4f {
  let q = p * u.uScale * 0.012;
  var v: f32 = 0.0;
  v += sin(q.x + t);
  v += sin(q.y + t * 0.7);
  v += sin((q.x + q.y) + t * 0.5);
  let cx = q.x + 0.5 * sin(t * 0.3);
  let cy = q.y + 0.5 * cos(t * 0.4);
  v += sin(sqrt(cx*cx + cy*cy + 1.0) + t);
  v = v * 0.5 + 0.5;

  let r = sin(v * 3.14159 * 2.0              + t * u.uParam * 3.0);
  let g = sin(v * 3.14159 * 2.0 + 2.094     + t * u.uParam * 2.0);
  let b = sin(v * 3.14159 * 2.0 + 4.189);
  return vec4f(r * 0.5 + 0.5, g * 0.5 + 0.5, b * 0.5 + 0.5, 1.0);
}

@compute @workgroup_size(8, 8, 1)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let res = vec2u(u32(u.iResolution.x), u32(u.iResolution.y));
  if (gid.x >= res.x || gid.y >= res.y) { return; }
  let idx = gid.y * res.x + gid.x;
  let fc = vec2f(f32(gid.x), f32(gid.y));
  let t  = u.iTime * u.uSpeed;
  buf[idx] = plasma(fc, t);
}`,
  vertex: `// Full-screen triangle vertex shader
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex
fn VSMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var pos = array<vec2f,3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
  var out: VSOut;
  out.pos = vec4f(pos[vi], 0.0, 1.0);
  out.uv  = pos[vi] * 0.5 + 0.5;
  return out;
}`,
  fragment: `// Blit compute buffer to screen
struct Uniforms {
  iTime       : f32,
  iFrame      : u32,
  iResolution : vec2f,
  iMouse      : vec2f,
  uSpeed      : f32,
  uScale      : f32,
  uParam      : f32,
  _pad        : f32,
}
@group(0) @binding(0) var<uniform>         u   : Uniforms;
@group(0) @binding(1) var<storage, read>   buf : array<vec4f>;

@fragment
fn FSMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let res = vec2u(u32(u.iResolution.x), u32(u.iResolution.y));
  let px  = vec2u(u32(uv.x * f32(res.x)), u32((uv.y) * f32(res.y)));
  let px_clamped = vec2u(min(px.x, res.x - 1u), min(px.y, res.y - 1u));
  let idx = px_clamped.y * res.x + px_clamped.x;
  return buf[idx];
}`
},

particles: {
  label: 'particles',
  compute: `// GPU particle simulation
// Each particle: pos.xy, vel.xy packed as vec4f

struct Uniforms {
  iTime       : f32,
  iFrame      : u32,
  iResolution : vec2f,
  iMouse      : vec2f,
  uSpeed      : f32,
  uScale      : f32,
  uParam      : f32,
  _pad        : f32,
}

struct Particle {
  pos : vec2f,
  vel : vec2f,
}

@group(0) @binding(0) var<uniform>           u       : Uniforms;
@group(0) @binding(1) var<storage, read_write> buf   : array<vec4f>;
@group(0) @binding(2) var<storage, read_write> parts : array<Particle>;

fn hash(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453);
}

const N_PARTICLES = 2048u;

@compute @workgroup_size(64, 1, 1)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let res = vec2u(u32(u.iResolution.x), u32(u.iResolution.y));

  if (gid.x < N_PARTICLES) {
    let i = gid.x;
    var p = parts[i];
    let dt = 0.016 * u.uSpeed;

    if (u.uParam > 0.5) {
      let toMouse = u.iMouse - p.pos;
      let dist = max(length(toMouse), 10.0);
      p.vel += normalize(toMouse) * (500.0 / (dist * dist)) * dt;
    }

    let center = u.iResolution * 0.5;
    let tc = p.pos - center;
    let swirl = vec2f(-tc.y, tc.x) * 0.0003 * u.uScale;
    p.vel += swirl * dt * 60.0;
    p.vel *= 0.985;

    let spd = length(p.vel);
    if (spd > 300.0) { p.vel = normalize(p.vel) * 300.0; }

    p.pos += p.vel * dt;
    p.pos = ((p.pos % u.iResolution) + u.iResolution) % u.iResolution;
    parts[i] = p;
  }

  if (gid.x < res.x * res.y) {
    buf[gid.x] = vec4f(0.0, 0.0, 0.0, 1.0) * 0.88 + buf[gid.x] * 0.12;
  }

  storageBarrier();

  if (gid.x < N_PARTICLES) {
    let i = gid.x;
    let px = vec2u(u32(parts[i].pos.x) % res.x, u32(parts[i].pos.y) % res.y);
    let idx = px.y * res.x + px.x;
    let age = f32(i) / f32(N_PARTICLES);
    let col = vec4f(
      sin(age * 6.28 + u.iTime) * 0.5 + 0.5,
      cos(age * 6.28 + u.iTime * 0.7) * 0.5 + 0.5,
      sin(age * 3.14 + u.iTime * 1.3 + 1.0) * 0.5 + 0.5,
      1.0
    );
    buf[idx] = col;
  }
}`,
  vertex: `struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn VSMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var pos = array<vec2f,3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
  var o: VSOut; o.pos = vec4f(pos[vi],0,1); o.uv = pos[vi]*.5+.5; return o;
}`,
  fragment: `struct Uniforms { iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f, uSpeed:f32, uScale:f32, uParam:f32, _pad:f32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> buf: array<vec4f>;
@fragment fn FSMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let res = vec2u(u32(u.iResolution.x), u32(u.iResolution.y));
  let px = vec2u(u32(uv.x*f32(res.x)), u32((uv.y)*f32(res.y)));
  let idx = min(px.y,res.y-1u)*res.x + min(px.x,res.x-1u);
  return buf[idx];
}`
},


life: {
  label: 'game of life',
  compute: `// Conway's Game of Life — Compute Shader
// Uses double-buffering via frame parity.
// Cells: 0=dead, 1=alive (stored as f32 in vec4.r)

struct Uniforms {
  iTime       : f32,
  iFrame      : u32,
  iResolution : vec2f,
  iMouse      : vec2f,
  uSpeed      : f32,
  uScale      : f32,
  uParam      : f32,
  _pad        : f32,
}

@group(0) @binding(0) var<uniform>             u    : Uniforms;
@group(0) @binding(1) var<storage, read_write> bufA : array<vec4f>;
@group(0) @binding(2) var<storage, read_write> bufB : array<vec4f>;

fn idx(x: i32, y: i32, W: i32, H: i32) -> u32 {
  let wx = ((x % W) + W) % W;
  let wy = ((y % H) + H) % H;
  return u32(wy * W + wx);
}

fn cell(buf: ptr<storage, array<vec4f>, read_write>, x: i32, y: i32, W: i32, H: i32) -> f32 {
  return (*buf)[idx(x, y, W, H)].r;
}

@compute @workgroup_size(8, 8)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let W = i32(u.iResolution.x);
  let H = i32(u.iResolution.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);

  if (u.iFrame == 0u) {
    let h = fract(sin(f32(x * 7 + y * 13)) * 43758.5);
    let alive = select(0.0, 1.0, h > 0.55);
    bufA[idx(x,y,W,H)] = vec4f(alive, alive, alive, 1.0);
    bufB[idx(x,y,W,H)] = vec4f(0.0);
    return;
  }

  let updateFreq = max(1u, u32(8.0 / max(u.uSpeed, 0.1)));
  let doUpdate   = (u.iFrame % updateFreq) == 0u;
  let parity = (u.iFrame / updateFreq) % 2u;

  var alive: f32;
  var neighbors: f32 = 0.0;

  if (parity == 0u) {
    alive = cell(&bufA, x, y, W, H);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) { continue; }
        neighbors += cell(&bufA, x+dx, y+dy, W, H);
      }
    }
    if (doUpdate) {
      let born    = (alive == 0.0) && (neighbors == 3.0);
      let survive = (alive == 1.0) && (neighbors == 2.0 || neighbors == 3.0);
      let newAlive = select(0.0, 1.0, born || survive);
      let prev = bufA[idx(x,y,W,H)];
      let trail = prev * 0.6;
      bufB[idx(x,y,W,H)] = select(trail, vec4f(0.1,1.0,0.5,1.0), newAlive > 0.5);
    } else {
      bufB[idx(x,y,W,H)] = bufA[idx(x,y,W,H)];
    }
  } else {
    alive = cell(&bufB, x, y, W, H);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) { continue; }
        neighbors += cell(&bufB, x+dx, y+dy, W, H);
      }
    }
    if (doUpdate) {
      let born    = (alive == 0.0) && (neighbors == 3.0);
      let survive = (alive == 1.0) && (neighbors == 2.0 || neighbors == 3.0);
      let newAlive = select(0.0, 1.0, born || survive);
      let prev = bufB[idx(x,y,W,H)];
      let trail = prev * 0.6;
      bufA[idx(x,y,W,H)] = select(trail, vec4f(0.1,1.0,0.5,1.0), newAlive > 0.5);
    } else {
      bufA[idx(x,y,W,H)] = bufB[idx(x,y,W,H)];
    }
  }
}`,
  vertex: `struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn VSMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return VSOut(vec4f(p[vi],0,1), p[vi]*.5+.5);
}`,
  fragment: `struct Uniforms { iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f, uSpeed:f32, uScale:f32, uParam:f32, _pad:f32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> bufA: array<vec4f>;
@group(0) @binding(2) var<storage, read> bufB: array<vec4f>;
@fragment fn FSMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let W = u32(u.iResolution.x); let H = u32(u.iResolution.y);
  let px = vec2u(u32(uv.x*f32(W)), u32((uv.y)*f32(H)));
  let idx = min(px.y,H-1u)*W + min(px.x,W-1u);
  let parity = (u.iFrame / max(1u, u32(8.0/max(u.uSpeed,0.1)))) % 2u;
  return select(bufB[idx], bufA[idx], parity == 0u);
}`
},

mandelbrot: {
  label: 'mandelbrot',
  compute: `// Mandelbrot set — Compute Shader with smooth colouring
// Zoom with uScale, colour shift with uParam

struct Uniforms {
  iTime       : f32,
  iFrame      : u32,
  iResolution : vec2f,
  iMouse      : vec2f,
  uSpeed      : f32,
  uScale      : f32,
  uParam      : f32,
  _pad        : f32,
}

@group(0) @binding(0) var<uniform>             u   : Uniforms;
@group(0) @binding(1) var<storage, read_write> buf : array<vec4f>;

fn mandelbrot(c: vec2f) -> f32 {
  var z = vec2f(0.0);
  var i: i32 = 0;
  let MAX = 256;
  loop {
    if (i >= MAX || dot(z,z) > 4.0) { break; }
    z = vec2f(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    i++;
  }
  if (i == MAX) { return 0.0; }
  let log2z = log2(dot(z,z)) * 0.5;
  return f32(i) - log2(log2z) + 4.0;
}

fn palette(t: f32) -> vec3f {
  let a = vec3f(0.5,0.5,0.5);
  let b = vec3f(0.5,0.5,0.5);
  let c = vec3f(1.0,1.0,1.0);
  let d = vec3f(0.00,0.10,0.20);
  return a + b * cos(6.28318 * (c * t + d));
}

@compute @workgroup_size(8, 8)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let W = u32(u.iResolution.x);
  let H = u32(u.iResolution.y);
  if (gid.x >= W || gid.y >= H) { return; }

  let uv  = (vec2f(f32(gid.x), f32(gid.y)) - u.iResolution * 0.5) / f32(H);
  let zoom = pow(0.5, (u.uScale - 1.0) * 3.0 + u.iTime * u.uSpeed * 0.05);
  let center = vec2f(-0.7269, 0.1889);
  let c = uv * zoom * 2.5 + center;

  let n = mandelbrot(c);
  var col: vec3f;
  if (n == 0.0) {
    col = vec3f(0.0);
  } else {
    let t = n / 256.0 + u.uParam + u.iTime * u.uSpeed * 0.01;
    col = palette(fract(t));
  }

  buf[gid.y * W + gid.x] = vec4f(col, 1.0);
}`,
  vertex: `struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn VSMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return VSOut(vec4f(p[vi],0,1), p[vi]*.5+.5);
}`,
  fragment: `struct Uniforms { iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f, uSpeed:f32, uScale:f32, uParam:f32, _pad:f32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> buf: array<vec4f>;
@fragment fn FSMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let W = u32(u.iResolution.x); let H = u32(u.iResolution.y);
  let px = vec2u(u32(uv.x*f32(W)), u32((uv.y)*f32(H)));
  return buf[min(px.y,H-1u)*W + min(px.x,W-1u)];
}`
},


reaction: {
  label: 'reaction-diff',
  compute: `// Gray-Scott Reaction-Diffusion system
// u, v are chemical concentrations stored as buf.r, buf.g

struct Uniforms {
  iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f,
  uSpeed:f32, uScale:f32, uParam:f32, _pad:f32,
}

@group(0) @binding(0) var<uniform>             U    : Uniforms;
@group(0) @binding(1) var<storage, read_write> bufA : array<vec4f>;
@group(0) @binding(2) var<storage, read_write> bufB : array<vec4f>;

fn getCell(buf: ptr<storage,array<vec4f>,read_write>, x:i32,y:i32,W:i32,H:i32)->vec2f{
  let wx=((x%W)+W)%W; let wy=((y%H)+H)%H;
  let v=(*buf)[u32(wy*W+wx)]; return v.rg;
}

@compute @workgroup_size(8, 8)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let W=i32(U.iResolution.x); let H=i32(U.iResolution.y);
  if(i32(gid.x)>=W||i32(gid.y)>=H){return;}
  let x=i32(gid.x); let y=i32(gid.y);

  if(U.iFrame==0u){
    let cx=W/2; let cy=H/2; let r=20;
    let inside = abs(x-cx)<r && abs(y-cy)<r;
    let c = select(vec2f(1.0,0.0), vec2f(0.5,0.25), inside);
    bufA[u32(y*W+x)] = vec4f(c, 0.0, 1.0);
    bufB[u32(y*W+x)] = vec4f(c, 0.0, 1.0);
    return;
  }

  let dA = 1.0;
  let dB = 0.5;
  let f  = 0.055 + U.uParam * 0.01;
  let k  = 0.062 + U.uScale * 0.006;

  let parity = U.iFrame % 2u;
  var uv_c: vec2f;
  var lap: vec2f = vec2f(0.0);

  if(parity==0u){
    uv_c = getCell(&bufA,x,y,W,H);
    lap += getCell(&bufA,x-1,y,W,H)*0.2;
    lap += getCell(&bufA,x+1,y,W,H)*0.2;
    lap += getCell(&bufA,x,y-1,W,H)*0.2;
    lap += getCell(&bufA,x,y+1,W,H)*0.2;
    lap += getCell(&bufA,x-1,y-1,W,H)*0.05;
    lap += getCell(&bufA,x+1,y-1,W,H)*0.05;
    lap += getCell(&bufA,x-1,y+1,W,H)*0.05;
    lap += getCell(&bufA,x+1,y+1,W,H)*0.05;
    lap -= uv_c;
  } else {
    uv_c = getCell(&bufB,x,y,W,H);
    lap += getCell(&bufB,x-1,y,W,H)*0.2;
    lap += getCell(&bufB,x+1,y,W,H)*0.2;
    lap += getCell(&bufB,x,y-1,W,H)*0.2;
    lap += getCell(&bufB,x,y+1,W,H)*0.2;
    lap += getCell(&bufB,x-1,y-1,W,H)*0.05;
    lap += getCell(&bufB,x+1,y-1,W,H)*0.05;
    lap += getCell(&bufB,x-1,y+1,W,H)*0.05;
    lap += getCell(&bufB,x+1,y+1,W,H)*0.05;
    lap -= uv_c;
  }

  let a = uv_c.x; let b = uv_c.y;
  let uvv = a * b * b;
  let steps = u32(max(1.0, U.uSpeed * 4.0));
  var na=a; var nb=b;
  for(var s=0u;s<steps;s++){
    na = clamp(na + dA*lap.x - uvv + f*(1.0-na), 0.0, 1.0);
    nb = clamp(nb + dB*lap.y + uvv - (f+k)*nb,   0.0, 1.0);
  }

  let col = vec4f(na,nb,0.3-nb*0.3,1.0);
  if(parity==0u){ bufB[u32(y*W+x)]=col; } else { bufA[u32(y*W+x)]=col; }
}`,
  vertex: `struct VSOut{@builtin(position)pos:vec4f,@location(0)uv:vec2f}
@vertex fn VSMain(@builtin(vertex_index)vi:u32)->VSOut{
  var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return VSOut(vec4f(p[vi],0,1),p[vi]*.5+.5);}`,
  fragment: `struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read>bufA:array<vec4f>;
@group(0)@binding(2)var<storage,read>bufB:array<vec4f>;
@fragment fn FSMain(@location(0)uv:vec2f)->@location(0)vec4f{
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  let px=vec2u(u32(uv.x*f32(W)),u32((uv.y)*f32(H)));
  let idx=min(px.y,H-1u)*W+min(px.x,W-1u);
  let col=select(bufB[idx],bufA[idx],(u.iFrame%2u)==0u);
  return vec4f(1.0-col.r, col.g*2.0, col.b+col.r*0.5, 1.0);
}`
},

raycast: {
  label: 'raycast',
  compute: `// Simple 3D ray-marching SDF scene
// Sphere + ground plane, soft shadows

struct Uniforms {
  iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f,
  uSpeed:f32, uScale:f32, uParam:f32, _pad:f32,
}

@group(0) @binding(0) var<uniform>             u   : Uniforms;
@group(0) @binding(1) var<storage, read_write> buf : array<vec4f>;

fn sdSphere(p:vec3f, r:f32)->f32 { return length(p)-r; }
fn sdPlane(p:vec3f, h:f32)->f32  { return p.y - h; }

fn smin(a:f32, b:f32, k:f32)->f32 {
  let h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

fn scene(p:vec3f)->f32 {
  let t = u.iTime * u.uSpeed;
  let s1 = sdSphere(p - vec3f(sin(t)*1.2, 0.2+sin(t*1.7)*0.3, cos(t)*1.2), 0.4);
  let s2 = sdSphere(p - vec3f(cos(t*0.7)*0.8, 0.0, sin(t*0.5)*0.8), 0.25);
  let s3 = sdSphere(p - vec3f(0.0, sin(t*2.1+1.0)*0.6, 0.0), 0.15 + u.uParam*0.3);
  let plane = sdPlane(p, -0.6);
  return smin(smin(smin(s1,s2,0.3),s3,0.2), plane, 0.1);
}

fn calcNormal(p:vec3f)->vec3f {
  let e = vec2f(0.001, 0.0);
  return normalize(vec3f(
    scene(p+e.xyy) - scene(p-e.xyy),
    scene(p+e.yxy) - scene(p-e.yxy),
    scene(p+e.yyx) - scene(p-e.yyx)
  ));
}

fn softShadow(ro:vec3f, rd:vec3f, tmin:f32, tmax:f32)->f32 {
  var res = 1.0; var t = tmin;
  for(var i=0;i<24;i++){
    let h = scene(ro + rd*t);
    if(h < 0.0001){ return 0.0; }
    res = min(res, 8.0*h/t);
    t += clamp(h, 0.01, 0.2);
    if(t > tmax){ break; }
  }
  return clamp(res, 0.0, 1.0);
}

@compute @workgroup_size(8, 8)
fn CSMain(@builtin(global_invocation_id) gid: vec3u) {
  let W = u32(u.iResolution.x); let H = u32(u.iResolution.y);
  if(gid.x>=W||gid.y>=H){return;}

  let uv = (vec2f(f32(gid.x),f32(gid.y)) - u.iResolution*0.5) / f32(H);
  let mx = (u.iMouse / u.iResolution - 0.5) * vec2f(6.28, 3.14);

  let camDist = 3.5 / u.uScale;
  let ro = vec3f(sin(mx.x)*camDist, 1.2 + mx.y, cos(mx.x)*camDist);
  let at = vec3f(0.0, 0.0, 0.0);
  let fwd = normalize(at - ro);
  let right = normalize(cross(vec3f(0,1,0), fwd));
  let up2   = cross(fwd, right);
  let rd    = normalize(fwd + uv.x*right + uv.y*up2);

  var t = 0.0; var hit = false;
  for(var i=0;i<128;i++){
    let d = scene(ro + rd*t);
    if(d < 0.0002){ hit=true; break; }
    if(t > 20.0){ break; }
    t += d;
  }

  var col: vec3f;
  if(hit){
    let p = ro + rd*t;
    let n = calcNormal(p);
    let lig = normalize(vec3f(0.8, 1.5, 0.6));
    let dif = clamp(dot(n, lig), 0.0, 1.0);
    let sha = softShadow(p + n*0.002, lig, 0.01, 5.0);
    let amb = 0.05 + 0.1 * clamp(dot(n, vec3f(0,1,0)), 0.0, 1.0);
    let ref2 = reflect(rd, n);
    let spe = pow(clamp(dot(ref2, lig), 0.0, 1.0), 32.0) * sha;
    let matCol = mix(vec3f(0.2,0.5,0.9), vec3f(0.9,0.4,0.2), clamp(p.y+0.5,0.0,1.0));
    col = matCol * (dif * sha + amb) + vec3f(0.8) * spe;
    col = mix(col, vec3f(0.05,0.05,0.1), 1.0 - exp(-t*0.05));
  } else {
    let sky = mix(vec3f(0.05,0.06,0.12), vec3f(0.3,0.5,0.8), clamp(rd.y+0.2, 0.0, 1.0));
    let sun = pow(max(dot(rd, normalize(vec3f(0.8,1.5,0.6))), 0.0), 64.0);
    col = sky + vec3f(1.0,0.8,0.5)*sun;
  }

  col = pow(col, vec3f(0.4545));
  buf[gid.y*W+gid.x] = vec4f(col, 1.0);
}`,
  vertex: `struct VSOut{@builtin(position)pos:vec4f,@location(0)uv:vec2f}
@vertex fn VSMain(@builtin(vertex_index)vi:u32)->VSOut{
  var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return VSOut(vec4f(p[vi],0,1),p[vi]*.5+.5);}`,
  fragment: `struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read>buf:array<vec4f>;
@fragment fn FSMain(@location(0)uv:vec2f)->@location(0)vec4f{
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  let px=vec2u(u32(uv.x*f32(W)),u32((uv.y)*f32(H)));
  return buf[min(px.y,H-1u)*W+min(px.x,W-1u)];
}`
},

reduce: {
  label: 'prefix-sum',
  compute: `// Parallel Prefix Sum (Scan) — educational Compute Shader
// Demonstrates groupshared memory + GroupMemoryBarrierWithGroupSync
// Visualises the scan result as a colour gradient per row.

struct Uniforms {
  iTime:f32, iFrame:u32, iResolution:vec2f, iMouse:vec2f,
  uSpeed:f32, uScale:f32, uParam:f32, _pad:f32,
}

@group(0) @binding(0) var<uniform>             u   : Uniforms;
@group(0) @binding(1) var<storage, read_write> buf : array<vec4f>;

const WG: u32 = 64u;
var<workgroup> shared: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn CSMain(
  @builtin(global_invocation_id) gid : vec3u,
  @builtin(local_invocation_id)  lid : vec3u,
  @builtin(workgroup_id)         wid : vec3u,
) {
  let W = u32(u.iResolution.x);
  let H = u32(u.iResolution.y);
  let row = wid.x % H;
  let col = lid.x;

  let t = u.iTime * u.uSpeed;
  let x = f32(wid.x * WG + col) / f32(W);
  let input = sin(x * 6.28318 * u.uScale + t) * 0.5 + 0.5;
  shared[col] = input;

  var stride = 1u;
  loop {
    if (stride >= WG) { break; }
    GroupMemoryBarrierWithGroupSync();
    if (col % (stride * 2u) == (stride * 2u - 1u)) {
      shared[col] += shared[col - stride];
    }
    stride *= 2u;
  }

  if (col == WG - 1u) { shared[col] = 0.0; }

  stride = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    GroupMemoryBarrierWithGroupSync();
    if (col % (stride * 2u) == (stride * 2u - 1u)) {
      let tmp    = shared[col - stride];
      shared[col - stride] = shared[col];
      shared[col]         += tmp;
    }
    stride /= 2u;
  }

  GroupMemoryBarrierWithGroupSync();

  let prefixMax = shared[WG - 1u] + input;
  let norm = clamp(shared[col] / max(prefixMax, 0.001), 0.0, 1.0);

  let r = clamp(norm * 2.0 - 1.0, 0.0, 1.0);
  let g = clamp(1.0 - abs(norm - 0.5) * 2.5, 0.0, 1.0);
  let b = clamp(1.0 - norm * 2.0, 0.0, 1.0);

  let px_x = wid.x * WG + col;
  if (px_x < W) {
    let colVec = vec4f(r, g, b, 1.0);
    for (var py = 0u; py < H; py++) {
      let dist = abs(f32(py) / f32(H) - (1.0 - norm));
      let bright = exp(-dist * f32(H) * 0.06) * 0.8 + 0.2;
      buf[py * W + px_x] = colVec * bright;
    }
  }
}`,
  vertex: `struct VSOut{@builtin(position)pos:vec4f,@location(0)uv:vec2f}
@vertex fn VSMain(@builtin(vertex_index)vi:u32)->VSOut{
  var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return VSOut(vec4f(p[vi],0,1),p[vi]*.5+.5);}`,
  fragment: `struct Uniforms{iTime:f32,iFrame:u32,iResolution:vec2f,iMouse:vec2f,uSpeed:f32,uScale:f32,uParam:f32,_pad:f32}
@group(0)@binding(0)var<uniform>u:Uniforms;
@group(0)@binding(1)var<storage,read>buf:array<vec4f>;
@fragment fn FSMain(@location(0)uv:vec2f)->@location(0)vec4f{
  let W=u32(u.iResolution.x);let H=u32(u.iResolution.y);
  let px=vec2u(u32(uv.x*f32(W)),u32((uv.y)*f32(H)));
  return buf[min(px.y,H-1u)*W+min(px.x,W-1u)];
}`
}

}; // end PRESETS
