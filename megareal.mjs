const DEBUG='http://127.0.0.1:9225', BASE='http://127.0.0.1:9292';
const t=await (await fetch(`${DEBUG}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r));
let id=1; const pend=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
const send=(m,p={})=>{const i=id++;ws.send(JSON.stringify({id:i,method:m,params:p}));return new Promise(r=>pend.set(i,r));};
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const K=async(k,c,kc)=>{for(const type of ['keyDown','keyUp'])
  await send('Input.dispatchKeyEvent',{type,key:k,code:c,windowsVirtualKeyCode:kc,nativeVirtualKeyCode:kc});};
let fails=0; const check=(l,p,d='')=>{console.log(`  ${p?'PASS':'FAIL'}  ${l}${d?'  — '+d:''}`); if(!p)fails++;};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:BASE+'/'}); await sleep(3000);

console.log('=== Real mega menu (Liquid-rendered, not injected) ===');
const s=await ev(`
(() => {
  const d=document.querySelector('[data-mega]');
  if(!d) return {present:false};
  const panel=d.querySelector('.mega__panel');
  return {present:true, open:d.open,
    panelDisplay:getComputedStyle(panel).display,
    columns:d.querySelectorAll('.mega__column').length,
    promo:!!d.querySelector('.mega__promo')};
})()`);
check('mega <details> rendered from Liquid', s.present, `${s.columns} columns, feature card: ${s.promo}`);
check('panel closed on load', s.open===false);

await ev(`document.querySelector('[data-mega] summary').click()`); await sleep(300);
const opened=await ev(`
(() => {
  const d=document.querySelector('[data-mega]');
  const p=d.querySelector('.mega__panel');
  const r=p.getBoundingClientRect();
  return {open:d.open, visible:r.height>0&&r.width>0, width:Math.round(r.width),
    top:Math.round(r.top), links:p.querySelectorAll('a').length};
})()`);
check('click opens the panel', opened.open);
check('panel is actually visible and full width', opened.visible && opened.width>1000, `${opened.width}px wide, ${opened.links} links`);
check('panel sits below the header', opened.top>0, `top ${opened.top}px`);

await ev(`document.querySelector('[data-mega] summary').focus()`);
await K('Escape','Escape',27); await sleep(300);
const esc=await ev(`
(() => ({open:document.querySelector('[data-mega]').open,
         focus:document.activeElement?.tagName}))()`);
check('Escape closes it', esc.open===false);
check('focus returns to the summary', esc.focus==='SUMMARY');

const leave=await ev(`
(async () => {
  const d=document.querySelector('[data-mega]'); d.open=true;
  await new Promise(r=>setTimeout(r,150));
  document.querySelector('.header__actions button')?.focus();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await new Promise(r=>setTimeout(r,150));
  return d.open;
})()`);
check('closes when focus leaves the menu', leave===false);

const depth=await ev(`
(() => {
  const d=document.querySelector('[data-mega]');
  return {cols:d.querySelectorAll('.mega__column').length,
          thirdLevel:d.querySelectorAll('.mega__link').length,
          dropdowns:document.querySelectorAll('[data-mega]').length};
})()`);
console.log(`\n  menu depth actually available: ${depth.cols} column(s), ${depth.thirdLevel} third-level links, ${depth.dropdowns} dropdown(s)`);
console.log(`\n${fails===0?'all real-markup checks passed':fails+' failure(s)'}`);
ws.close(); process.exit(fails?1:0);
