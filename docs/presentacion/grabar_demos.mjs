import { chromium } from '/Users/sdulongsalazar/.npm/_npx/d537ee5ee2a13f03/node_modules/playwright/index.mjs'
import fs from 'fs'
const OUT=process.argv[2], ONLY=process.argv[3]
const BASE='http://localhost:5311/app/index.html'
const CURSOR=`(()=>{const add=()=>{if(document.getElementById('__cur'))return;const c=document.createElement('div');c.id='__cur';c.style.cssText='position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-4px,-3px);transition:none';c.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.5L9.5 19z" fill="#fff" stroke="#0E1B3D" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.appendChild(c);
addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},true);
addEventListener('mousedown',e=>{const r=document.createElement('div');r.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;left:'+(e.clientX-22)+'px;top:'+(e.clientY-22)+'px;width:44px;height:44px;border-radius:50%;border:3px solid #FFC72C;opacity:1;transition:all .5s ease-out';document.body.appendChild(r);requestAnimationFrame(()=>{r.style.transform='scale(1.6)';r.style.opacity='0'});setTimeout(()=>r.remove(),600)},true)};
if(document.body)add();else addEventListener('DOMContentLoaded',add)})()`
async function clip(name, start, fn, extraInit){
  if(ONLY && ONLY!==name) return
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport:{width:1920,height:1080}, recordVideo:{dir:OUT+'/raw',size:{width:1920,height:1080}}, deviceScaleFactor:1 })
  await ctx.addInitScript(CURSOR)
  if(extraInit) await ctx.addInitScript(extraInit)
  const p = await ctx.newPage(); const t0=Date.now()
  await p.goto(BASE+start); await p.waitForTimeout(2200); await p.mouse.move(960,540)
  const ts=(Date.now()-t0)/1000
  await fn(p)
  await p.waitForTimeout(600)
  const v=p.video(); await ctx.close(); await b.close()
  fs.renameSync(await v.path(), `${OUT}/raw/${name}.webm`); fs.writeFileSync(`${OUT}/raw/${name}.ss`, String(ts))
  console.log(name,'ok, start',ts.toFixed(2))
}
const moveClick=async(p,loc)=>{loc=loc.first();await loc.waitFor({state:'visible',timeout:8000});const bb=await loc.boundingBox();const x=bb.x+bb.width/2,y=bb.y+bb.height/2;await p.mouse.move(x,y,{steps:28});await p.waitForTimeout(250);await p.mouse.down();await p.mouse.up();}
const mode=(p,t)=>p.locator('.cb-mode',{hasText:t}).first()
const sub=(p,t)=>p.locator('.cb-subs button',{hasText:t}).first()
const scroll=async(p,px,steps=14)=>{for(let i=0;i<steps;i++){await p.mouse.wheel(0,px/steps);await p.waitForTimeout(45)}}
const toEnd=async(p)=>{await p.mouse.move(960,640,{steps:15});await p.waitForTimeout(1600);
  for(let k=0;k<400;k++){const [y,h,vh]=await p.evaluate(()=>[scrollY,document.documentElement.scrollHeight,innerHeight]);if(y+vh>=h-4)break;await p.mouse.wheel(0,36);await p.waitForTimeout(60)}
  await p.waitForTimeout(1500)}
// 1 entrar a la plataforma y a ¿DT o plantilla?
await clip('c_dt','',async p=>{
  await p.waitForTimeout(600); const box=p.locator('input[placeholder*="Busca un"]').first(); await moveClick(p,box)
  await p.keyboard.type('Almada',{delay:110}); await p.waitForTimeout(700)
  await moveClick(p,p.locator('.msearch-row').first()); await p.waitForTimeout(1600)
  await moveClick(p,mode(p,'DT o plantilla')); await p.waitForTimeout(1300); await toEnd(p)
})
await clip('c_map','',async p=>{ await p.waitForTimeout(800);
  await moveClick(p,p.locator('.smap-chip',{hasText:'Presión alta'})); await p.waitForTimeout(2600);
  await moveClick(p,p.locator('button',{hasText:'Elegir variables'})); await p.waitForTimeout(1200);
  const sel=p.locator('select[id^="var-"]').first(); await moveClick(p,sel); const opts=await sel.locator('option').allTextContents(); await sel.selectOption({index:Math.min(5,opts.length-1)}); await p.waitForTimeout(2600);
  await moveClick(p,p.locator('button',{hasText:'Ejes PCA'})); await p.waitForTimeout(1200);
  await moveClick(p,p.locator('button',{hasText:'3D'})); await p.waitForTimeout(3800);
  await moveClick(p,p.locator('button',{hasText:'2D'})); await p.waitForTimeout(1500) })
