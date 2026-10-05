'use strict';

const PALETTE=['#128c7e','#1769aa','#b06f11','#7653a6'];

function setUrl(push=true){
  const p=new URLSearchParams();
  p.set('cargo',office().slug);
  p.set('uf',scope);
  if(selected?.sqcand)p.set('cand',String(selected.sqcand));
  const u=`${location.pathname}?${p.toString()}`;
  window.history[push?'pushState':'replaceState']({},'',u);
}
function renderTabs(){
  document.querySelectorAll('#raceTabs button').forEach(b=>b.classList.toggle('active',b.dataset.race===officeKey));
}
function renderHeaders(){
  $('raceTitle').textContent=officeLabel();
  $('raceRule').textContent=office().rule;
  $('resultLocation').textContent=scopeLabel();
  $('locationLabel').textContent=scopeLabel();
  const sideScope=scope==='BR'?preferredUF:scope;
  $('sideUf').textContent=sideScope;
  $('sideTitle').textContent=`Resumo • ${sideScope}`;
  $('stateCta').querySelector('span').textContent=officeKey==='president'?'Ver apuração por estado':'Trocar estado';
}
function renderFilters(){
  const prop=!!office().proportional;
  $('searchField').hidden=!prop;
  $('partyField').hidden=!prop;

  if(prop){
    const parties=[...new Set(candidates.map(c=>c.party).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const current=$('partyFilter').value;
    $('partyFilter').innerHTML='<option value="">Todos os partidos</option>'+parties.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if(parties.includes(current))$('partyFilter').value=current;
  }

  const order=[
    ['current-elected','Eleito se terminasse agora'],
    ['elected','Eleitos'],
    ['runoff','2º turno'],
    ['alternate','Suplentes'],
    ['not-elected','Não eleitos'],
    ['defined','Situação definida']
  ];
  const present=new Set(candidates.map(statusMeta).filter(Boolean).map(s=>s.key));
  const select=$('statusFilter');
  const pending=$('statusPending');

  if(present.size===0){
    statusFilter='all';
    select.innerHTML='<option value="all">Aguardando definição da parcial</option>';
    select.value='all';
    select.disabled=true;
    $('statusField').hidden=false;
    if(pending){
      const m=metrics(data,null);
      const sections=m.totalSections?`${fi.format(m.doneSections)} de ${fi.format(m.totalSections)} seções totalizadas`:'totalização ainda em andamento';
      pending.hidden=false;
      pending.innerHTML=`<strong>Ainda não há distribuição parcial de cadeiras disponível nesta carga.</strong><span>${sections}. O filtro será ativado automaticamente quando o TSE informar vagas em <code>agr.vag</code> ou publicar a situação oficial.</span>`;
    }
  }else{
    select.disabled=false;
    select.innerHTML='<option value="all">Todas as situações</option>'+order.filter(([key])=>present.has(key)).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
    if(statusFilter!=='all'&&!present.has(statusFilter))statusFilter='all';
    select.value=statusFilter;
    $('statusField').hidden=false;

    if(pending&&present.has('current-elected')){
      const m=metrics(data,null);
      const count=candidates.filter(c=>statusMeta(c)?.key==='current-elected').length;
      pending.hidden=false;
      pending.innerHTML=`<strong>${fi.format(count)} candidatura${count===1?'':'s'} marcada${count===1?'':'s'} como “Eleito se terminasse agora”.</strong><span>Cálculo da carga atual usando o número de vagas <code>vag</code> informado pelo TSE para cada partido/federação e a votação nominal dentro de cada agrupamento. Pode mudar com novas urnas.</span>`;
    }else if(pending){
      pending.hidden=true;
    }
  }
  $('filters').hidden=!prop&&present.size===0;
}

function candidateVisibleList(){
  const q=$('candidateSearch').value.trim().toLocaleLowerCase('pt-BR');
  const party=$('partyFilter').value;
  return [...candidates]
    .sort((a,b)=>num(a.n)-num(b.n)||String(a.nmu||a.nm||'').localeCompare(String(b.nmu||b.nm||''),'pt-BR'))
    .filter(c=>{
      if(q&&!`${c.n||''} ${c.nmu||c.nm||''} ${c.party||''}`.toLocaleLowerCase('pt-BR').includes(q))return false;
      if(party&&c.party!==party)return false;
      if(statusFilter!=='all'&&statusMeta(c)?.key!==statusFilter)return false;
      return true;
    });
}
function photoElement(c,small=false){
  const wrap=document.createElement('span');
  wrap.className=small?'photo-fallback':'candidate-photo fallback';
  wrap.textContent=initials(c);
  const img=document.createElement('img');
  img.className=small?'compare-photo':'candidate-photo';
  img.src=photoUrl(c);img.alt='';img.loading='lazy';
  img.addEventListener('load',()=>wrap.replaceWith(img));
  img.addEventListener('error',()=>{});
  return wrap;
}
function renderCandidates(){
  const host=$('candidateList'),list=candidateVisibleList(),collapsedLimit=office().proportional?20:4,limit=showAll?list.length:collapsedLimit,shown=list.slice(0,limit);
  host.innerHTML='';
  for(const c of shown){
    const m=metrics(data,c),row=document.createElement('div');
    const sm=statusMeta(c);
    row.className='candidate-row'+(sm?` status-${sm.key}`:'');row.tabIndex=0;row.setAttribute('role','button');
    row.setAttribute('aria-label',`Abrir ${c.nmu||c.nm||'candidatura'}${sm?`, ${sm.label}`:''}`);
    if(selected&&String(selected.sqcand)===String(c.sqcand))row.classList.add('selected');
    row.appendChild(photoElement(c));
    const info=document.createElement('div');info.className='candidate-info';
    info.innerHTML=`<div class="candidate-info-top"><strong>${esc(c.nmu||c.nm||'Candidatura')}</strong>${sm?`<span class="status-badge ${sm.key}"><b>${esc(sm.icon)}</b> ${esc(sm.label)}</span>`:''}</div><small>${esc(c.party||c.partyName||'')} ${c.n?`• nº ${esc(c.n)}`:''}</small>`;
    const result=document.createElement('div');result.className='candidate-result';result.innerHTML=`<strong>${fp.format(m.candidateShare)}%</strong><span>${fi.format(m.candidateVotes)} votos</span>`;
    const compare=document.createElement('button');compare.type='button';compare.className='compare-btn'+(comparedIds.includes(String(c.sqcand))?' active':'');compare.textContent=comparedIds.includes(String(c.sqcand))?'✓ Comparando':'Comparar';
    compare.addEventListener('click',e=>{e.stopPropagation();toggleCompare(c)});
    const select=()=>{selected=c;setUrl(true);renderAll(false)};
    row.addEventListener('click',select);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
    row.append(info,result,compare);host.appendChild(row);
  }
  renderStatusLegend();
  $('candidateCount').textContent=`${fi.format(list.length)} candidatura${list.length===1?'':'s'}`;
  $('showAllButton').hidden=list.length<=collapsedLimit;
  if(list.length>collapsedLimit)$('showAllButton').textContent=showAll?'Mostrar menos':'Todos os candidatos';
  $('candidateSectionTitle').textContent=selected?`Candidaturas • analisando ${selected.nmu||selected.nm||''}`:'Candidaturas';
}
function renderStatusLegend(){
  const host=$('statusLegend');
  const order=[
    ['current-elected','Eleito se terminasse agora'],
    ['elected','Eleito'],
    ['runoff','2º turno'],
    ['alternate','Suplente'],
    ['not-elected','Não eleito'],
    ['defined','Situação definida']
  ];
  const counts=new Map();
  for(const c of candidates){const st=statusMeta(c);if(st)counts.set(st.key,(counts.get(st.key)||0)+1)}
  const items=order.filter(([key])=>counts.has(key));
  host.hidden=items.length===0;
  host.innerHTML='';
  for(const [key,label] of items){
    const b=document.createElement('button');
    b.type='button';
    b.className=`status-chip ${key}${statusFilter===key?' active':''}`;
    b.innerHTML=`<span>${esc(label)}</span><b>${fi.format(counts.get(key))}</b>`;
    b.addEventListener('click',()=>{statusFilter=statusFilter===key?'all':key;$('statusFilter').value=statusFilter;renderCandidates()});
    host.appendChild(b);
  }
}

function renderVoteSummary(m){
  const total=m.totalVotes;
  const p=v=>total?`${fp.format(100*v/total)}%`:'—';
  $('blankVotes').textContent=fi.format(m.blankVotes);$('blankPct').textContent=p(m.blankVotes);
  $('nullVotes').textContent=fi.format(m.nullVotes);$('nullPct').textContent=p(m.nullVotes);
  $('validVotes').textContent=fi.format(m.validVotes);$('validPct').textContent=p(m.validVotes);
}
function mathCard(label,value,small){return`<div><span>${label}</span><strong>${value}</strong><small>${small}</small></div>`}
function renderMath(m){
  const host=$('mathCards'),wrap=$('mathBandWrap');
  if(!selected){host.innerHTML='';wrap.hidden=true;return}
  if(office().majority){
    const x=majorityMath(m);
    host.innerHTML=[
      mathCard('Candidatura analisada',esc(selected.nmu||selected.nm||''),`${fp.format(m.candidateShare)}% dos válidos apurados`),
      mathCard('Distância para 50% + 1 agora',signed(x.diffCurrent),x.diffCurrent>=0?'acima da referência atual':'abaixo da referência atual'),
      mathCard('Eleitorado em seções não totalizadas',fi.format(m.remaining),'teto de votos adicionais possíveis')
    ].join('');
    wrap.hidden=false;$('mathBandHeadline').textContent=`${fp.format(x.minShare)}% — ${fp.format(x.maxShare)}%`;
    $('mathBand').style.left=`${clamp(x.minShare,0,100)}%`;$('mathBand').style.width=`${clamp(x.maxShare-x.minShare,0,100)}%`;$('mathMarker').style.left='50%';
    $('mathMin').textContent=`${fp.format(x.minShare)}%`;$('mathMid').textContent='50%';$('mathMax').textContent=`${fp.format(x.maxShare)}%`;
  }else{
    const x=genericRange(m);
    host.innerHTML=[
      mathCard('Candidatura analisada',esc(selected.nmu||selected.nm||''),`${fp.format(m.candidateShare)}% na carga atual`),
      mathCard('Votos atuais',fi.format(m.candidateVotes),'valor oficial mais recente'),
      mathCard('Eleitorado em seções não totalizadas',fi.format(m.remaining),'limite aritmético restante')
    ].join('');
    wrap.hidden=false;$('mathBandHeadline').textContent=`${fp.format(x.min)}% — ${fp.format(x.max)}%`;
    $('mathBand').style.left=`${clamp(x.min,0,100)}%`;$('mathBand').style.width=`${clamp(x.max-x.min,0,100)}%`;$('mathMarker').style.left=`${clamp(m.candidateShare,0,100)}%`;
    $('mathMin').textContent=`${fp.format(x.min)}%`;$('mathMid').textContent=`agora ${fp.format(m.candidateShare)}%`;$('mathMax').textContent=`${fp.format(x.max)}%`;
  }
}
function renderDefinitionBanner(){
  const banner=$('definitionBanner');
  const eyebrow=$('definitionEyebrow');
  const title=$('definitionTitle');
  const text=$('definitionText');
  const chips=$('definitionChips');
  if(!banner||!data)return;

  const metas=candidates.map(c=>({c,s:statusMeta(c)})).filter(x=>x.s);
  const current=metas.filter(x=>x.s.key==='current-elected');
  const elected=metas.filter(x=>x.s.key==='elected');
  const runoff=metas.filter(x=>x.s.key==='runoff');
  const tf=String(data?.tf||'').toLowerCase()==='s';
  const md=String(data?.md||'').toLowerCase();

  chips.innerHTML='';
  eyebrow.textContent='DEFINIÇÃO OFICIAL DO TSE';
  banner.classList.remove('partial');
  let visible=false;

  if(office().proportional&&current.length&&!tf){
    visible=true;
    banner.classList.add('partial');
    eyebrow.textContent='LEITURA DA PARCIAL';
    title.textContent='Eleito se terminasse agora';
    text.textContent=`Com a distribuição de vagas informada pelo TSE nesta carga, ${fi.format(current.length)} candidatura${current.length===1?'':'s'} ocuparia${current.length===1?'':'m'} cadeira se a apuração terminasse neste instante. A composição pode mudar com novas urnas.`;
    for(const x of current.slice(0,12)){
      chips.insertAdjacentHTML('beforeend',`<span class="definition-chip current-elected">1 ${esc(x.c.nmu||x.c.nm||'Candidatura')}</span>`);
    }
    if(current.length>12)chips.insertAdjacentHTML('beforeend',`<span class="definition-chip more">+${current.length-12}</span>`);
  }else if(office().majority&&md==='e'&&elected.length){
    visible=true;
    title.textContent='Resultado matematicamente definido pelo TSE';
    text.textContent=tf?'A totalização final já atribuiu o resultado.':'O TSE já marcou a eleição como matematicamente definida, mesmo com seções ainda em totalização.';
    for(const x of elected)chips.insertAdjacentHTML('beforeend',`<span class="definition-chip elected">✓ ${esc(x.c.nmu||x.c.nm||'Candidatura')} • Eleito</span>`);
  }else if(office().majority&&md==='s'&&runoff.length){
    visible=true;
    title.textContent='Segundo turno matematicamente definido pelo TSE';
    text.textContent=tf?'A totalização final confirmou o segundo turno.':'O TSE já informou que haverá 2º turno antes da conclusão de todas as seções.';
    for(const x of runoff)chips.insertAdjacentHTML('beforeend',`<span class="definition-chip runoff">2º ${esc(x.c.nmu||x.c.nm||'Candidatura')}</span>`);
  }else if(!office().majority&&elected.some(x=>x.s.early)){
    visible=true;
    title.textContent='Eleitos já definidos pelo TSE';
    text.textContent='O arquivo oficial já marca candidatura(s) como eleita(s), embora a totalização da abrangência ainda não tenha sido finalizada.';
    for(const x of elected.slice(0,12))chips.insertAdjacentHTML('beforeend',`<span class="definition-chip elected">✓ ${esc(x.c.nmu||x.c.nm||'Candidatura')}</span>`);
    if(elected.length>12)chips.insertAdjacentHTML('beforeend',`<span class="definition-chip more">+${elected.length-12}</span>`);
  }else if(tf&&(elected.length||runoff.length)){
    visible=true;
    title.textContent='Situação oficial do TSE';
    text.textContent='A totalização final já atribuiu a situação oficial das candidaturas.';
    for(const x of [...elected,...runoff].slice(0,12))chips.insertAdjacentHTML('beforeend',`<span class="definition-chip ${x.s.key}">${x.s.icon} ${esc(x.c.nmu||x.c.nm||'Candidatura')} • ${esc(x.s.label)}</span>`);
  }

  banner.hidden=!visible;
}

