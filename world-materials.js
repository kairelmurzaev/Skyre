import * as THREE from 'three';

// Paint a small, deterministic texture atlas in the browser; no third-party
// downloads, no account, and no textures that can fail to load on Netlify.
const clamp=x=>Math.max(0,Math.min(255,x));
export function hash01(a,b=0,seed=1){
  let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(seed|0,1442695041))|0;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
}
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
function noise(x,y,seed){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
  return lerp(lerp(hash01(ix,iy,seed),hash01(ix+1,iy,seed),u),
    lerp(hash01(ix,iy+1,seed),hash01(ix+1,iy+1,seed),u),v);
}
function rgb(hex){const h=hex.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
function paint(base,size,fn){
  const c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const image=ctx.createImageData(size,size),color=rgb(base);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const n=(y*size+x)*4,v=fn(x,y,size),delta=typeof v==='number'?[v,v,v]:v;
    image.data[n]=clamp(color[0]+delta[0]);image.data[n+1]=clamp(color[1]+delta[1]);
    image.data[n+2]=clamp(color[2]+delta[2]);image.data[n+3]=255;
  }
  ctx.putImageData(image,0,0);
  return {canvas:c,ctx};
}
function texture(c,repeat=[1,1]){
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  return t;
}
function grain(x,y,size,seed,scale=1){
  return (noise(x/25,y/25,seed)-.5)*21*scale+
    (noise(x/7,y/7,seed+9)-.5)*10*scale+
    (hash01(x,y,seed+12)-.5)*8*scale;
}
function grass(){
  const p=paint('#72965b',256,(x,y,s)=>{
    const n=grain(x,y,s,7,1.45)+13*(noise(x/66,y/66,16)-.5);
    const mark=(hash01(x>>1,y>>1,44)>.98)?12:0;
    return [n-3+mark*.35,n+3+mark,n-8];
  });
  const ctx=p.ctx;
  let seed=101;
  for(let i=0;i<350;i++){
    const x=hash01(i,11,seed)*256,y=hash01(i,17,seed)*256;
    ctx.strokeStyle=i%3===0?'rgba(244,224,146,.20)':'rgba(39,87,49,.14)';
    ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x+(i%3)-1,y-3);ctx.stroke();
  }
  return texture(p.canvas,[2.4,2.4]);
}
function plaster(){
  const p=paint('#e4caa4',256,(x,y,s)=>{
    const n=grain(x,y,s,31,1.35),pat=(noise(x/42,y/42,45)-.5)*16;
    return [n+pat,n+pat*.87,n+pat*.64];
  });
  return texture(p.canvas,[1.15,1.15]);
}
function wood(){
  const p=paint('#8d6146',256,(x,y,s)=>{
    const axis=Math.sin(y*.19+7*noise(x/78,y/46,54));
    const grains=axis*10+Math.sin(y*.76+x*.02)*4+grain(x,y,s,77,.6);
    const knot=Math.max(0,1-Math.hypot((x-155)/22,(y-120)/33))*-15;
    return [grains+knot,grains*.78+knot,grains*.61+knot];
  });
  return texture(p.canvas,[1.35,1.35]);
}
function roof(){
  const p=paint('#a8604a',256,(x,y,s)=>{
    const cols=6,rows=8,w=s/cols,h=s/rows,row=Math.floor(y/h),offset=(row%2)*w*.5;
    const tx=((x+offset)%w+w)%w,ty=y%h;
    const seam=tx<2.2||ty<3.2;
    const shading=Math.sin((ty/h)*Math.PI)*7;
    const variation=(hash01(Math.floor((x+offset)/w),row,12)-.5)*32;
    const n=grain(x,y,s,100,.7)+variation+shading-(seam?37:0);
    return [n,n*.78,n*.64];
  });
  return texture(p.canvas,[1.35,1.7]);
}
function stone(){
  const p=paint('#aaa69a',256,(x,y,s)=>{
    const rows=7,h=s/rows,row=Math.floor(y/h);
    const col=((Math.floor((x+(row%2)*22)/48))|0),cy=y%h,cx=(x+(row%2)*22)%48;
    const seam=(cx<2||cy<3),color=(hash01(col,row,91)-.5)*25;
    const n=grain(x,y,s,85,1.1)+color-(seam?29:0);
    return [n+1,n,n-3];
  });
  return texture(p.canvas,[1.5,1.3]);
}
function soil(){
  const p=paint('#705039',256,(x,y,s)=>{
    const furrow=Math.sin(x*.17+Math.sin(y*.1))*8;
    const grit=(hash01(x,y,777)>.977)?25:0;
    const n=grain(x,y,s,92,1.6)+furrow+grit;
    return [n+1,n-1,n-3];
  });
  return texture(p.canvas,[1.6,1.5]);
}
function water(){
  const p=paint('#428ca5',256,(x,y,s)=>{
    const w=Math.sin(x*.085+y*.045+Math.sin(y*.032)*3)*7+
      Math.sin(y*.13-x*.034)*7;
    const n=grain(x,y,s,181,.65)+w;
    return [n-2,n+4,n+9];
  });
  return texture(p.canvas,[3.2,3.2]);
}
function sand(){
  const p=paint('#d4c193',256,(x,y,s)=>grain(x,y,s,23,1.3));
  return texture(p.canvas,[1.3,1.3]);
}
export function createWorldMaterials(){
  const material=(color,roughness=.9,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const textured=(map,roughness=.94)=>new THREE.MeshStandardMaterial({map,roughness});
  return {
    grass:textured(grass(),1),
    plaster:textured(plaster(),1),
    whitePlaster:textured(plaster(),1),
    wood:textured(wood(),.92),
    darkWood:material('#5b392d',.92),
    roof:textured(roof(),.94),
    roofDark:material('#764d42',.94),
    stone:textured(stone(),.98),
    stoneLight:material('#c5bfb1',.97),
    soil:textured(soil(),1),
    water:textured(water(),.25),
    sand:textured(sand(),1),
    pane:new THREE.MeshPhysicalMaterial({color:'#a9d9d1',metalness:.08,roughness:.12,clearcoat:.65,emissive:'#3d7978',emissiveIntensity:.08}),
    glow:new THREE.MeshStandardMaterial({color:'#ffe5a5',emissive:'#ffc96a',emissiveIntensity:.48,roughness:.45}),
    foliage:[material('#477e4b'),material('#5b965b'),material('#75aa69'),material('#9dbb77')],
    blossom:[material('#e7a9bd'),material('#f2cad3'),material('#f2e2ab')],
    bark:textured(wood(),1),
    leafStem:material('#527447'),
    flowerStem:material('#638746'),
    sky:material('#cbd9dd'),
    white:material('#f6edcd'),
    metal:material('#a89670',.48,.45),
    wall:material('#dfc49f'),
    soilStone:material('#957a65'),
  };
}

