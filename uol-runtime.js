'use strict';

function parseRoute(){
  const p=new URLSearchParams(location.search),slug=p.get('cargo'),uf=String(p.get('uf')||'').toUpperCase();
  officeKey=SLUG_TO_OFFICE[slug]||'president';
  if(CFG.ufs.includes(uf)){scope=uf;preferredUF=uf;localStorage.setItem('tse26-preferred-uf',uf)}
  else scope=office().scope==='federal'?'BR':preferredUF;
  if(office().scope==='state'&&scope==='BR')scope=preferredUF;
  showAll=false;loadCompared();
}
function resetForNavigation(){
  clearTimeout(timer);clearTimeout(summaryTimer);
  data=null;candidates=[];selected=null;busy=false;failures=0;nextAt=0;lastDistinctKey='';lastSuccessAt=0;showAll=false;
  $('candidateSearch').value='';$('partyFilter').value='';$('electedOnly').checked=false;$('candidateList').innerHTML='';
  $('candidateCount').textContent='—';$('progressPct').textContent='—';$('progressBar').style.width='0';$('sectionsText').textContent='— seções';
  $('historyChart').innerHTML='<text class="chart-empty" x="500" y="140" text-anchor="middle">Aguardando dados oficiais.</text>';
  $('historyPoints').textContent='0 cargas';$('comparisonPanel').hidden=true;$('compareBadge').textContent='0';
}
function navigateRace(key,newScope,push=true){
  if(!OFFICES[key])return;
  resetForNavigation();officeKey=key;
  if(office().scope==='state'){
    scope=CFG.ufs.includes(newScope)?newScope:preferredUF;
    preferredUF=scope;localStorage.setItem('tse26-preferred-uf',scope);
  }else{
    scope=(newScope==='BR'||CFG.ufs.includes(newScope))?newScope:'BR';
    if(scope!=='BR'){preferredUF=scope;localStorage.setItem('tse26-preferred-uf',scope)}
  }
  loadCompared();renderTabs();renderHeaders();setUrl(push);refreshNow();refreshSummaries();
}
function schedule(delay){clearTimeout(timer);nextAt=Date.now()+delay;if(!document.hidden)timer=setTimeout(refreshNow,delay)}
function updateCountdown(){
  if(document.hidden){$('countdownValue').textContent='Ⅱ';$('countdownLabel').textContent='pausado em 2º plano';$('countdownRing').style.setProperty('--p','0deg');return}
  if(busy){$('countdownValue').textContent='…';$('countdownLabel').textContent='consultando TSE';$('countdownRing').style.setProperty('--p','360deg');return}
  const delay=failures?Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs):CFG.pollMs,remaining=Math.max(0,nextAt-Date.now()),sec=remaining/1000,progress=delay?360*(1-remaining/delay):0;
  $('countdownValue').textContent=sec.toFixed(1);$('countdownLabel').textContent=failures?'nova tentativa':'até a próxima leitura';$('countdownRing').style.setProperty('--p',`${clamp(progress,0,360)}deg`);
}
async function refreshNow(){
  if(busy||document.hidden)return;
  busy=true;updateCountdown();let delay=CFG.pollMs;
  try{
    const r=await fetchJson(resultUrl(),storageKey());
    data=r.j;candidates=flattenCandidates(data);
    if(!candidates.length){source('','TSE • aguardando votos');notice('waiting',`${officeLabel()} • ${scopeLabel()} • aguardando votação na carga oficial.`);failures=0;return}
    chooseSelected();const fresh=!r.stale&&saveSnapshot(data);lastSuccessAt=Date.now();failures=0;
    source(r.stale?'error':'live',r.stale?'TSE • última leitura local':'TSE • dados oficiais');
    notice(r.stale?'error':'live',r.stale?'Falha na leitura nova; exibindo o último dado salvo neste navegador.':`${officeLabel()} • ${scopeLabel()} • atualização automática ativa.`);
    renderAll(r.stale);
    if(fresh&&selected){const row=[...document.querySelectorAll('.candidate-row')].find(x=>x.textContent.includes(selected.nmu||selected.nm||''));if(row){row.animate([{background:'#eaf7f4'},{background:'transparent'}],{duration:650})}}
  }catch(error){
    failures=Math.min(4,failures+1);delay=Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs);
    source('error','TSE • reconectando');notice('waiting',`A fonte oficial não respondeu nesta leitura. Nova tentativa automática em ${Math.round(delay/1000)} s.`);
  }finally{
    busy=false;schedule(failures?Math.min(CFG.pollMs*Math.pow(2,failures),CFG.maxBackoffMs):CFG.pollMs);updateCountdown();
  }
}
async function fetchProgress(key,uf){
  try{
    const r=await fetch(resultUrlFor(key,uf),{cache:'no-cache',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error();const j=await r.json();return pct(j?.s?.pstn??j?.s?.pst);
  }catch{return null}
}
async function refreshSummaries(){
  clearTimeout(summaryTimer);
  if(document.hidden)return;
  const stateScope=scope==='BR'?preferredUF:scope;
  const defs=[
    {key:'president',scope:'BR'},
    {key:'governor',scope:stateScope},
    {key:'senator',scope:stateScope},
    {key:'federalDeputy',scope:stateScope},
    {key:'stateDeputy',scope:stateScope}
  ].filter(x=>!(x.key===officeKey&&x.scope===scope));
  const items=await Promise.all(defs.map(async d=>({key:d.key,scope:d.scope,label:d.key==='stateDeputy'?(d.scope==='DF'?'Deputado Distrital':'Deputado Estadual'):OFFICES[d.key].label,location:d.scope==='BR'?'Brasil':`${d.scope} • ${UF[d.scope]}`,progress:await fetchProgress(d.key,d.scope)})));
  renderOtherRaces(items);summaryTimer=setTimeout(refreshSummaries,CFG.summaryMs);
}

for(const b of document.querySelectorAll('#raceTabs button'))b.addEventListener('click',()=>{
  const key=b.dataset.race;
  const nextScope=OFFICES[key].scope==='state'?(scope==='BR'?preferredUF:scope):scope;
  navigateRace(key,nextScope,true);
});
$('locationButton').addEventListener('click',openStateModal);
$('stateCta').addEventListener('click',openStateModal);
$('closeStateModal').addEventListener('click',closeStateModal);
$('stateModal').addEventListener('click',e=>{if(e.target===$('stateModal'))closeStateModal()});
$('stateSearch').addEventListener('input',e=>renderStates(e.target.value));
$('brOption').addEventListener('click',()=>{closeStateModal();navigateRace('president','BR',true)});
$('candidateSearch').addEventListener('input',renderCandidates);
$('partyFilter').addEventListener('change',renderCandidates);
$('electedOnly').addEventListener('change',renderCandidates);
$('showAllButton').addEventListener('click',()=>{showAll=!showAll;renderCandidates()});
$('clearCompare').addEventListener('click',()=>{comparedIds=[];saveCompared();renderCandidates();renderComparison()});
$('jumpCompare').addEventListener('click',()=>{if(!$('comparisonPanel').hidden)$('comparisonPanel').scrollIntoView({behavior:'smooth',block:'start'});else notice('waiting','Selecione candidaturas pelo botão “Comparar” na lista principal.')});
window.addEventListener('popstate',()=>{resetForNavigation();parseRoute();renderTabs();renderHeaders();refreshNow();refreshSummaries()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('stateModal').hidden)closeStateModal()});
document.addEventListener('visibilitychange',()=>{
  clearTimeout(timer);clearTimeout(summaryTimer);
  if(document.hidden){nextAt=0;updateCountdown()}
  else{refreshNow();refreshSummaries()}
});

parseRoute();
renderTabs();renderHeaders();renderStates();
countdownTimer=setInterval(updateCountdown,100);
setUrl(false);
refreshNow();
refreshSummaries();
