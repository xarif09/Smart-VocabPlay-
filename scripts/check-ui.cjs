const { chromium } = require('playwright');
const URL='http://localhost:4173/Smart-VocabPlay-/';
const OUT=require('path').join(__dirname,'..','docs','screenshots');
async function audit(page,label){
  return page.evaluate((label)=>{
    const els=[...document.querySelectorAll('button,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
    const ov=[];
    for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
      const a=els[i],b=els[j]; if(a.contains(b)||b.contains(a))continue;
      const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();
      const x=Math.min(r.right,s.right)-Math.max(r.left,s.left), y=Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top);
      // ignore content scrolled under fixed topbar
      const fixed=e=>!!e.closest('[style*="position: fixed"]');
      if(fixed(a)!==fixed(b))continue;
      if(x>1&&y>1)ov.push((a.innerText||a.tagName).slice(0,15)+' × '+(b.innerText||b.tagName).slice(0,15));
    }
    const small=els.filter(e=>e.tagName==='BUTTON'&&e.getBoundingClientRect().height<44).map(e=>(e.innerText||'?').trim().slice(0,12)+':'+Math.round(e.getBoundingClientRect().height));
    return {label,hScroll:document.documentElement.scrollWidth>window.innerWidth,overlaps:ov,smallBtns:[...new Set(small)].slice(0,12),smallCount:small.length};
  },label);
}
(async()=>{
  const b=await chromium.launch(); const res=[];
  for(const [name,vp] of [['mobile',{width:375,height:812}],['desktop',{width:1280,height:800}]]){
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:name==='mobile'?2:1});
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await p.screenshot({path:`${OUT}/${name}-0-start.png`}); res.push(await audit(p,name+' start'));
    await p.click('text=แตะเพื่อเริ่มเลย'); await p.waitForTimeout(300);
    await p.screenshot({path:`${OUT}/${name}-1-home.png`}); res.push(await audit(p,name+' home'));
    const counts=await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText).filter(t=>/\d+ คำ$/.test(t)).map(t=>+t.match(/(\d+) คำ$/)[1]));
    res.push({label:name+' count',cats:counts.length,total:counts.reduce((a,c)=>a+c,0),header:await p.innerText('text=/คำ · .* หมวด/')});
    await p.click('text=Animals'); await p.waitForTimeout(200);
    await p.screenshot({path:`${OUT}/${name}-2-category.png`}); res.push(await audit(p,name+' category'));
    await p.click('text=Quiz'); await p.waitForTimeout(200);
    await p.screenshot({path:`${OUT}/${name}-3-game-quiz.png`}); res.push(await audit(p,name+' quiz'));
    await p.click('button:has-text("‹")'); await p.click('text=Spelling'); await p.waitForTimeout(200);
    await p.screenshot({path:`${OUT}/${name}-4-game-spell.png`}); res.push(await audit(p,name+' spell'));
    await p.click('button:has-text("‹")'); await p.click('text=Habitat Hunt'); await p.waitForTimeout(200);
    await p.screenshot({path:`${OUT}/${name}-5-game-habitat.png`}); res.push(await audit(p,name+' habitat'));
    await p.click('button:has-text("‹")'); await p.click('button:has-text("‹")');
    await p.click('text=จัดการ'); await p.waitForTimeout(200);
    await p.screenshot({path:`${OUT}/${name}-6-manage.png`}); res.push(await audit(p,name+' manage'));
    await p.click('text=+ เพิ่มคำ'); await p.waitForTimeout(100);
    await p.screenshot({path:`${OUT}/${name}-7-manage-add.png`}); res.push(await audit(p,name+' manage-add'));
    await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(100);
    await p.screenshot({path:`${OUT}/${name}-8-manage-bottom.png`}); res.push(await audit(p,name+' manage-bottom'));
    res.push({label:name+' errors',errs});
    await ctx.close();
  }
  // persistence test
  const ctx=await b.newContext({viewport:{width:375,height:812}}); const p=await ctx.newPage();
  const cnt=async()=>{await p.click('text=แตะเพื่อเริ่มเลย');return p.innerText('text=/คำ · .* หมวด/');};
  await p.goto(URL); const c0=await cnt();
  await p.click('text=จัดการ'); await p.click('text=+ เพิ่มคำ');
  await p.fill('input[placeholder^="คำ EN"]','ZEBRATEST'); await p.fill('input[placeholder="ความหมาย TH"]','ทดสอบ');
  await p.click('button:text-is("บันทึก")');
  await p.fill('input[placeholder^="🔍"]','CAT'); await p.click('button:has-text("🗑️") >> nth=0', {noWaitAfter:true}).catch(()=>{});
  await p.reload(); const c1=await cnt();
  p.on('dialog',d=>d.dismiss()); await p.click('text=จัดการ'); await p.click('text=คืนค่าคำศัพท์เริ่มต้น'); await p.click('button:has-text("‹")'); const c2=await p.innerText('text=/คำ · .* หมวด/');
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept()); await p.click('text=จัดการ'); await p.click('text=คืนค่าคำศัพท์เริ่มต้น'); await p.reload(); const c3=await cnt();
  res.push({label:'persist',start:c0,afterAddReload:c1,resetCancelled:c2,afterResetReload:c3});
  await ctx.close();
  // localStorage blocked
  const c4=await b.newContext(); await c4.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});});
  const q=await c4.newPage(); const e2=[]; q.on('pageerror',e=>e2.push(e.message));
  await q.goto(URL); await q.click('text=แตะเพื่อเริ่มเลย'); const h=await q.innerText('text=/คำ · .* หมวด/');
  await q.click('text=จัดการ'); await q.click('text=+ เพิ่มคำ'); await q.fill('input[placeholder^="คำ EN"]','X'); await q.fill('input[placeholder="ความหมาย TH"]','x'); await q.click('button:text-is("บันทึก")');
  res.push({label:'ls-blocked',home:h,afterAdd:await q.innerText('text=/คำรวม/'),errors:e2});
  await b.close(); console.log(JSON.stringify(res,null,1));
})();
