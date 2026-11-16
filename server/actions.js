import {expandIsland,setLandscape,LANDSCAPE,MAX_COORD} from '../terrain.js';
import {BUILD,CROP,buildAt,moveAt,rotateAt,removeAt,plant,harvest,harvestOrchard,received,gather,processBuilding,sendSeed,claimGoal,record,upgradeAt} from '../core.js';
import {assignWorker,setAutoCrop} from '../workers.js';
import {collectBuilding,supplyBuilding} from '../logistics.js';

const integer=(v)=>Number.isSafeInteger(v)&&v>=-MAX_COORD&&v<=MAX_COORD;
const string=(v,max=128)=>typeof v==='string'&&v.length>0&&v.length<=max;
const coords=(a,keys)=>keys.every(k=>integer(a[k]));
export function executeAction(game,command,linked,now=Date.now()){
  if(!command||typeof command!=='object'||Array.isArray(command))return {error:'Invalid action.'};
  const a=command,w=game.a;let error=null,message='';
  switch(a.type){
    case 'expand':
      error=expandIsland(w);message='Expanded the island shoreline.';break;
    case 'landscape':
      if(!coords(a,['x','z'])||!Object.hasOwn(LANDSCAPE,a.kind)&&a.kind!=='clear')return {error:'Invalid landscape.'};
      error=setLandscape(w,a.x,a.z,a.kind);message='Updated the landscape.';break;
    case 'upgrade':
      if(!coords(a,['x','z']))return {error:'Invalid location.'};
      error=upgradeAt(w,a.x,a.z);message='Upgraded a building.';break;
    case 'build':
      if(!coords(a,['x','z'])||!Object.hasOwn(BUILD,a.building)||!Number.isInteger(a.rotation)||a.rotation<0||a.rotation>3)return {error:'Invalid building placement.'};
      error=buildAt(w,a.building,a.x,a.z,a.rotation);message=`Built ${BUILD[a.building].name}.`;break;
    case 'move':
      if(!coords(a,['fromX','fromZ','x','z']))return {error:'Invalid move.'};
      error=moveAt(w,a.fromX,a.fromZ,a.x,a.z);message='Moved a building.';break;
    case 'rotate':
      if(!coords(a,['x','z']))return {error:'Invalid location.'};
      error=rotateAt(w,a.x,a.z);message='Rotated a building.';break;
    case 'remove':
      if(!coords(a,['x','z']))return {error:'Invalid location.'};
      error=removeAt(w,a.x,a.z);message='Removed a building.';break;
    case 'plant':
      if(!coords(a,['x','z'])||!Object.hasOwn(CROP,a.crop))return {error:'Invalid seed or location.'};
      error=plant(game,'a',a.x,a.z,a.crop,now);message=`Planted ${CROP[a.crop].name}.`;break;
    case 'harvest':
      if(!coords(a,['x','z']))return {error:'Invalid location.'};
      error=harvest(game,'a',a.x,a.z,now);message='Harvested a crop.';break;
    case 'orchard':
      if(!coords(a,['x','z']))return {error:'Invalid location.'};
      error=harvestOrchard(w,a.x,a.z,now,received(game,'a').breeze);message='Collected orchard fruit.';break;
    case 'gather':
      if(!['wood','stone'].includes(a.kind))return {error:'Invalid resource.'};
      error=gather(w,a.kind,now);message=`Gathered ${a.kind}.`;break;
    case 'craft':
      if(!['windmill','bakery'].includes(a.building))return {error:'Invalid workshop.'};
      error=processBuilding(w,a.building);message=`Used the ${a.building}.`;break;
    case 'lamp':w.lamp=!w.lamp;message=w.lamp?'Turned on the desk lamp.':'Turned off the desk lamp.';break;
    case 'mirror':w.mirror=(w.mirror+1)%3;message='Rotated the moon mirror.';break;
    case 'seed':
      if(!linked)return {error:'Connect with another group before gifting seeds.'};
      error=sendSeed(game,'a');message='Sent two seeds to the connected world.';break;
    case 'job':
      if(!string(a.workerId)||!string(a.job,24))return {error:'Invalid worker assignment.'};
      error=assignWorker(w,a.workerId,a.job,now);message='Assigned a villager job.';break;
    case 'autoCrop':
      if(!string(a.crop,24))return {error:'Invalid crop.'};
      error=setAutoCrop(w,a.crop);message='Updated farmer crop.';break;
    case 'collect':
      if(!string(a.buildingId))return {error:'Invalid building.'};
      error=collectBuilding(w,a.buildingId);message='Collected workshop goods.';break;
    case 'supply':
      if(!string(a.buildingId))return {error:'Invalid building.'};
      error=supplyBuilding(w,a.buildingId);message='Supplied a workshop.';break;
    case 'goal':
      if(!string(a.goal,24))return {error:'Invalid goal.'};
      error=claimGoal(w,a.goal);message='Claimed a village reward.';break;
    default:return {error:'Unknown action.'};
  }
  if(error)return {error};
  record(game,`${w.name}: ${message}`);
  return {message};
}
