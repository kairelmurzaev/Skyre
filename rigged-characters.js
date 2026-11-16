import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {villagerDesign} from './character-design.js';
import {createCharacterFactory as createFallbackFactory} from './characters.js';

// A real skinned .glb with animation clips. The glTF is loaded only once and
// SkeletonUtils.clone gives every villager independent joint transforms.
// The v0.8 procedural renderer remains a fallback if the model cannot load.
export function createRiggedCharacterFactory(){
  const fallback=createFallbackFactory();
  const instances=new Set();
  let asset=null, disposed=false, loadError=null;
  const ready=new Promise(resolve=>{
    new GLTFLoader().load('./assets/characters/skyre-villager.glb', gltf=>{
      if(disposed)return resolve(false);
      const clips=new Set(gltf.animations.map(a=>a.name));
      const required=['Idle','Walk','Carry','Work','Wave'];
      let skinned=0;
      gltf.scene.traverse(obj=>{if(obj.isSkinnedMesh)skinned++});
      if(!skinned||!required.every(name=>clips.has(name))){
        loadError=new Error('Villager asset is missing its skeleton or animation clips.');
        return resolve(false);
      }
      asset=gltf;resolve(true);
    },undefined,err=>{
      loadError=err;
      console.warn('Skyre: could not load rigged villagers, keeping procedural fallback.',err);
      resolve(false);
    });
  });

  function outfitColor(material,look,outfit){
    const colors={
      Skin:look.skin,Cheek:'#d99389',Hair:look.hair,Brow:look.hair,
      Shirt:outfit.shirt,Vest:outfit.vest,Apron:outfit.accent,
      Pants:outfit.pants,Accent:outfit.accent,HatCloth:outfit.accent,
      Boots:'#604837',Leather:'#785746',Straw:'#e1bf7e',
      Basket:'#ac8052',Cargo:'#e6c991'
    };
    return colors[material]||null;
  }
  function makeRig(worker){
    const design=villagerDesign(worker);
    const root=new THREE.Group();root.userData.villagerId=worker.id;
    const model=cloneSkeleton(asset.scene);
    model.scale.setScalar(.54);root.add(model);
    const ownedMaterials=[];
    const cargoMeshes=[];
    model.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.frustumCulled=false; // bones can move beyond static rest-pose bounds
      const group=obj.name.split('__')[0];
      if(group.startsWith('Hair_'))obj.visible=group==='Hair_'+design.look.hairStyle;
      else if(group.startsWith('Hat_'))obj.visible=group==='Hat_'+design.outfit.hat;
      else if(group==='Apron')obj.visible=!!design.outfit.apron;
      else if(group==='Skirt')obj.visible=design.look.clothing==='skirt';
      else if(group==='Beard')obj.visible=design.index===4;
      else if(group==='Glasses')obj.visible=design.index===6;
      else if(group==='CargoBasket'){cargoMeshes.push(obj);obj.visible=false;}
      if(obj.isSkinnedMesh){obj.castShadow=group==='Body'||group==='Face';obj.receiveShadow=true;}
      // Clone only the material: geometry/bone bind data are shared among all villagers.
      const original=obj.material;
      obj.material=original.clone();ownedMaterials.push(obj.material);
      const color=outfitColor(original.name,design.look,design.outfit);
      if(color)obj.material.color.set(color);
    });
    const mixer=new THREE.AnimationMixer(model);
    const actions=new Map(asset.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    const rig={root,model,mixer,actions,cargoMeshes,ownedMaterials,
      kind:'skinned',job:design.job,motion:null,lastTime:null,look:design.look};
    instances.add(rig);
    return rig;
  }
  function create(worker){
    if(!asset){const rig=fallback.create(worker);rig.kind='fallback';return rig;}
    return makeRig(worker);
  }
  function animate(rig,time,phase,{walking=false,carrying=false,working=false,animation=null}={}){
    if(rig.kind!=='skinned')return fallback.animate(rig,time,phase,{walking,carrying});
    const name=['Idle','Walk','Carry','Work','Wave'].includes(animation)?animation:carrying?'Carry':working?'Work':walking?'Walk':'Idle';
    if(name!==rig.motion){
      const next=rig.actions.get(name)||rig.actions.get('Idle');
      if(rig.motion){rig.actions.get(rig.motion)?.fadeOut(.20);next.reset().fadeIn(.20).play();}
      else{next.play();next.time=(Math.abs(phase)*.14)%next.getClip().duration;}
      rig.motion=name;
    }
    for(const m of rig.cargoMeshes)m.visible=carrying||name==='Carry';
    const delta=rig.lastTime===null?0:Math.max(0,Math.min(time-rig.lastTime,.075));
    rig.lastTime=time;
    rig.mixer.update(delta);
  }
  function release(rig){
    if(!rig||rig.kind!=='skinned')return;
    rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.model);
    for(const material of rig.ownedMaterials)material.dispose();
    rig.ownedMaterials.length=0;instances.delete(rig);
  }
  function dispose(){
    disposed=true;
    for(const rig of [...instances])release(rig);
    if(asset){
      const geometries=new Set(),materials=new Set(),textures=new Set();
      asset.scene.traverse(obj=>{if(obj.isMesh){geometries.add(obj.geometry);const mats=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of mats){materials.add(m);if(m.map)textures.add(m.map);}}});
      for(const m of materials)m.dispose();for(const g of geometries)g.dispose();for(const t of textures)t.dispose();
    }
    fallback.dispose();
  }
  return {ready,create,animate,release,dispose,get assetLoaded(){return !!asset},get loadError(){return loadError}};
}
