

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