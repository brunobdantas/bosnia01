function scheduleNext(delay){clearTimeout(mainTimer);nextAt=Date.now()+delay;if(document.hidden){nextAt=0;return}mainTimer=setTimeout(()=>refreshNational(),delay)}
function updateCountdown(){
  if(document.hidden){$('countdownValue').textContent='Ⅱ';$('countdownLabel').textContent='pausado em 2º plano';$('countdownRing').style.setProperty('--progress','0deg');return}
  if(busy){$('countdownValue').textContent='…';$('countdownLabel').textContent='consultando TSE';$('countdownRing').style.setProperty('--progress','360deg');return}
  const delay=failureStreak?Math.min(CFG.mainMs*Math.pow(2,failureStreak),CFG.maxBackoffMs):CFG.mainMs,remaining=Math.max(0,nextAt-Date.now()),secs=remaining/1000,progress=delay?360*(1-remaining/delay):0;
  $('countdownValue').textContent=secs?secs.toFixed(1):'0';$('countdownLabel').textContent=failureStreak?'nova tentativa':'até a próxima leitura';$('countdownRing').style.setProperty('--progress',`${clamp(progress,0,360)}deg`);
  if(lastSuccessfulAt){const age=Math.max(0,(Date.now()-lastSuccessfulAt)/1000);$('dataAge').textContent=`idade da leitura: ${age<60?`${Math.floor(age)} s`:`${Math.floor(age/60)} min`}`}
}

async function refreshNational(){
  if(busy||document.hidden)return;busy=true;updateCountdown();
  let delay=CFG.mainMs;
  try{
    const r=await load(scopeUrl('BR'),'tse26-br-v2');data=r.j;cands=candidates(data);
    if(!cands.length){source('','TSE • aguardando votos');notice('waiting','O arquivo oficial está disponível, mas ainda não trouxe votação. O painel continuará tentando automaticamente.');failureStreak=0;return}
    fillSelect();const newLoad=!r.stale&&saveSnapshot(data);render(r.stale,newLoad);lastSuccessfulAt=Date.now();failureStreak=0;
    source(r.stale?'error':'live',r.stale?'TSE • última leitura local':'TSE • dados oficiais');notice(r.stale?'error':'live',r.stale?'Falha na leitura nova; exibindo o último dado salvo neste navegador.':'Conectado à fonte oficial. O painel verifica o arquivo nacional automaticamente a cada 3 segundos.');
  }catch{failureStreak=Math.min(4,failureStreak+1);delay=Math.min(CFG.mainMs*Math.pow(2,failureStreak),CFG.maxBackoffMs);source('error','TSE • reconectando');notice('waiting',`A fonte oficial não respondeu nesta leitura. Nova tentativa automática em ${Math.round(delay/1000)} s.`)}
  finally{busy=false;delay=failureStreak?Math.min(CFG.mainMs*Math.pow(2,failureStreak),CFG.maxBackoffMs):CFG.mainMs;scheduleNext(delay);updateCountdown()}
}

async function getUf(u){try{const r=await load(scopeUrl(u),`tse26-${u}-v2`,6500),list=candidates(r.j),c=list.find(x=>String(x.sqcand)===String(sel?.sqcand))||list.find(x=>String(x.n)===String(sel?.n));if(!c)return{u};const m=metrics(r.j,c);return{u,ok:true,share:m.share,sec:pct(r.j?.s?.pstn??r.j?.s?.pst)}}catch{return{u}}}
function ufCard(x){const e=document.createElement('article');e.className=`state-card${x.ok?'':' loading'}`;e.innerHTML=`<div class="uf"><strong>${x.u}</strong><span>${UF[x.u]}</span></div><strong class="uf-share">${x.ok?`${fp.format(x.share)}%`:'—'}</strong><small>${x.ok?`${fp.format(x.sec)}% das seções`:'Aguardando dado oficial'}</small>`;return e}
async function refreshUfs(){
  if(!sel||ufBusy||document.hidden)return;ufBusy=true;try{const g=$('statesGrid');if(!g.children.length)CFG.ufs.forEach(u=>g.appendChild(ufCard({u})));const q=[...CFG.ufs],out=[],workers=Array.from({length:5},async()=>{while(q.length)out.push(await getUf(q.shift()))});await Promise.all(workers);g.innerHTML='';out.sort((a,b)=>CFG.ufs.indexOf(a.u)-CFG.ufs.indexOf(b.u)).forEach(x=>g.appendChild(ufCard(x)));$('statesUpdated').textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`}finally{ufBusy=false;clearTimeout(ufTimer);if(!document.hidden)ufTimer=setTimeout(refreshUfs,CFG.ufMs)}}

$('candidateSelect').addEventListener('change',()=>{sel=cands.find(c=>String(c.sqcand)===$('candidateSelect').value)||sel;render();refreshUfs()});
$('validRate').addEventListener('input',renderSensitivity);$('simValidRate').addEventListener('input',renderScenario);$('candidateRate').addEventListener('input',renderScenario);
document.addEventListener('visibilitychange',()=>{clearTimeout(mainTimer);clearTimeout(ufTimer);if(document.hidden){nextAt=0;updateCountdown()}else{refreshNational();refreshUfs()}});

countdownTimer=setInterval(updateCountdown,100);
(async()=>{await refreshNational();await refreshUfs()})();
