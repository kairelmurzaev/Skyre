import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {villagerDesign} from './character-design.js';
import {createCharacterFactory as createFallbackFactory} from './characters.js';
import {loadMasterWorker,masterWorkerClips} from './master-worker.js';
import {loadWorkerV2,WORKER_V2_SCARF_COLORS} from './worker-v2.js';

// General Worker v2 is now the default temporary character for all village
// roles, preserving distinct animation mixers/skeletons. The v0.9 job-uniform
// rig remains a complete fallback and the v0.8 procedural renderer remains a
// last-resort fallback when models cannot load.
export function createRiggedCharacterFactory({previewMaster=false}={}){
  const fallback=createFallbackFactory();
  const instances=new Set();
  let asset=null,masterAsset=null,workerV2Asset=null,disposed=false,loadError=null;
  const baseReady=new Promise(resolve=>{
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


  const workerV2Ready=loadWorkerV2().then(gltf=>{
    if(disposed)return false;
    workerV2Asset=gltf;
    return true;
  }).catch(error=>{
    console.warn('Skyre: Worker v2 unavailable; keeping existing rigged villagers.',error);
    // The existing rigged asset is still loaded independently below.
    return false;
  });
  const masterReady=previewMaster?loadMasterWorker().then(gltf=>{if(!disposed)masterAsset=gltf;return !!masterAsset;}).catch(error=>{console.warn('Skyre: experimental master worker unavailable, using existing model.',error);return false;}):Promise.resolve(false);
  const ready=Promise.all([baseReady,workerV2Ready,masterReady]).then(([normal,v2,master])=>normal||v2||master);
  function makeWorkerV2Rig(worker){
    const design=villagerDesign(worker);
    const root=new THREE.Group();
    root.userData.villagerId=worker.id;
    root.userData.characterStyle='skyre-worker-v2';
    root.userData.job=design.job;
    const model=cloneSkeleton(workerV2Asset.scene);
    // The model is a real 2.4m humanoid; a compact scale suits the village
    // tiles and maintains believable proportions next to the new cottages.
    model.scale.setScalar(.39);
    root.add(model);
    const ownedMaterials=[];
    let skinnedCount=0;
    model.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.frustumCulled=false; // animated extremities move beyond rest bounds
      obj.castShadow=obj.isSkinnedMesh&&skinnedCount++<9;
      obj.receiveShadow=true;
      const roleColor=WORKER_V2_SCARF_COLORS[design.job];
      if(roleColor&&obj.name.includes('olive knitted scarf')){
        const original=obj.material;
        obj.material=original.clone();
        obj.material.map=null;
        obj.material.color.set(roleColor);
        ownedMaterials.push(obj.material);
      }
    });
    const mixer=new THREE.AnimationMixer(model);
    const actions=new Map(workerV2Asset.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    const rig={root,model,mixer,actions,cargoMeshes:[],ownedMaterials,
      assetRole:'worker-v2',kind:'skinned',job:design.job,
      motion:null,lastTime:null,look:design.look};
    instances.add(rig);
    return rig;
  }
  function makeMasterRig(worker){
    const root=new THREE.Group();root.userData.villagerId=worker.id;root.userData.characterStyle='master-worker-preview';
    const model=cloneSkeleton(masterAsset.scene);model.scale.setScalar(.28);root.add(model);
    let count=0;
    model.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=count++<5;o.receiveShadow=true;}});
    const mixer=new THREE.AnimationMixer(model);
    const actions=new Map(masterWorkerClips().map(clip=>[clip.name,mixer.clipAction(clip)]));
    const rig={root,model,mixer,actions,cargoMeshes:[],ownedMaterials:[],kind:'skinned',job:'idle',motion:null,lastTime:null,look:villagerDesign(worker).look};
    instances.add(rig);return rig;
  }

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
    if(previewMaster&&masterAsset&&villagerDesign(worker).job==='idle')return makeMasterRig(worker);
    if(workerV2Asset)return makeWorkerV2Rig(worker);
    if(!asset){const rig=fallback.create(worker);rig.kind='fallback';return rig;}
    return makeRig(worker);
  }
  function animate(rig,time,phase,{walking=false,carrying=false,working=false,animation=null}={}){
    if(rig.kind!=='skinned')return fallback.animate(rig,time,phase,{walking,carrying});
    const name=['Idle','Walk','Carry','Work','Wave'].includes(animation)?animation:carrying?'Carry':working?'Work':walking?'Walk':'Idle';
    // The v2 model comes with native PickUp/UseItem actions. Use its actual
    // walk clip for travel while carrying rather than inventing missing clips.
    const motion=rig.assetRole==='worker-v2'?({Carry:'Walk',Wave:'UseItem'}[name]||name):name;
    if(motion!==rig.motion){
      const next=rig.actions.get(motion)||rig.actions.get('Idle');
      if(rig.motion){rig.actions.get(rig.motion)?.fadeOut(.20);next.reset().fadeIn(.20).play();}
      else{next.play();next.time=(Math.abs(phase)*.14)%next.getClip().duration;}
      rig.motion=motion;
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
    for(const source of [workerV2Asset,masterAsset]){
      if(!source)continue;
      const geometries=new Set(),materials=new Set(),textures=new Set();
      source.scene.traverse(o=>{
        if(!o.isMesh)return;
        geometries.add(o.geometry);
        const mats=Array.isArray(o.material)?o.material:[o.material];
        for(const m of mats){materials.add(m);if(m?.map)textures.add(m.map);}
      });
      for(const mat of materials)mat?.dispose();
      for(const g of geometries)g?.dispose();
      for(const texture of textures)texture?.dispose();
    }
    fallback.dispose();
  }
  return {ready,create,animate,release,dispose,get assetLoaded(){return !!workerV2Asset||!!asset||!!masterAsset},get loadError(){return loadError}};
}
