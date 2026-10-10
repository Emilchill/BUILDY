/* Visor 3D (three.js, global THREE): cámara orbital, malla y rejilla. */
import {makeNoise} from '../textures/atlas.js';
export class Viewer{
  constructor(canvas,box){
    const T=this.T=window.THREE;this.box=box;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.scene=new T.Scene();this.cam=new T.PerspectiveCamera(50,1,.1,4000);
    this.mat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,alphaTest:.5});
    this.th=.8;this.ph=1.05;this.dist=20;this.tgt=new T.Vector3();this.auto=false;
    this.noise=makeNoise();this.cache=new WeakMap();this.mesh=null;this.grid=null;
    this.#controls(canvas);
    new ResizeObserver(()=>this.resize()).observe(box);this.resize();
    const loop=()=>{requestAnimationFrame(loop);if(this.auto)this.th+=.005;this.#place();this.renderer.render(this.scene,this.cam)};loop();
  }
  resize(){const w=this.box.clientWidth,h=this.box.clientHeight;this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);this.cam.aspect=w/Math.max(h,1);this.cam.updateProjectionMatrix()}
  #place(){const c=this.cam,t=this.tgt;c.position.set(t.x+this.dist*Math.sin(this.ph)*Math.sin(this.th),t.y+this.dist*Math.cos(this.ph),t.z+this.dist*Math.sin(this.ph)*Math.cos(this.th));c.lookAt(t);c.updateMatrixWorld()}
  #controls(cv){
    const T=this.T,ptr=new Map();
    cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,e)});
    cv.addEventListener('pointerup',e=>ptr.delete(e.pointerId));cv.addEventListener('pointercancel',e=>ptr.delete(e.pointerId));
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    cv.addEventListener('pointermove',e=>{
      const o=ptr.get(e.pointerId);if(!o)return;const dx=e.clientX-o.clientX,dy=e.clientY-o.clientY;
      if(ptr.size==2){const [a,b]=[...ptr.values()],d0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);ptr.set(e.pointerId,e);const [c,d]=[...ptr.values()],d1=Math.hypot(c.clientX-d.clientX,c.clientY-d.clientY);this.dist=Math.max(2,this.dist*d0/Math.max(d1,1));return}
      ptr.set(e.pointerId,e);
      if(e.shiftKey||e.buttons==2){const s=this.dist*.0015,r=new T.Vector3().setFromMatrixColumn(this.cam.matrix,0),u=new T.Vector3().setFromMatrixColumn(this.cam.matrix,1);this.tgt.addScaledVector(r,-dx*s).addScaledVector(u,dy*s)}
      else{this.th-=dx*.008;this.ph=Math.min(3.05,Math.max(.08,this.ph-dy*.008))}
    });
    cv.addEventListener('wheel',e=>{e.preventDefault();this.dist=Math.max(2,this.dist*(1+Math.sign(e.deltaY)*.1))},{passive:false});
  }
  texFor(canvas){let t=this.cache.get(canvas);if(!t){t=new this.T.CanvasTexture(canvas);t.magFilter=t.minFilter=this.T.NearestFilter;this.cache.set(canvas,t)}return t}
  /* g = salida de buildGeometry; canvas = atlas (o null para colores lisos) */
  setMesh(g,canvas){
    const T=this.T;if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose()}
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(g.pos,3));geo.setAttribute('color',new T.BufferAttribute(g.col,3));geo.setAttribute('uv',new T.BufferAttribute(g.uv,2));
    geo.setIndex(new T.BufferAttribute(g.idx,1));
    this.mat.map=this.texFor(canvas||this.noise);this.mat.needsUpdate=true;
    this.mesh=new T.Mesh(geo,this.mat);this.scene.add(this.mesh);
  }
  fit(M){
    const T=this.T;this.tgt.set(M.W/2,M.H/2,M.L/2);this.dist=Math.max(M.W,M.H,M.L)*1.8+4;
    if(this.grid){this.scene.remove(this.grid)}
    const gs=Math.max(M.W,M.L)+6;this.grid=new T.GridHelper(gs,gs,0x888888,0x888888);
    this.grid.position.set(M.W/2,-.01,M.L/2);this.grid.material.opacity=.35;this.grid.material.transparent=true;this.scene.add(this.grid);
  }
}
