import { chromium } from '/Users/sdulongsalazar/.npm/_npx/d537ee5ee2a13f03/node_modules/playwright/index.mjs'
import fs from 'fs'
const OUT=process.argv[2], ONLY=process.argv[3]
const BASE='http://localhost:5311/app/index.html'
const CURSOR=`(()=>{const add=()=>{if(document.getElementById('__cur'))return;const c=document.createElement('div');c.id='__cur';c.style.cssText='position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-4px,-3px);transition:none';c.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.5L9.5 19z" fill="#fff" stroke="#0E1B3D" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.appendChild(c);
addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},true);
addEventListener('mousedown',e=>{const r=document.createElement('div');r.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;left:'+(e.clientX-22)+'px;top:'+(e.clientY-22)+'px;width:44px;height:44px;border-radius:50%;border:3px solid #FFC72C;opacity:1;transition:all .5s ease-out';document.body.appendChild(r);requestAnimationFrame(()=>{r.style.transform='scale(1.6)';r.style.opacity='0'});setTimeout(()=>r.remove(),600)},true)};
if(document.body)add();else addEventListener('DOMContentLoaded',add)})()`
async function clip(name, start, fn){
  if(ONLY && ONLY!==name) return
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport:{width:1600,height:900}, recordVideo:{dir:OUT+'/raw',size:{width:1600,height:900}}, deviceScaleFactor:1 })
  await ctx.addInitScript(CURSOR)
  const p = await ctx.newPage(); const t0=Date.now()
  await p.goto(BASE+start); await p.waitForTimeout(2200); await p.mouse.move(800,450)
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
// 1 entrar a la plataforma y a ¿DT o plantilla?
await clip('c_dt','',async p=>{
  await p.waitForTimeout(600); const box=p.locator('input[placeholder*="Busca un"]').first(); await moveClick(p,box)
  await p.keyboard.type('Almada',{delay:110}); await p.waitForTimeout(700)
  await moveClick(p,p.locator('.msearch-row').first()); await p.waitForTimeout(1600)
  await moveClick(p,mode(p,'DT o plantilla')); await p.waitForTimeout(1300); await p.mouse.move(800,600,{steps:15}); await scroll(p,420); await p.waitForTimeout(1300)
})
await clip('c_res','#2947/hub',async p=>{ await moveClick(p,mode(p,'Resumen')); await p.waitForTimeout(1500); await p.mouse.move(800,600,{steps:15}); await scroll(p,500); await p.waitForTimeout(1400) })
await clip('c_juego','#2947/hub',async p=>{ await moveClick(p,mode(p,'Cómo juega')); await p.waitForTimeout(1500); await p.mouse.move(800,600,{steps:15}); await scroll(p,700,18); await p.waitForTimeout(1600) })
await clip('c_jug','#2947/hub',async p=>{ await moveClick(p,mode(p,'Jugadores')); await p.waitForTimeout(1500); await p.mouse.move(800,600,{steps:15}); await scroll(p,500); await p.waitForTimeout(1200); await moveClick(p,sub(p,'a su medida')); await p.waitForTimeout(1600) })
await clip('c_bp','#2947/hub',async p=>{ await moveClick(p,mode(p,'Balón parado')); await p.waitForTimeout(1800); await p.mouse.move(800,600,{steps:15}); await scroll(p,450); await p.waitForTimeout(1500) })
await clip('c_lab','#2947/hub',async p=>{ await moveClick(p,mode(p,'Laboratorio')); await p.waitForTimeout(1300); await moveClick(p,sub(p,'Simulador de liga')); await p.waitForTimeout(2200); await p.mouse.move(800,600,{steps:15}); await scroll(p,350); await p.waitForTimeout(1500) })
await clip('c_vs','#2947/hub',async p=>{ await moveClick(p,mode(p,'Cara a cara')); await p.waitForTimeout(1100); await moveClick(p,sub(p,'Plan contra un rival')); await p.waitForTimeout(1500); const s=p.locator('input.vs-cp-search'); await moveClick(p,s); await p.keyboard.type('Vucetich',{delay:100}); await p.waitForTimeout(900); {const row=p.locator('.vs-cp-row',{hasText:'Vucetich'}).first();const bb=await row.boundingBox();await p.mouse.move(bb.x+bb.width/3,bb.y+bb.height/2,{steps:25});await p.waitForTimeout(250);await row.click();} await p.waitForTimeout(2200); await p.mouse.move(800,600,{steps:15}); await scroll(p,380); await p.waitForTimeout(1600) })
await clip('c_lang','#2947/hub',async p=>{ await moveClick(p,p.locator('.cfg-btn').first()); await p.waitForTimeout(900); await moveClick(p,p.locator('.cfg-lang button',{hasText:'English'}).first()); await p.waitForTimeout(1200); await p.keyboard.press('Escape'); await p.mouse.click(1000,500); await p.waitForTimeout(600); await p.mouse.move(1460,845,{steps:25}); await p.waitForTimeout(1500) })
