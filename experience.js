'use strict';

(()=>{
  const VERSION='20261005-clean-1';
  const state={
    uf:localStorage.getItem('e360-uf')||'DF',
    national:null,
    races:{},
    loading:false
  };
  const specs=[
    ['governor','Governador'],
    ['senator','Senado'],
    ['federalDeputy','Câmara'],
    ['stateDeputy','Assembleia']
  ];
  const colors=['#0f766e','#2563eb','#7c3aed','#c2410c','#0369a1','#a16207','#be185d','#4d7c0f','#334155','#6d28d9','#047857','#b42318'];
  const el=id=>document.getElementById(id);
  const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const pfmt=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function setExplorer(open){
    document.body.classList.toggle('explorer-open',!!open);
    if(open){
      requestAnimationFrame(()=>document.querySelector('.race-nav-wrap')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }else{
      requestAnimationFrame(()=>el('experienceApp')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }

  function officeCode(key,uf){
    return key==='stateDeputy'?(uf==='DF'?'0008':'0007'):OFFICES[key].code;
  }

  function urlFor(key,uf){
    const o=OFFICES[key],code=officeCode(key,uf),e=String(o.election).padStart(6,'0');
    const s=(key==='president'?'br':uf.toLowerCase());
    return `${CFG.base}/${o.election}/dados/${s}/${s}-c${code}-e${e}-u.json`;
  }

  async function loadJson(key,uf){
    const cacheKey=`e360-clean-${key}-${uf}`;
    try{
      const r=await fetch(urlFor(key,uf),{cache:'no-cache',headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json();
      try{localStorage.setItem(cacheKey,JSON.stringify(j))}catch{}
      return j;
    }catch(e){
      try{
        const c=localStorage.getItem(cacheKey);
        return c?JSON.parse(c):null;
      }catch{return null}
    }
  }

  function flat(j){
    const out=[];
    for(const cargo of j?.carg||[]){
      (cargo?.agr||[]).forEach((agr,ai)=>{
        const group=`g${ai}|${agr?.nm||''}`;
        const seats=Math.max(0,num(agr?.vag));
        for(const par of agr?.par||[])for(const c of par?.cand||[]){
          out.push({...c,party:par?.sg||'',group,seats,destination:c?.dvt||par?.dvt||''});
        }
      });
    }
    return out;
  }

  function valid(c){
    const d=String(c?.destination||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return !d||d.startsWith('valido');
  }

  function status(c,key,j){
    const raw=String(c?.st||'').trim();
    const n=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/º/g,'o');
    if(raw){
      if(n.includes('nao eleito'))return 'not-elected';
      if(n.includes('suplente'))return 'alternate';
      if(n.includes('2o turno')||n.includes('2 turno'))return 'runoff';
      if(n.startsWith('eleito'))return 'elected';
      return 'defined';
    }
    if(String(c?.e||'').toLowerCase()==='s'){
      if(OFFICES[key]?.majority){
        const md=String(j?.md||'').toLowerCase();
        if(md==='e')return 'elected';
        if(md==='s')return 'runoff';
      }else return 'elected';
    }
    return '';
  }

  function provisional(j,key){
    if(!OFFICES[key]?.proportional||String(j?.tf||'').toLowerCase()==='s')return [];
    const groups=new Map();
    for(const c of flat(j)){
      if(!valid(c))continue;
      if(!groups.has(c.group))groups.set(c.group,{seats:c.seats,items:[]});
      groups.get(c.group).items.push(c);
    }
    const out=[];
    for(const g of groups.values()){
      if(!g.seats)continue;
      g.items.sort((a,b)=>num(b.vap)-num(a.vap)||num(a.n)-num(b.n));
      out.push(...g.items.slice(0,g.seats));
    }
    return out;
  }

  function elected(j,key){
    const official=flat(j).filter(c=>status(c,key,j)==='elected');
    if(official.length)return {items:official,provisional:false};
    const current=provisional(j,key);
    return {items:current,provisional:current.length>0};
  }

  function partyColor(p){
    let h=0;
    for(const ch of String(p||''))h=((h<<5)-h)+ch.charCodeAt(0);
    return colors[Math.abs(h)%colors.length];
  }

  function raceMetrics(j){
    if(!j)return null;
    const m=metrics(j,null);
    return {...m,stamp:[j?.dt,j?.ht].filter(Boolean).join(' ')||[j?.dg,j?.hg].filter(Boolean).join(' ')||'—'};
  }

  function openRace(key,uf){
    navigateRace(key,uf);
    setExplorer(true);
  }

  function presidentStatus(j){
    if(!j)return 'Resultado nacional';
    const md=String(j?.md||'').toLowerCase();
    const tf=String(j?.tf||'').toLowerCase()==='s';
    if(tf)return 'Situação oficial publicada';
    if(md==='e')return 'Resultado matematicamente definido';
    if(md==='s')return '2º turno matematicamente definido';
    return 'Apuração nacional';
  }

  function renderNational(){
    const j=state.national,m=raceMetrics(j);
    if(!j||!m)return;
    el('expHeroProgress').textContent=`${pfmt.format(m.sections)}%`;
    el('expHeroProgressBar').style.width=`${m.sections}%`;
    el('expHeroStamp').textContent=`Carga oficial • ${m.stamp}`;
    el('expStatValid').textContent=fmt.format(m.validVotes);
    el('expStatBlank').textContent=fmt.format(m.blankVotes);
    el('expStatNull').textContent=fmt.format(m.nullVotes);
    el('expPresidentStatus').textContent=presidentStatus(j);
    el('expPresidentMeta').textContent=`${pfmt.format(m.sections)}% das seções • ${m.stamp}`;
  }

  function renderState(){
    el('expStateName').textContent=`${state.uf} • ${UF[state.uf]}`;
    el('expSeatsTitle').textContent=`Composição em ${state.uf}`;
    el('expStateSelect').value=state.uf;

    const host=el('expStateCards');
    host.innerHTML='';
    for(const [key,label] of specs){
      const j=state.races[key],m=raceMetrics(j);
      const e=j?elected(j,key):{items:[],provisional:false};
      const defined=j?flat(j).filter(c=>status(c,key,j)).length:0;
      const row=document.createElement('button');
      row.type='button';
      row.className='e360-race-row';
      const summary=e.items.length
        ? `${fmt.format(e.items.length)} ${e.provisional?'cadeiras na parcial':'eleito'+(e.items.length===1?'':'s')}`
        : defined?`${fmt.format(defined)} situações definidas`:'aguardando definição';
      row.innerHTML=`<span><strong>${safe(key==='stateDeputy'&&state.uf==='DF'?'CLDF':label)}</strong><small>${safe(summary)}</small></span><span class="e360-race-progress"><b>${m?pfmt.format(m.sections)+'%':'—'}</b><i>›</i></span>`;
      row.addEventListener('click',()=>openRace(key,state.uf));
      host.appendChild(row);
    }
  }

  function seatData(j,key){
    if(!j)return null;
    const e=elected(j,key);
    const by=new Map();
    for(const c of e.items){
      const p=c.party||'Sem sigla';
      by.set(p,(by.get(p)||0)+1);
    }
    return {total:e.items.length,provisional:e.provisional,by};
  }

  function renderSeatCard(button,j,key,label){
    const d=seatData(j,key);
    if(!d||!d.total){
      button.innerHTML=`<span>${safe(label)}</span><strong>—</strong><small>Aguardando composição</small>`;
      button.onclick=()=>openRace(key,state.uf);
      return;
    }
    const parts=[...d.by.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
    const segments=parts.map(([party,count])=>`<i class="e360-segment" style="width:${100*count/d.total}%;--party:${partyColor(party)}" title="${safe(party)} • ${count}"></i>`).join('');
    const legend=parts.slice(0,6).map(([party,count])=>`<em><i style="--party:${partyColor(party)}"></i>${safe(party)} <b>${count}</b></em>`).join('');
    button.innerHTML=`<div><span>${safe(label)}</span><strong>${fmt.format(d.total)} cadeiras</strong><small>${d.provisional?'se terminasse agora':'situação oficial'}</small></div><div class="e360-seat-bar">${segments}</div><div class="e360-seat-legend">${legend}</div>`;
    button.onclick=()=>openRace(key,state.uf);
  }

  function renderSeats(){
    renderSeatCard(el('expFederalSeats'),state.races.federalDeputy,'federalDeputy','Câmara');
    renderSeatCard(el('expStateSeats'),state.races.stateDeputy,'stateDeputy',state.uf==='DF'?'CLDF':'Assembleia');
    const provisional=[state.races.federalDeputy,state.races.stateDeputy].some(j=>seatData(j,j===state.races.federalDeputy?'federalDeputy':'stateDeputy')?.provisional);
    el('expSeatNote').textContent=provisional
      ? 'Composição parcial baseada nas vagas informadas pelo TSE na carga atual. Pode mudar até a totalização final.'
      : 'Composição baseada na situação oficial publicada pelo TSE.';
  }

  async function changeUf(uf){
    state.uf=uf;
    localStorage.setItem('e360-uf',uf);
    await loadState();
    renderState();
    renderSeats();
  }

  async function loadState(){
    const rows=await Promise.all(specs.map(async([key])=>[key,await loadJson(key,state.uf)]));
    state.races=Object.fromEntries(rows);
  }

  async function refresh(){
    if(state.loading)return;
    state.loading=true;
    state.national=await loadJson('president','BR');
    await loadState();
    renderNational();
    renderState();
    renderSeats();
    el('expLoading').hidden=true;
    el('experienceContent').hidden=false;
    state.loading=false;
  }

  function toast(msg){
    const t=el('expToast');
    t.textContent=msg;t.hidden=false;
    clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2200);
  }

  function cardCanvas(){
    const c=document.createElement('canvas');
    c.width=1080;c.height=1350;
    const x=c.getContext('2d');
    x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#101828';x.font='900 64px system-ui';x.fillText('ELEIÇÃO 360',70,105);
    x.fillStyle='#667085';x.font='500 26px system-ui';x.fillText('Eleições 2026 • fonte TSE',70,150);
    const m=raceMetrics(state.national);
    x.fillStyle='#0f766e';x.font='900 150px system-ui';x.fillText(m?`${pfmt.format(m.sections)}%`:'—',70,340);
    x.fillStyle='#475467';x.font='600 28px system-ui';x.fillText('das seções totalizadas no Brasil',76,390);
    x.fillStyle='#101828';x.font='800 46px system-ui';x.fillText(`${state.uf} • ${UF[state.uf]}`,70,520);
    const rows=specs.map(([key,label])=>{
      const j=state.races[key],rm=raceMetrics(j),e=j?elected(j,key):{items:[],provisional:false};
      return [key==='stateDeputy'&&state.uf==='DF'?'CLDF':label,rm?`${pfmt.format(rm.sections)}%`:'—',e.items.length?`${e.items.length} ${e.provisional?'cadeiras na parcial':'eleitos'}`:'—'];
    });
    let y=620;
    for(const [a,b,d] of rows){
      x.fillStyle='#f5f7f8';x.beginPath();x.roundRect(60,y,960,130,24);x.fill();
      x.fillStyle='#101828';x.font='800 30px system-ui';x.fillText(a,90,y+50);
      x.font='900 38px system-ui';x.fillText(b,90,y+98);
      x.fillStyle='#667085';x.font='600 24px system-ui';x.fillText(d,430,y+88);
      y+=150;
    }
    x.fillStyle='#98a2b3';x.font='500 22px system-ui';x.fillText('brunobdantas.github.io/bosnia01',70,1280);
    return c;
  }

  async function share(){
    const canvas=cardCanvas();
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png',.92));
    const file=new File([blob],'eleicao-360.png',{type:'image/png'});
    const payload={title:'Eleição 360',text:`Resultados das Eleições 2026 • ${state.uf}`,url:location.origin+location.pathname};
    try{
      if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({...payload,files:[file]});
      else if(navigator.share)await navigator.share(payload);
      else{await navigator.clipboard.writeText(payload.url);toast('Link copiado')}
    }catch(e){if(e?.name!=='AbortError')toast('Não foi possível compartilhar')}
  }

  function wire(){
    document.body.classList.add('experience-ready');
    el('expStateSelect').innerHTML=CFG.ufs.map(uf=>`<option value="${uf}">${uf} • ${UF[uf]}</option>`).join('');
    el('expStateSelect').value=state.uf;
    el('expStateSelect').addEventListener('change',e=>changeUf(e.target.value));
    el('expOpenExplorer').addEventListener('click',()=>setExplorer(true));
    el('expShareButton').addEventListener('click',share);
    el('expPresidentOpen').addEventListener('click',()=>openRace('president','BR'));
    el('experienceBrand')?.addEventListener('click',e=>{e.preventDefault();setExplorer(false)});
  }

  wire();
  refresh();
  setInterval(()=>{if(!document.hidden)refresh()},60000);
})();
