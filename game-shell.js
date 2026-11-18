// Skyre v1.3 — app-first game shell.
// The world simulation stays in app.js. This module only presents existing
// gameplay controls as an immersive, touch-friendly mobile interface.
const $=id=>document.getElementById(id);
const body=document.body;
const launch=$('skyre-launch'),entry=$('launch-enter'),newWorld=$('launch-new-world');
const progress=$('launch-progress'),loading=$('launch-loading');
const hud=$('skyre-hud'),drawerShade=$('skyre-drawer-shade');
const drawerHeader=$('skyre-drawer-title'),more=$('skyre-more');
const buttonMap={
  'desk':{panel:'.desk-section',title:'Beyond the Island'},
  'build':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'build',title:'Build your village'},
  'farm':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'farm',title:'Grow & harvest'},
  'landscape':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'landscape',title:'Shape your island'},
  'move':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'move',title:'Move & rotate'},
  'upgrade':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'upgrade',title:'Improve your buildings'},
  'remove':{panel:'.game-column > .workshop:not(.island-section):not(.inventory-section):not(.workers-section):not(.logistics-section)',mode:'demolish',title:'Remove buildings'},
  'people':{panel:'.workers-section',title:'Your villagers'},
  'land':{panel:'.island-section',title:'Expand your island'},
  'inventory':{panel:'.inventory-section',title:'Village storage'},
  'logistics':{panel:'.logistics-section',title:'Roads & deliveries'},
  'production':{panel:'.game-column > .workshop:last-of-type',title:'Craft & produce'},
  'neighbors':{panel:'.side-column > .panel:nth-of-type(1)',title:'Neighboring skies'},
  'goals':{panel:'.side-column > .panel:nth-of-type(2)',title:'Village goals'},
  'activity':{panel:'.side-column > .panel:nth-of-type(3)',title:'World activity'}
};
let activePanel=null,launchState='loading',gameReady=false,deferredInstall=null;
let lastAction=null;
const playClick=()=>{try{const tg=window.Telegram?.WebApp;if(tg?.isVersionAtLeast?.('6.1'))tg.HapticFeedback?.selectionChanged()}catch{}};
function closeDrawer(){
  more.hidden=true;
  for(const node of document.querySelectorAll('.skyre-open-panel'))node.classList.remove('skyre-open-panel');
  activePanel=null;body.classList.remove('skyre-drawer-open');
  drawerShade.hidden=true;
  $('skyre-drawer-close').hidden=true;
  document.querySelectorAll('[data-shell-open]').forEach(b=>b.setAttribute('aria-expanded','false'));
}
function modeClick(mode){
  document.querySelector('.tabs [data-mode="'+mode+'"]')?.click();
}
function openDrawer(key){
  const cfg=buttonMap[key];
  if(!cfg)return;
  const node=document.querySelector(cfg.panel);
  if(!node)return;
  if(activePanel===node){closeDrawer();return;}
  closeDrawer();
  if(cfg.mode)modeClick(cfg.mode);
  node.classList.add('skyre-open-panel');activePanel=node;
  node.prepend($('skyre-drawer-head'));
  drawerHeader.textContent=cfg.title;
  $('skyre-drawer-close').hidden=false;drawerShade.hidden=false;
  body.classList.add('skyre-drawer-open');
  document.querySelectorAll('[data-shell-open="'+key+'"]').forEach(b=>b.setAttribute('aria-expanded','true'));
  node.scrollTop=0;playClick();
  if(key==='desk')window.dispatchEvent(new Event('skyre:focus-desk'));
}
function toggleMore(){
  if(!more.hidden){more.hidden=true;drawerShade.hidden=!activePanel;return;}
  closeDrawer();more.hidden=false;drawerShade.hidden=false;playClick();
}
function shellState(next){
  launchState=next;
  launch.dataset.state=next;
  const settings=next==='settings';
  $('launch-settings').hidden=!settings;
  $('launch-menu').hidden=settings;
  const active=next==='menu'||next==='settings'||next==='loading';
  launch.hidden=!active;
  if(!active)launch.setAttribute('aria-hidden','true');
  else launch.removeAttribute('aria-hidden');
  hud.hidden=active;
  body.classList.toggle('skyre-playing',!active);
}
function showMenu(){
  closeDrawer();
  if(launchState==='loading')return;
  $('launch-enter').textContent=gameReady?'Continue my world':'Preparing your island…';
  shellState('menu');
}
function setReady(success=true){
  if(gameReady)return;
  gameReady=success;
  progress.style.width=success?'100%':'18%';
  if(!success){
    loading.textContent='Unable to open the 3D world. Please reload or check WebGL settings.';
    entry.disabled=true;newWorld.disabled=true;return;
  }
  loading.textContent='Your little world is ready';
  entry.disabled=false;
  if(!window.Telegram?.WebApp?.initData)newWorld.disabled=false;
  // The splash stays long enough to show the approved artwork without
  // unnecessarily delaying players on subsequent opens.
  setTimeout(()=>shellState('menu'),380);
}
window.addEventListener('skyre:ready',e=>setReady(e.detail?.ok!==false));
window.addEventListener('skyre:world-change',()=>syncHud());
function syncHud(){
  const w=$('world-name')?.textContent||'Your Island';
  const sky=$('sky-badge')?.textContent||'';
  $('skyre-world-name').textContent=w;
  const weather=$('skyre-weather');if(weather)weather.textContent=sky;
}
const sceneName=$('world-name');
if(sceneName)new MutationObserver(syncHud).observe(sceneName,{childList:true,characterData:true,subtree:true});
const skyBadge=$('sky-badge');
if(skyBadge)new MutationObserver(syncHud).observe(skyBadge,{childList:true,characterData:true,subtree:true});
syncHud();
function requestGameFullscreen(){
  // iPhone Safari usually does not support arbitrary element fullscreen;
  // the CSS game view still occupies 100dvh. Installed PWAs run standalone.
  try{
    const tg=window.Telegram?.WebApp;
    tg?.expand?.();
    if(tg?.isVersionAtLeast?.('7.7'))tg?.disableVerticalSwipes?.();
    if(tg?.isVersionAtLeast?.('8.0')&&typeof tg.requestFullscreen==='function')tg.requestFullscreen();
  }catch{}
  if(document.documentElement.requestFullscreen&&!document.fullscreenElement){
    try{document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});}catch{}
  }
}
function enterWorld(){
  if(!gameReady)return;
  requestGameFullscreen();
  shellState('playing');
  closeDrawer();
  // ResizeObserver on the underlying Three.js viewport handles this change.
  requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}