await clip('c_juego','#2947/hub',async p=>{ await moveClick(p,mode(p,'Cómo juega')); await p.waitForTimeout(1500); await toEnd(p) })
await clip('c_jug','#2947/hub',async p=>{ await moveClick(p,mode(p,'Jugadores')); await p.waitForTimeout(1500); await toEnd(p) })
await clip('c_bp','#2947/hub',async p=>{ await moveClick(p,mode(p,'Balón parado')); await p.waitForTimeout(1800); await toEnd(p) })
await clip('c_lab','#2947/hub',async p=>{ await moveClick(p,mode(p,'Laboratorio')); await p.waitForTimeout(1500); await toEnd(p);
  await p.evaluate(()=>scrollTo({top:0,behavior:'smooth'})); await p.waitForTimeout(1200);
  await moveClick(p,sub(p,'Simulador de liga')); await p.waitForTimeout(1800);
  await moveClick(p,p.locator('button',{hasText:'Empezar torneo'})); await p.waitForTimeout(2200);
  const play=p.locator('button',{hasText:'Jugar el partido de'}); await play.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await moveClick(p,play); await p.waitForTimeout(6000);
  const fin=p.locator('button',{hasText:'Hasta la final'}); await fin.scrollIntoViewIfNeeded().catch(()=>{}); await moveClick(p,fin); await p.waitForTimeout(4000);
  await toEnd(p) })
await clip('c_vs','#2947/hub',async p=>{ await moveClick(p,mode(p,'Cara a cara')); await p.waitForTimeout(1100); await moveClick(p,sub(p,'Plan contra un rival')); await p.waitForTimeout(1500); const s=p.locator('input.vs-cp-search'); await moveClick(p,s); await p.keyboard.type('Vucetich',{delay:100}); await p.waitForTimeout(900); {const row=p.locator('.vs-cp-row',{hasText:'Vucetich'}).first();const bb=await row.boundingBox();await p.mouse.move(bb.x+bb.width/3,bb.y+bb.height/2,{steps:25});await p.waitForTimeout(250);await row.click();} await p.waitForTimeout(2200); await toEnd(p) })
await clip('c_lang','#2947/hub',async p=>{ await moveClick(p,p.locator('.cfg-btn').first()); await p.waitForTimeout(900); await moveClick(p,p.locator('.cfg-lang button',{hasText:'English'}).first()); await p.waitForTimeout(1400); await p.keyboard.press('Escape'); await p.mouse.click(1300,700); await p.waitForTimeout(700);
  await moveClick(p,p.locator('.ai-fab')); await p.waitForTimeout(1000); const ta=p.locator('.ai-form textarea'); await moveClick(p,ta); await p.keyboard.type('How should Almada play against Tigres?',{delay:55}); await p.waitForTimeout(500);
  await moveClick(p,p.locator('.ai-send')); await p.waitForTimeout(9000) }, `window.claude={use:async n=>n==='sample'?(async(msgs,o)=>{const w=ms=>new Promise(r=>setTimeout(r,ms));await w(1200);const t=o.tools.find(x=>x.name==='open_view');await t.execute({coach_id:2947,view:'duelo',other_coach_id:3746},{});const txt="Against Víctor Vucetich's Tigres, Almada should look to receive between the lines: Vucetich's block is longer than 97% of coaches (25.7 yd vs 24.6 in the league). On defense, cover the penalty spot on his corners, send your own corners to the far post and be careful in the first 15 minutes. I opened the match plan for you.";let s='';for(const wd of txt.split(' ')){s+=(s?' ':'')+wd;o.onText&&o.onText({text:s,delta:wd});await w(45)}return {text:txt}}):null}`)
