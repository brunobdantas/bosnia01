'use strict';

(()=>{
  const EXP_VERSION='20261005-election360-1';
  const STORAGE={
    uf:'e360-uf',
    visited:'e360-visited-ufs',
    offices:'e360-visited-offices',
    last:'e360-last-summary'
  };
  const state={
    uf:localStorage.getItem(STORAGE.uf)||'DF',
    national:null,
    races:{},
    loading:false,
    previous:null
  };
  const officeSpecs=[
    ['governor','Governador'],
    ['senator','Senado'],
    ['federalDeputy','Câmara'],
    ['stateDeputy','Assembleia']
  ];
  const palette=['#0f766e','#2563eb','#7c3aed','#c2410c','#b42318','#047857','#334155','#a16207','#0369a1','#be185d','#4d7c0f','#6d28d9'];
  const el=id=>document.getElementById(id);
  const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const pctFmt=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const safe=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function setExplorer(open){
    document.body.classList.toggle('explorer-open',!!open);
    if(open){
      requestAnimationFrame(()=>{
        const nav=document.querySelector('.race-nav-wrap');
        if(nav)nav.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }else{
      requestAnimationFrame(()=>el('experienceApp')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }

  function currentOfficeCode(key,uf){
    if(key==='stateDeputy')return uf==='DF'?'0008':'0007';
    return OFFICES[key]?.code||'';
  }

  function expUrl(key,uf){
    const o=OFFICES[key],code=currentOfficeCode(key,uf),e=String(o.election).padStart(6,'0');
    const s=(key==='president'?'br':uf.toLowerCase());
    return `${CFG.base}/${o.election}/dados/${s}/${s}-c${code}-e${e}-u.json`;
  }

  async function loadJson(key,uf){
    const url=expUrl(key,uf);
    const cacheKey=`e360-cache-${key}-${uf}`;
    try{
      const r=await fetch(url,{cache:'no-cache',headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json();
      try{localStorage.setItem(cacheKey,JSON.stringify(j))}catch{}
      return {j,stale:false};
    }catch(error){
      try{
        const c=localStorage.getItem(cacheKey);
        if(c)return {j:JSON.parse(c),stale:true,error};
      }catch{}
      return {j:null,stale:true,error};
    }
  }

  function flat(j){
    const out=[];
    for(const cargo of j?.carg||[]){
      (cargo?.agr||[]).forEach((agr,ai)=>{
        const agrKey=`agr-${ai}|${agr?.nm||''}`;
        const seats=Math.max(0,num(agr?.vag));
        for(const par of agr?.par||[])for(const c of par?.cand||[]){
          out.push({...c,party:par?.sg||'',partyName:par?.nm||'',group:agr?.nm||'',agrKey,agrSeats:seats,destination:c?.dvt||par?.dvt||''});
        }
      });
    }
    return out;
  }

  function isValid(c){
    const d=String(c?.destination||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return !d||d.startsWith('valido');
  }

  function statusOf(c,key,j){
    const raw=String(c?.st||'').trim();
    const n=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/º/g,'o');
    if(raw){
      if(n.includes('nao eleito'))return {key:'not-elected',label:raw};
      if(n.includes('suplente'))return {key:'alternate',label:raw};
      if(n.includes('2o turno')||n.includes('2 turno'))return {key:'runoff',label:raw};
      if(n.startsWith('eleito'))return {key:'elected',label:raw};
      return {key:'defined',label:raw};
    }
    if(String(c?.e||'').toLowerCase()==='s'){
      if(OFFICES[key]?.majority){
        const md=String(j?.md||'').toLowerCase();
        if(md==='e')return {key:'elected',label:'Eleito • definição matemática TSE'};
        if(md==='s')return {key:'runoff',label:'2º turno • definição matemática TSE'};
      }else return {key:'elected',label:'Eleito • TSE'};
    }
    return null;
  }

  function provisionalSet(j,key){
    if(!OFFICES[key]?.proportional||String(j?.tf||'').toLowerCase()==='s')return new Set();
    const groups=new Map();
    for(const c of flat(j)){
      if(!isValid(c))continue;
      if(!groups.has(c.agrKey))groups.set(c.agrKey,{seats:c.agrSeats,items:[]});
      groups.get(c.agrKey).items.push(c);
    }
    const ids=new Set();
    for(const g of groups.values()){
      if(!g.seats)continue;
      g.items.sort((a,b)=>num(b.vap)-num(a.vap)||num(a.n)-num(b.n));
      for(const c of g.items.slice(0,g.seats))ids.add(String(c.sqcand));
    }
    return ids;
  }

  function electedFor(j,key){
    const cs=flat(j),official=cs.filter(c=>statusOf(c,key,j)?.key==='elected');
    if(official.length)return {items:official,provisional:false};
    const ids=provisionalSet(j,key);
    return {items:cs.filter(c=>ids.has(String(c.sqcand))),provisional:ids.size>0};
  }

  function raceMetrics(j){
    if(!j)return null;
    const m=metrics(j,null);
    return {...m,stamp:[j?.dt,j?.ht].filter(Boolean).join(' ')||[j?.dg,j?.hg].filter(Boolean).join(' ')||'—'};
  }

  function partyColor(p){
    let h=0;
    for(const ch of String(p||''))h=((h<<5)-h)+ch.charCodeAt(0);
    return palette[Math.abs(h)%palette.length];
  }

  function markVisited(uf){
    let list=[];
    try{list=JSON.parse(localStorage.getItem(STORAGE.visited)||'[]')}catch{}
    if(!list.includes(uf))list.push(uf);
    localStorage.setItem(STORAGE.visited,JSON.stringify(list));
  }

  function markOffice(key){
    let list=[];
    try{list=JSON.parse(localStorage.getItem(STORAGE.offices)||'[]')}catch{}
    if(!list.includes(key))list.push(key);
    localStorage.setItem(STORAGE.offices,JSON.stringify(list));
  }

  function renderHero(){
    const j=state.national?.j;
    if(!j)return;
    const m=raceMetrics(j),cs=flat(j).sort((a,b)=>num(a.n)-num(b.n));
    el('expHeroProgress').textContent=`${pctFmt.format(m.sections)}%`;
    el('expHeroProgressBar').style.width=`${m.sections}%`;
    el('expHeroStamp').textContent=`Carga oficial • ${m.stamp}`;
    el('expStatValid').textContent=fmt.format(m.validVotes);
    el('expStatBlank').textContent=fmt.format(m.blankVotes);
    el('expStatNull').textContent=fmt.format(m.nullVotes);
    el('expStatSections').textContent=m.totalSections?`${fmt.format(m.doneSections)} / ${fmt.format(m.totalSections)}`:'—';

    const host=el('expNationalCandidates');
    host.innerHTML='';
    for(const c of cs){
      const share=candidateShare(c,j),st=statusOf(c,'president',j);
      const card=document.createElement('button');
      card.type='button';
      card.className='e360-candidate-mini';
      card.innerHTML=`<span class="e360-num">${safe(c.n||'—')}</span><span><strong>${safe(c.nmu||c.nm||'Candidatura')}</strong><small>${safe(c.party||'')} • ${pctFmt.format(share)}%</small></span>${st?`<em class="e360-status ${st.key}">${safe(st.label)}</em>`:''}`;
      card.addEventListener('click',()=>{markOffice('president');navigateRace('president','BR');setExplorer(true)});
      host.appendChild(card);
    }
  }

  function renderReturnCard(){
    const box=el('expReturnCard');
    const j=state.national?.j;
    if(!j){box.hidden=true;return}
    const m=raceMetrics(j);
    let prev=null;
    try{prev=JSON.parse(localStorage.getItem(STORAGE.last)||'null')}catch{}
    const current={idg:j.idg||'',sections:m.sections,stamp:m.stamp};
    if(prev&&prev.idg&&prev.idg!==current.idg){
      const delta=m.sections-num(prev.sections);
      box.hidden=false;
      box.innerHTML=`<span>DESDE SUA ÚLTIMA VISITA</span><strong>Nova carga oficial detectada</strong><p>A totalização nacional mudou ${Math.abs(delta)>=.00001?`em ${delta>0?'+':''}${new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:5}).format(delta)} p.p.`:'sem alteração material no percentual de seções'}.</p>`;
    }else{
      box.hidden=false;
      box.innerHTML=`<span>AGORA</span><strong>Você está na carga mais recente observada</strong><p>${m.stamp} • ${pctFmt.format(m.sections)}% das seções.</p>`;
    }
    localStorage.setItem(STORAGE.last,JSON.stringify(current));
  }

  function raceCard(key,label,j){
    const m=raceMetrics(j),e=electedFor(j,key);
    const defined=flat(j).filter(c=>statusOf(c,key,j)).length;
    const provisional=e.provisional;
    return `<button class="e360-race-card" data-race="${key}">
      <span class="e360-race-kicker">${safe(label)}</span>
      <strong>${m?pctFmt.format(m.sections)+'%':'—'}</strong>
      <small>${m?fmt.format(m.doneSections)+' seções totalizadas':'dados indisponíveis'}</small>
      <div class="e360-race-foot"><span>${e.items.length?fmt.format(e.items.length)+(provisional?' cadeiras na parcial':' eleitos'):(defined?fmt.format(defined)+' situações definidas':'aguardando definição')}</span><i>›</i></div>
    </button>`;
  }

  function renderState(){
    el('expStateName').textContent=`${state.uf} • ${UF[state.uf]}`;
    el('expStateSelect').value=state.uf;
    const host=el('expStateCards');
    host.innerHTML=officeSpecs.map(([key,label])=>raceCard(key,label,state.races[key]?.j)).join('');
    host.querySelectorAll('[data-race]').forEach(b=>b.addEventListener('click',()=>{
      const key=b.dataset.race;
      markOffice(key);
      navigateRace(key,state.uf);
      setExplorer(true);
    }));
  }

  function seatSummary(j,key){
    if(!j)return null;
    const elected=electedFor(j,key);
    const items=elected.items;
    const byParty=new Map();
    for(const c of items){
      const p=c.party||'Sem sigla';
      if(!byParty.has(p))byParty.set(p,[]);
      byParty.get(p).push(c);
    }
    return {items,provisional:elected.provisional,byParty};
  }

  function renderSeatDots(hostId,legendId,j,key,label){
    const host=el(hostId),legend=el(legendId),summary=seatSummary(j,key);
    if(!summary){host.innerHTML='<p class="e360-empty">Dados ainda indisponíveis.</p>';legend.innerHTML='';return}
    const items=[...summary.items].sort((a,b)=>String(a.party||'').localeCompare(String(b.party||''),'pt-BR')||num(a.n)-num(b.n));
    host.innerHTML=`<div class="e360-seat-head"><div><span>${label}</span><strong>${fmt.format(items.length)} cadeiras</strong></div><em>${summary.provisional?'se terminasse agora':'situação oficial'}</em></div><div class="e360-seat-dots"></div>`;
    const dots=host.querySelector('.e360-seat-dots');
    for(const c of items){
      const dot=document.createElement('button');
      dot.type='button';
      dot.className='e360-seat-dot';
      dot.style.setProperty('--party',partyColor(c.party));
      dot.title=`${c.nmu||c.nm||'Candidatura'} • ${c.party||''} • ${fmt.format(num(c.vap))} votos`;
      dot.setAttribute('aria-label',dot.title);
      dot.addEventListener('click',()=>{
        markOffice(key);
        navigateRace(key,state.uf);
        setExplorer(true);
      });
      dots.appendChild(dot);
    }
    legend.innerHTML=[...summary.byParty.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([party,arr])=>`<span><i style="--party:${partyColor(party)}"></i>${safe(party)} <b>${arr.length}</b></span>`).join('');
  }

  function renderSeats(){
    renderSeatDots('expFederalSeats','expFederalLegend',state.races.federalDeputy?.j,'federalDeputy','Câmara • '+state.uf);
    renderSeatDots('expStateSeats','expStateLegend',state.races.stateDeputy?.j,'stateDeputy',(state.uf==='DF'?'CLDF':'Assembleia')+' • '+state.uf);
  }

  function renderPassport(){
    let visited=[],offices=[];
    try{visited=JSON.parse(localStorage.getItem(STORAGE.visited)||'[]')}catch{}
    try{offices=JSON.parse(localStorage.getItem(STORAGE.offices)||'[]')}catch{}
    el('expPassportCount').textContent=`${visited.length}/27 UFs`;
    el('expPassportBar').style.width=`${100*visited.length/27}%`;
    el('expOfficeCount').textContent=`${offices.length}/5 cargos`;
    el('expOfficeBar').style.width=`${100*offices.length/5}%`;
    const grid=el('expPassportGrid');
    grid.innerHTML=CFG.ufs.map(uf=>`<button type="button" data-uf="${uf}" class="${visited.includes(uf)?'visited':''}"><strong>${uf}</strong><small>${visited.includes(uf)?'✓ explorado':UF[uf]}</small></button>`).join('');
    grid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>changeUf(b.dataset.uf,true)));
  }

  function renderDiscovery(){
    const stateCompleted=officeSpecs.filter(([key])=>state.races[key]?.j&&raceMetrics(state.races[key].j).sections>=99.99).length;
    el('expDiscovery').innerHTML=`
      <button data-jump="state"><span>01</span><strong>Meu estado em 1 tela</strong><small>${state.uf}: ${stateCompleted}/4 disputas praticamente concluídas</small></button>
      <button data-jump="seats"><span>02</span><strong>Veja as cadeiras</strong><small>Câmara e ${state.uf==='DF'?'CLDF':'Assembleia'} em uma composição visual</small></button>
      <button data-jump="passport"><span>03</span><strong>Complete o Brasil</strong><small>Explore as 27 UFs e preencha seu passaporte eleitoral</small></button>
      <button data-jump="explorer"><span>04</span><strong>Explorer completo</strong><small>Filtros, candidaturas, comparação e matemática da apuração</small></button>`;
    el('expDiscovery').querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>jumpTo(b.dataset.jump)));
  }

  function jumpTo(target){
    if(target==='explorer'){setExplorer(true);return}
    setExplorer(false);
    const map={state:'expStateSection',seats:'expSeatsSection',passport:'expPassportSection',home:'expHero'};
    el(map[target]||'expHero')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function changeUf(uf,scroll=false){
    state.uf=uf;
    localStorage.setItem(STORAGE.uf,uf);
    markVisited(uf);
    el('expStateSelect').value=uf;
    await loadState();
    renderState();renderSeats();renderPassport();renderDiscovery();
    if(scroll)el('expStateSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function loadState(){
    state.loading=true;
    const settled=await Promise.all(officeSpecs.map(async([key])=>[key,await loadJson(key,state.uf)]));
    state.races=Object.fromEntries(settled);
    state.loading=false;
  }

  async function refreshExperience(){
    if(state.loading)return;
    const national=await loadJson('president','BR');
    state.national=national;
    await loadState();
    renderHero();renderReturnCard();renderState();renderSeats();renderPassport();renderDiscovery();
    el('expLoading').hidden=true;
    el('experienceContent').hidden=false;
  }

  function shareCanvas(){
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f5f7f8';ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle='#111827';ctx.fillRect(0,0,1080,210);
    ctx.fillStyle='#fff';ctx.font='900 72px system-ui';ctx.fillText('ELEIÇÃO 360',72,105);
    ctx.font='500 30px system-ui';ctx.fillText('Eleições 2026 • dados oficiais do TSE',72,160);

    const nat=raceMetrics(state.national?.j);
    const lines=[
      ['BRASIL EM 30s',nat?`${pctFmt.format(nat.sections)}% das seções`:'—'],
      [`${state.uf} • ${UF[state.uf]}`,'Meu estado em 1 tela'],
      ['Câmara',seatSummary(state.races.federalDeputy?.j,'federalDeputy')?.items.length+' cadeiras'],
      [state.uf==='DF'?'CLDF':'Assembleia',seatSummary(state.races.stateDeputy?.j,'stateDeputy')?.items.length+' cadeiras']
    ];
    let y=330;
    for(const [a,b] of lines){
      ctx.fillStyle='#fff';ctx.strokeStyle='#d9dee3';ctx.lineWidth=2;
      roundRect(ctx,60,y,960,250,34);ctx.fill();ctx.stroke();
      ctx.fillStyle='#0f766e';ctx.font='800 28px system-ui';ctx.fillText(a,105,y+70);
      ctx.fillStyle='#111827';ctx.font='900 58px system-ui';ctx.fillText(String(b),105,y+145);
      y+=285;
    }
    ctx.fillStyle='#111827';ctx.font='900 44px system-ui';ctx.fillText('Explore. Descubra. Compartilhe.',72,1585);
    ctx.fillStyle='#667085';ctx.font='500 28px system-ui';
    wrapText(ctx,'Uma fotografia dos dados oficiais da eleição, com drill-down por UF, cargos e cadeiras.',72,1640,900,42);
    ctx.fillStyle='#0f766e';ctx.font='800 30px system-ui';ctx.fillText('brunobdantas.github.io/bosnia01',72,1810);
    ctx.fillStyle='#98a2b3';ctx.font='500 22px system-ui';ctx.fillText('Painel independente • Fonte: Tribunal Superior Eleitoral',72,1860);
    return canvas;
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  }
  function wrapText(ctx,text,x,y,maxWidth,lineHeight){
    const words=text.split(' ');let line='';
    for(const word of words){
      const test=line+word+' ';
      if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=word+' ';y+=lineHeight}
      else line=test;
    }
    if(line)ctx.fillText(line,x,y);
  }

  async function shareExperience(){
    const canvas=shareCanvas();
    const blob=await new Promise(res=>canvas.toBlob(res,'image/png',.92));
    const file=new File([blob],'eleicao-360.png',{type:'image/png'});
    const shareData={title:'Eleição 360',text:`Eleição 2026 • ${state.uf} e Brasil em uma experiência visual.`,url:location.origin+location.pathname};
    try{
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({...shareData,files:[file]});
      }else if(navigator.share){
        await navigator.share(shareData);
      }else{
        await navigator.clipboard.writeText(shareData.url);
        toast('Link copiado para compartilhar');
      }
    }catch(e){
      if(e?.name!=='AbortError')toast('Não foi possível abrir o compartilhamento');
    }
  }

  function toast(msg){
    const t=el('expToast');t.textContent=msg;t.hidden=false;
    clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2600);
  }

  function tvMode(){
    document.body.classList.toggle('e360-tv');
    if(document.body.classList.contains('e360-tv')){
      document.documentElement.requestFullscreen?.().catch(()=>{});
      jumpTo('home');
    }else if(document.fullscreenElement)document.exitFullscreen?.();
  }

  function wire(){
    document.body.classList.add('experience-ready');
    el('expStateSelect').innerHTML=CFG.ufs.map(uf=>`<option value="${uf}">${uf} • ${UF[uf]}</option>`).join('');
    el('expStateSelect').value=state.uf;
    el('expStateSelect').addEventListener('change',e=>changeUf(e.target.value,true));
    el('expShareButton').addEventListener('click',shareExperience);
    el('expTvButton').addEventListener('click',tvMode);
    el('expOpenExplorer').addEventListener('click',()=>setExplorer(true));
    document.querySelectorAll('[data-exp-nav]').forEach(b=>b.addEventListener('click',()=>jumpTo(b.dataset.expNav)));
    document.querySelectorAll('#raceTabs button').forEach(b=>b.addEventListener('click',()=>markOffice(b.dataset.race)));
    el('experienceBrand')?.addEventListener('click',e=>{e.preventDefault();setExplorer(false);jumpTo('home')});
  }

  markVisited(state.uf);
  wire();
  refreshExperience();
  setInterval(()=>{if(!document.hidden)refreshExperience()},60000);
})();
