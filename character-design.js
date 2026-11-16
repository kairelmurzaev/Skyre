// Skyre v0.8: deterministic, save-independent villager appearances.
// Each worker keeps the same face/hair when reassigned to another job.
// Art direction: rounded storybook villagers, with a shared silhouette and role uniforms.
export const LOOKS = Object.freeze([
  {skin:'#dfae86',hair:'#42302c',hairStyle:'tousled',clothing:'trousers'},
  {skin:'#c98d70',hair:'#6d4130',hairStyle:'braids',clothing:'skirt'},
  {skin:'#f1c69b',hair:'#b47845',hairStyle:'sidepart',clothing:'trousers'},
  {skin:'#b77d5c',hair:'#251f2a',hairStyle:'braids',clothing:'skirt'},
  {skin:'#995c45',hair:'#261e1a',hairStyle:'curly',clothing:'trousers'},
  {skin:'#e7b898',hair:'#744b37',hairStyle:'bob',clothing:'skirt'},
  {skin:'#c79677',hair:'#8b684c',hairStyle:'sidepart',clothing:'trousers'},
  {skin:'#f0c3a1',hair:'#9c533d',hairStyle:'braids',clothing:'skirt'}
]);
export const OUTFITS = Object.freeze({
  idle: {name:'Villager',shirt:'#f0e3ce',vest:'#a16f62',pants:'#7a6558',accent:'#829577',hat:'none',apron:false},
  farmer: {name:'Farmer',shirt:'#f5e9d6',vest:'#557d9d',pants:'#516b89',accent:'#d8b46e',hat:'straw',apron:false},
  forager: {name:'Forager',shirt:'#f4e7d0',vest:'#748961',pants:'#6c715c',accent:'#b37f65',hat:'kerchief',apron:true},
  hauler: {name:'Hauler',shirt:'#ede0cb',vest:'#956e4c',pants:'#63554c',accent:'#c09b63',hat:'cap',apron:false},
  miller: {name:'Miller',shirt:'#e8dec9',vest:'#a38b6c',pants:'#777062',accent:'#d4c7a6',hat:'cap',apron:true},
  baker: {name:'Baker',shirt:'#fff1dc',vest:'#b86d6b',pants:'#916363',accent:'#faf4e7',hat:'chef',apron:true}
});

export function hashVillagerId(id){
  // FNV-1a over UTF-16 code units. Stable on phone, server, and between saves.
  let h=2166136261;
  for(const char of String(id??'')){
    h^=char.charCodeAt(0);h=Math.imul(h,16777619);
  }
  return h>>>0;
}
export function villagerDesign(worker){
  const id=worker && typeof worker.id==='string'?worker.id:'';
  const index=hashVillagerId(id)%LOOKS.length;
  const job=worker && Object.hasOwn(OUTFITS,worker.job)?worker.job:'idle';
  return {index,look:LOOKS[index],outfit:OUTFITS[job],job};
}
