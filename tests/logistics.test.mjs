import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,buildAt,removeAt,findAt,plant,harvest,loadGame,saveGame} from '../core.js';
import {BASE_STORAGE,WAREHOUSE_STORAGE,buildingStock,buildingFree,storageCapacity,storageFree,stockUsed,inventoryTotals,ensureStocks,collectBuilding,supplyBuilding,deliveryOptions,completeDelivery,processLocal} from '../logistics.js';
import {syncWorkers,assignWorker,advanceGame} from '../workers.js';
import {planWorkerRoute,workInterval} from '../routing.js';
const fakeStorage=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}};
const gameWithWorkshops=()=>{const g=newGame(),w=g.a;w.resources.wood=150;w.resources.stone=150;buildAt(w,'windmill',0,2);buildAt(w,'bakery',1,2);ensureStocks(w);return g};

test('storehouses add real capacity and cannot be removed with excessive stored goods',()=>{
  const w=newGame().a;
  assert.equal(storageCapacity(w),BASE_STORAGE);
  assert.equal(stockUsed(w),4);
  assert.equal(buildAt(w,'warehouse',2,1),null);
  assert.equal(storageCapacity(w),BASE_STORAGE+WAREHOUSE_STORAGE);
  w.resources.wheat=40;
  assert.match(removeAt(w,2,1),/storage/);
  w.resources.wheat=3;
  assert.equal(removeAt(w,2,1),null);
  assert.equal(storageCapacity(w),BASE_STORAGE);
});

test('manual harvest pauses at capacity without wasting crops or granting free resources',()=>{
  const g=newGame(),w=g.a,now=1000000;
  w.resources.food=BASE_STORAGE;
  assert.equal(plant(g,'a',-2,0,'wheat',now),null);
  const before={...w.resources};
  assert.match(harvest(g,'a',-2,0,now+40000),/storage is full/);
  assert.deepEqual(w.resources,before);
  assert.ok(findAt(w,-2,0).crop);
  w.resources.food-=5;
  assert.equal(harvest(g,'a',-2,0,now+40000),null);
  assert.equal(w.resources.wheat,4);
});

test('manual collection and supply preserve goods and enforce workshop limits',()=>{
  const g=gameWithWorkshops(),w=g.a;
  const plot=findAt(w,-2,0),mill=findAt(w,0,2);
  plot.stock.wheat=13;
  const before=inventoryTotals(w).wheat;
  assert.equal(collectBuilding(w,plot.id),null);
  assert.equal(inventoryTotals(w).wheat,before);
  assert.equal(buildingStock(plot,'wheat'),0);
  assert.equal(supplyBuilding(w,mill.id),null);
  assert.equal(buildingStock(mill,'wheat'),4);
  assert.equal(inventoryTotals(w).wheat,before);
  assert.equal(processLocal(w,'windmill',mill.id),true);
  assert.equal(buildingStock(mill,'wheat'),1);
  assert.equal(buildingStock(mill,'flour'),2);
  assert.equal(collectBuilding(w,mill.id),null);
  assert.equal(w.resources.flour,2);
  assert.equal(buildingStock(mill,'flour'),0);
});

test('hauler transfers do not duplicate goods and reject stale shipments',()=>{
  const g=gameWithWorkshops(),w=g.a;
  const plot=findAt(w,-2,0),mill=findAt(w,0,2);
  plot.stock.wheat=4;
  const plan=deliveryOptions(w).find(d=>d.sourceId===plot.id&&d.destId===mill.id);
  assert.ok(plan);
  const before=inventoryTotals(w).wheat;
  assert.equal(completeDelivery(w,plan),4);
  assert.equal(completeDelivery(w,plan),0);
  assert.equal(inventoryTotals(w).wheat,before);
  assert.equal(buildingStock(plot,'wheat'),0);
  assert.equal(buildingStock(mill,'wheat'),4);
  assert.match(removeAt(w,0,2),/Collect or deliver/);
});

