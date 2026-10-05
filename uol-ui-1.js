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
  $('filters').hidden=!prop;
  if(!prop)return;
  const parties=[...new Set(candidates.map(c=>c.party).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const current=$('partyFilter').value;
  $('partyFilter').innerHTML='<option value="">Todos os partidos</option>'+parties.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if(parties.includes(current))$('partyFilter').value=current;
}
function candidateVisibleList(){
  const q=$('candidateSearch').value.trim().toLocaleLowerCase('pt-BR');
  const party=$('partyFilter').value;
  const elected=$('electedOnly').checked;
  return [...candidates]
    .sort((a,b)=>num(a.n)-num(b.n)||String(a.nmu||a.nm||'').localeCompare(String(b.nmu||b.nm||''),'pt-BR'))
    .filter(c=>{
      if(q&&!`${c.n||''} ${c.nmu||c.nm||''} ${c.party||''}`.toLocaleLowerCase('pt-BR').includes(q))return false;
      if(party&&c.party!==party)return false;
      if(elected&&String(c.e||'').toLowerCase()!=='s')return false;
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
    row.className='candidate-row';row.tabIndex=0;row.setAttribute('role','button');
    row.setAttribute('aria-label',`Abrir ${c.nmu||c.nm||'candidatura'}`);
    if(selected&&String(selected.sqcand)===String(c.sqcand))row.style.background='#fafbfb';
    row.appendChild(photoElement(c));
    const info=document.createElement('div');info.className='candidate-info';
    const status=officialStatus(c);
    info.innerHTML=`<div class="candidate-info-top"><strong>${esc(c.nmu||c.nm||'Candidatura')}</strong>${status?`<span class="status-badge">${esc(status)}</span>`:''}</div><small>${esc(c.party||c.partyName||'')} ${c.n?`• nº ${esc(c.n)}`:''}</small>`;
    const result=document.createElement('div');result.className='candidate-result';result.innerHTML=`<strong>${fp.format(m.candidateShare)}%</strong><span>${fi.format(m.candidateVotes)} votos</span>`;
    const compare=document.createElement('button');compare.type='button';compare.className='compare-btn'+(comparedIds.includes(String(c.sqcand))?' active':'');compare.textContent=comparedIds.includes(String(c.sqcand))?'✓ Comparando':'Comparar';
    compare.addEventListener('click',e=>{e.stopPropagation();toggleCompare(c)});
    const select=()=>{selected=c;setUrl(true);renderAll(false)};
    row.addEventListener('click',select);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
    row.append(info,result,compare);host.appendChild(row);
  }
  $('candidateCount').textContent=`${fi.format(list.length)} candidatura${list.length===1?'':'s'}`;
  $('showAllButton').hidden=list.length<=collapsedLimit;
  if(list.length>collapsedLimit)$('showAllButton').textContent=showAll?'Mostrar menos':'Todos os candidatos';
  $('candidateSectionTitle').textContent=selected?`Candidaturas • analisando ${selected.nmu||selected.nm||''}`:'Candidaturas';
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