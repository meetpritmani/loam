const DEBUG='http://127.0.0.1:9226', BASE='http://127.0.0.1:9292';
const IGNORE=/HotReload|origin_trials|frame-ancestors|shop\.app|CORS policy|Content Security Policy|web-pixels|api\/collect/i;
const t=await (await fetch(`${DEBUG}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r));
let id=1; const pend=new Map(); let msgs=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
  if(m.method==='Runtime.consoleAPICalled'){const x=m.params.args.map(a=>a.value??a.description??'').join(' '); if(!IGNORE.test(x)) msgs.push(x);}
  if(m.method==='Runtime.exceptionThrown'){const x=m.params.exceptionDetails.exception?.description||''; if(!IGNORE.test(x)) msgs.push('EXC '+x);}});
const send=(m,p={})=>{const i=id++;ws.send(JSON.stringify({id:i,method:m,params:p}));return new Promise(r=>pend.set(i,r));};
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const check=(l,p,d='')=>{console.log(`  ${p?'PASS':'FAIL'}  ${l}${d?'  — '+d:''}`); if(!p)fails++;};
await send('Runtime.enable'); await send('Page.enable');

async function goto(w=1440,h=900){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<750});
  msgs=[]; await send('Page.navigate',{url:BASE+'/'}); await sleep(3000);}

await goto();
console.log('=== Console ===');
check('no theme console errors (9 sections)', msgs.length===0, msgs.slice(0,2).join(' | ')||'clean');

console.log('\n=== count-up ===');
const cu=await ev(`
(async () => {
  const els=[...document.querySelectorAll('count-up')];
  const finals=els.map(e=>e.textContent);
  document.querySelector('.impact-stats')?.scrollIntoView();
  await new Promise(r=>setTimeout(r,300));
  const mid=els.map(e=>e.textContent);
  const hidden=els.filter(e=>e.getAttribute('aria-hidden')==='true').length;
  await new Promise(r=>setTimeout(r,1600));
  const after=els.map(e=>e.textContent);
  const stillHidden=els.filter(e=>e.getAttribute('aria-hidden')==='true').length;
  return {count:els.length, finals, mid, after, hidden, stillHidden,
          changedDuring: mid.some((m,i)=>m!==finals[i])};
})()`);
check('count-up elements present', cu.count===4, `${cu.count}`);
check('values animate (differ mid-flight)', cu.changedDuring, `mid: ${cu.mid.join(', ')}`);
check('lands exactly on the authored value', JSON.stringify(cu.after)===JSON.stringify(cu.finals), cu.after.join(', '));
check('aria-hidden while counting, restored after', cu.hidden>0 && cu.stillHidden===0, `${cu.hidden} hidden during, ${cu.stillHidden} after`);

console.log('\n=== accordion (native details) ===');
const acc=await ev(`
(() => {
  const items=[...document.querySelectorAll('.faq__list .accordion__item')];
  const first=items[0];
  const closed=!first.open;
  first.querySelector('summary').click();
  const opened=first.open;
  const contentVisible=first.querySelector('.accordion__content').getBoundingClientRect().height>0;
  first.querySelector('summary').click();
  return {count:items.length, closed, opened, contentVisible, reclosed:!first.open};
})()`);
check('5 accordion items', acc.count===5);
check('closed by default, opens on click, closes again', acc.closed&&acc.opened&&acc.reclosed);
check('answer becomes visible when open', acc.contentVisible);

console.log('\n=== testimonial ratings a11y ===');
const rt=await ev(`
(() => {
  const rows=[...document.querySelectorAll('.testimonial__rating')];
  return {rows:rows.length,
    withText:rows.filter(r=>r.querySelector('.visually-hidden')?.textContent.trim().length>0).length,
    sample:rows[0]?.querySelector('.visually-hidden')?.textContent.trim(),
    starsAriaHidden:rows.every(r=>[...r.querySelectorAll('svg')].every(s=>s.getAttribute('aria-hidden')==='true'))};
})()`);
check('every rating has a spoken equivalent', rt.rows===rt.withText, rt.sample);
check('star glyphs are aria-hidden', rt.starsAriaHidden);

console.log('\n=== overflow at all widths ===');
for(const [w,h] of [[320,700],[375,812],[768,1024],[1440,900]]){
  await goto(w,h);
  const o=await ev(`(()=>{const de=document.documentElement;const over=de.scrollWidth-de.clientWidth;let c=null;
    if(over>1)for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();
      if(r.right>de.clientWidth+1){c=el.tagName+'.'+(el.className||'').toString().split(' ')[0];break;}}
    return {over,c};})()`);
  check(`${w}px no overflow`, o.over<=1, o.over>1?`+${o.over}px ${o.c}`:'clean');
}
console.log(`\n${fails===0?'ALL CHECKS PASSED':fails+' FAILURE(S)'}`);
ws.close(); process.exit(fails?1:0);