test('a hauler takes the actual home-pickup-delivery-home route, and roads shorten it',()=>{
  const g=gameWithWorkshops(),w=g.a,now=1000000;
  w.simulatedAt=now;syncWorkers(w,now);
  const haulerId=w.workers[1].id;assignWorker(w,haulerId,'hauler',now);
  const hauler=w.workers.find(w=>w.id===haulerId);
  const plot=findAt(w,-2,0);plot.stock.wheat=4;
  const plan=planWorkerRoute(g,'a',hauler,now);
  assert.equal(plan.task,'deliver');
  assert.equal(plan.delivery.sourceId,plot.id);
  assert.equal(plan.delivery.destId,findAt(w,0,2).id);
  assert.deepEqual(plan.route.points[0],{x:1,z:-1});
  assert.deepEqual(plan.route.points.at(-1),{x:1,z:-1});
  for(let i=1;i<plan.route.points.length;i++){
    assert.equal(Math.abs(plan.route.points[i].x-plan.route.points[i-1].x)+Math.abs(plan.route.points[i].z-plan.route.points[i-1].z),1);
  }
  assert.equal(workInterval(w,hauler,6000,plan),6000+plan.route.ms);
  assert.equal(buildAt(w,'path',0,-1),null);
  const paved=planWorkerRoute(g,'a',hauler,now);
  assert.ok(paved.route.ms<=plan.route.ms);
});

test('local flour becomes local bread with no magical village inventory jump',()=>{
  const g=gameWithWorkshops(),w=g.a;
  const mill=findAt(w,0,2),bakery=findAt(w,1,2);
  mill.stock.wheat=6;
  assert.equal(processLocal(w,'windmill',mill.id),true);
  assert.equal(completeDelivery(w,{sourceId:mill.id,destId:bakery.id,good:'flour',qty:4}),2);
  const beforeFood=w.resources.food;
  assert.equal(processLocal(w,'bakery',bakery.id),true);
  assert.equal(buildingStock(bakery,'food'),6);
  assert.equal(w.resources.food,beforeFood);
  assert.equal(completeDelivery(w,{sourceId:bakery.id,destId:'depot',good:'food',qty:4}),4);
  assert.equal(w.resources.food,beforeFood+4);
  assert.equal(buildingStock(bakery,'food'),2);
});

test('full village storage blocks hauler deposits, but raw goods stay intact',()=>{
  const g=gameWithWorkshops(),w=g.a;
  const bakery=findAt(w,1,2);bakery.stock.food=9;
  w.resources.food=BASE_STORAGE;
  const before=inventoryTotals(w).food;
  assert.equal(completeDelivery(w,{sourceId:bakery.id,destId:'depot',good:'food',qty:4}),0);
  assert.equal(inventoryTotals(w).food,before);
  assert.equal(buildingStock(bakery,'food'),9);
  w.resources.food-=2;
  const afterSpending=inventoryTotals(w).food;
  assert.equal(completeDelivery(w,{sourceId:bakery.id,destId:'depot',good:'food',qty:4}),2);
  assert.equal(inventoryTotals(w).food,afterSpending);
});

test('old saves are migrated to safe local stocks, while new inventories survive a round trip',()=>{
  const g=gameWithWorkshops(),w=g.a;
  const mill=findAt(w,0,2);mill.stock.wheat=5;
  delete findAt(w,-2,0).stock;
  const store=fakeStorage();saveGame(store,g);
  const loaded=loadGame(store);
  assert.equal(buildingStock(findAt(loaded.a,0,2),'wheat'),5);
  assert.equal(buildingStock(findAt(loaded.a,-2,0),'food'),0);
  assert.deepEqual(inventoryTotals(loaded.a),inventoryTotals(w));
  assert.ok(loaded.a.buildings.some(b=>b.type==='bakery'));
});
