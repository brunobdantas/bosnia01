'use strict';

function buildCartogram(){
  const host=$('cartogram');host.innerHTML='';
  for(const uf of CFG.ufs){
    const [row,col]=POS[uf]||[1,1],b=document.createElement('button');
    b.type='button';b.className='uf-tile loading';b.dataset.uf=uf;b.style.gridRow=String(row);b.style.gridColumn=String(col);b.style.setProperty('--p','0deg');
    b.innerHTML=`<span>${uf}</span><small>—</small>`;b.title=`${UF[uf]} • aguardando`;
    b.addEventListener('click',()=>changeScope(uf));host.appendChild(b);
  }
}
async function fetchProgress(uf,token){
  try{
    const o=office(),code=officeKey==='stateDeputy'?(uf==='DF'?'0008':'0007'):o.code,e=String(o.election).padStart(6,'0'),s=uf.toLowerCase();
    const url=`${CFG.base}/${o.election}/dados/${s}/${s}-c${code}-e${e}-u.json`;
    const r=await fetch(url,{cache:'no-cache',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error();const j=await r.json();if(token!==mapGeneration)return null;
    return{uf,p:pct(j?.s?.pstn??j?.s?.pst)};
  }catch{return{uf,p:null}}
}
async function refreshMap(){
  clearTimeout(mapTimer);const token=++mapGeneration,queue=[...CFG.ufs],out=[];
  const workers=Array.from({length:5},async()=>{while(queue.length){const uf=queue.shift();out.push(await fetchProgress(uf,token))}});
  await Promise.all(workers);if(token!==mapGeneration)return;
  for(const x of out){
    const el=document.querySelector(`.uf-tile[data-uf="${x.uf}"]`);if(!el)continue;
    el.classList.toggle('loading',x.p===null);el.classList.toggle('selected',scope===x.uf);
    if(x.p!==null){el.style.setProperty('--p',`${x.p*3.6}deg`);el.querySelector('small').textContent=`${fp.format(x.p)}%`;el.title=`${UF[x.uf]} • ${fp.format(x.p)}% das seções totalizadas`}
  }
  $('mapUpdated').textContent=`UFs: ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  mapTimer=setTimeout(refreshMap,CFG.mapMs);
}
function schedule(delay){clearTimeout(timer);nextAt=Date.now()+delay;if(!document.hidden)timer=setTimeout(refreshNow,delay)}
function updateCountdown(){
  if(document.hidden){$('countdownValue').textContent='Ⅱ';$('countdownLabel').textContent='pausado em 2º plano';$('countdownRing').style.setProperty('--progress','0deg');return}
  if(busy){$('countdownValue').textContent='…';$('countdownLabel').textContent='consultando TSE';$('countdownRing').style.setProperty('--progress','360deg');return}
  const delay=failures?Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs):CFG.pollMs,remaining=Math.max(0,nextAt-Date.now()),sec=remaining/1000,progress=delay?360*(1-remaining/delay):0;
  $('countdownValue').textContent=sec.toFixed(1);$('countdownLabel').textContent=failures?'nova tentativa':'até a próxima leitura';$('countdownRing').style.setProperty('--progress',`${clamp(progress,0,360)}deg`);
  if(lastSuccessAt)$('dataAge').textContent=`idade da leitura: ${Math.floor((Date.now()-lastSuccessAt)/1000)} s`;
}
async function refreshNow(){
  if(busy||document.hidden)return;busy=true;updateCountdown();let delay=CFG.pollMs;
  try{
    const r=await fetchJson(resultUrl(),storageKey());data=r.j;candidates=flattenCandidates(data);
    if(!candidates.length){source('','TSE • aguardando votos');notice('waiting','O arquivo oficial está disponível, mas ainda não trouxe candidaturas com votação neste contexto.');failures=0;return}
    chooseSelected();const fresh=!r.stale&&saveSnapshot(data);lastSuccessAt=Date.now();failures=0;
    source(r.stale?'error':'live',r.stale?'TSE • última leitura local':'TSE • dados oficiais');
    notice(r.stale?'error':'live',r.stale?'Não foi possível obter uma leitura nova; exibindo o último dado salvo neste navegador.':`${officeLabel()} • ${scopeLabel()} • atualização automática ativa.`);
    renderAll(r.stale);
    if(fresh){const card=document.querySelector('.selected-card');card?.classList.remove('flash');requestAnimationFrame(()=>card?.classList.add('flash'))}
  }catch{
    failures=Math.min(4,failures+1);delay=Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs);
    source('error','TSE • reconectando');notice('waiting',`A fonte oficial não respondeu nesta leitura. Nova tentativa automática em ${Math.round(delay/1000)} s.`);
  }finally{
    busy=false;schedule(failures?Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs):CFG.pollMs);updateCountdown();
  }
}
document.querySelectorAll('.office-card').forEach(b=>b.addEventListener('click',()=>changeOffice(b.dataset.office)));
$('scopeSelect').addEventListener('change',e=>changeScope(e.target.value));
$('brasilButton').addEventListener('click',()=>changeScope('BR'));
$('candidateSearch').addEventListener('input',renderCandidateList);
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){nextAt=0;updateCountdown()}else{refreshNow();refreshMap()}});

buildCartogram();
renderOfficeDeck();
renderScopeSelect();
updateHeadings();
renderEmptyChart();
countdownTimer=setInterval(updateCountdown,100);
refreshNow();
refreshMap();