function swapLocalWorld(){
  const button=$('reset');
  if(button.hidden){
    loading.textContent='New worlds are managed by your Telegram group.';
    return;
  }
  button.click(); // Existing game handler confirms and resets both local worlds.
}
entry.addEventListener('click',enterWorld);
newWorld.addEventListener('click',swapLocalWorld);
$('launch-settings-button').addEventListener('click',()=>shellState('settings'));
$('launch-settings-back').addEventListener('click',()=>shellState('menu'));
$('launch-retry').addEventListener('click',()=>location.reload());
$('skyre-menu-button').addEventListener('click',showMenu);
$('skyre-drawer-close').addEventListener('click',closeDrawer);
drawerShade.addEventListener('click',()=>{closeDrawer();more.hidden=true;});
$('skyre-more-button').addEventListener('click',toggleMore);
$('skyre-desk-button').addEventListener('click',()=>openDrawer('desk'));
window.addEventListener('skyre:open-desk',()=>{if(!document.querySelector('.desk-section.skyre-open-panel'))openDrawer('desk');});
$('skyre-view-button').addEventListener('click',()=>document.getElementById('camera-btn')?.click());
$('skyre-villager-button').addEventListener('click',()=>document.getElementById('character-camera-btn')?.click());
$('skyre-fullscreen-button').addEventListener('click',requestGameFullscreen);
$('skyre-fullscreen-settings').addEventListener('click',requestGameFullscreen);
$('skyre-install-button').addEventListener('click',async()=>{
  if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice.catch(()=>{});deferredInstall=null;}
  else $('skyre-install-help').hidden=false;
});
$('skyre-world-switch').addEventListener('click',()=>{
  if($('group-picker')?.hidden)return;
  const current=document.querySelector('[data-group].active')?.dataset.group||'a';
  document.querySelector('[data-group="'+(current==='a'?'b':'a')+'"]')?.click();
  shellState('menu');syncHud();
});
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstall=e;
  $('skyre-install-button').disabled=false;
});
window.addEventListener('appinstalled',()=>{
  deferredInstall=null;$('skyre-install-help').textContent='Skyre is installed. Open it from your home screen.';
  $('skyre-install-help').hidden=false;
});
const launchWorld=$('skyre-world-switch');
if(window.Telegram?.WebApp?.initData)launchWorld.hidden=true;
for(const button of document.querySelectorAll('[data-shell-open]')){
  button.addEventListener('click',()=>{openDrawer(button.dataset.shellOpen);});
}
for(const button of document.querySelectorAll('[data-shell-mode]')){
  button.addEventListener('click',()=>{
    closeDrawer();modeClick(button.dataset.shellMode);
    playClick();
  });
}
for(const button of document.querySelectorAll('[data-more-open]')){
  button.addEventListener('click',()=>{more.hidden=true;openDrawer(button.dataset.moreOpen);});
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(launchState==='settings')shellState('menu');
  else if(!launch.hidden) return;
  else if(!more.hidden)more.hidden=true;
  else if(activePanel)closeDrawer();
  else showMenu();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncHud();});
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.info('Offline shell unavailable:',e?.message)));
}
// Standalone is detectable and supported; a browser tab can still show its
// own address bar if fullscreen permission is denied.
if(matchMedia('(display-mode: standalone)').matches || navigator.standalone===true){
  body.classList.add('skyre-standalone');
}
shellState('loading');
loading.textContent='Preparing your island…';
const fallback=setTimeout(()=>{
  // Do not hang at the splash if a script failed before dispatching the event.
  const canvas=$('scene')?.querySelector('canvas');
  if(!gameReady&&canvas)setReady();
  else if(!gameReady){loading.textContent='World loading is taking longer than expected.';$('launch-retry').hidden=false;}
},18000);
window.addEventListener('skyre:ready',()=>clearTimeout(fallback),{once:true});

