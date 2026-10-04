'use strict';
function renderScopeSelect(){
  const s=$('scopeSelect'),prev=scope;s.innerHTML='';
  for(const uf of CFG.ufs){const o=document.createElement('option');o.value=uf;o.textContent=`${uf} — ${UF[uf]}`;s.appendChild(o)}
  if(prev!=='BR'&&CFG.ufs.includes(prev))s.value=prev;else s.value=localStorage.getItem('tse26-last-uf')||'DF';
  $('brasilButton').disabled=office().scope!=='federal';$('brasilButton').classList.toggle('selected',scope==='BR');
}
function renderOfficeDeck(){document.querySelectorAll('.office-card').forEach(b=>b.classList.toggle('active',b.dataset.office===officeKey));$('stateDeputyCardLabel').textContent=scope==='DF'?'Dep. Distrital':'Dep. Estadual/Distrital'}
function updateHeadings(){const title=`${officeLabel()} • ${scopeLabel()}`;$('scopeTitle').textContent=title;$('selectedOfficeTitle').textContent=title;$('officeRule').textContent=office().rule;$('contextTitle').textContent=officeLabel();$('scopeKicker').textContent=office().scope==='federal'&&scope==='BR'?'TOTALIZAÇÃO NACIONAL':'CONTEXTO ESTADUAL';renderContextCopy()}
function resetContext(){clearTimeout(timer);data=null;candidates=[];selected=null;failures=0;lastDistinctKey='';$('candidateSearch').value='';$('candidateList').innerHTML='';$('candidateName').textContent='Selecione uma candidatura';$('candidateParty').textContent='—';renderEmptyChart()}
function changeOffice(key){if(!OFFICES[key]||key===officeKey)return;officeKey=key;if(office().scope==='state'&&scope==='BR')scope=localStorage.getItem('tse26-last-uf')||'DF';if(office().scope==='federal'&&!scope)scope='BR';resetContext();renderOfficeDeck();renderScopeSelect();updateHeadings();refreshNow();refreshMap(true)}
function changeScope(value){if(value==='BR'&&office().scope!=='federal')return;scope=value;if(scope!=='BR')localStorage.setItem('tse26-last-uf',scope);resetContext();renderScopeSelect();renderOfficeDeck();updateHeadings();refreshNow();refreshMap(false)}

function renderCandidateList(){
  const host=$('candidateList'),q=$('candidateSearch').value.trim().toLocaleLowerCase('pt-BR');
  const sorted=[...candidates].sort((a,b)=>num(a.n)-num(b.n)||String(a.nmu||a.nm||'').localeCompare(String(b.nmu||b.nm||''),'pt-BR'));
  const filtered=sorted.filter(c=>!q||`${c.n||''} ${c.nmu||c.nm||''} ${c.party||c.partyName||''}`.toLocaleLowerCase('pt-BR').includes(q)),shown=filtered.slice(0,120);
  host.innerHTML='';
  for(const c of shown){
    const row=document.createElement('div');
    row.className='candidate-row';
    row.dataset.sqcand=String(c.sqcand||'');
    row.setAttribute('role','option');
    row.setAttribute('aria-selected',String(selected&&String(c.sqcand)===String(selected.sqcand)));

    const open=document.createElement('button');
    open.type='button';
    open.className='candidate-open';
    open.innerHTML=`<span class="candidate-number">${esc(c.n||'—')}</span><span class="candidate-copy"><strong>${esc(c.nmu||c.nm||'Candidatura')}</strong><small>${esc(c.party||c.partyName||'')}</small></span><span class="candidate-arrow">›</span>`;
    open.addEventListener('click',()=>{selected=c;renderAll();row.scrollIntoView({block:'nearest'})});

    row.appendChild(open);
    host.appendChild(row);
  }
  $('candidateCount').textContent=`${fi.format(candidates.length)} candidaturas`;
  $('candidateHint').textContent=filtered.length>shown.length?`Exibindo ${shown.length} de ${fi.format(filtered.length)} correspondências. Refine a busca.`:filtered.length?`${fi.format(filtered.length)} correspondência${filtered.length===1?'':'s'}.`:'Nenhuma candidatura encontrada.';
}

function mathItem(label,value,small){return`<div class="math-item"><span>${label}</span><strong>${value}</strong><small>${small}</small></div>`}
function renderMath(m){
  const band=$('mathBand'),marker=$('mathMarker');
  if(office().majority){
    const x=majorityMath(m);
    $('mathTitle').textContent='Envelope final aritmético';$('mathHeadline').textContent=`${fp.format(x.minShare)}% — ${fp.format(x.maxShare)}%`;
    band.style.left=`${clamp(x.minShare,0,100)}%`;band.style.width=`${clamp(x.maxShare-x.minShare,0,100)}%`;marker.style.left='50%';
    $('mathMin').textContent=`${fp.format(x.minShare)}%`;$('mathCenter').textContent='50%';$('mathMax').textContent=`${fp.format(x.maxShare)}%`;
    $('mathSummary').textContent=`Com o teto de ${fi.format(m.rem)} eleitores ainda em seções não totalizadas, a candidatura está ${x.diffCurrent>=0?fi.format(x.diffCurrent)+' votos acima':fi.format(-x.diffCurrent)+' votos abaixo'} da maioria dos válidos já computados. No cenário extremo de máximo de novos válidos, seriam necessários ${fi.format(x.needExtreme)} votos adicionais para ultrapassar metade do total final.`;
  }else{
    const x=genericRange(m);
    $('mathTitle').textContent='Intervalo aritmético de participação';$('mathHeadline').textContent=`${fp.format(x.min)}% — ${fp.format(x.max)}%`;
    band.style.left=`${clamp(x.min,0,100)}%`;band.style.width=`${clamp(x.max-x.min,0,100)}%`;marker.style.left=`${clamp(m.share,0,100)}%`;
    $('mathMin').textContent=`${fp.format(x.min)}%`;$('mathCenter').textContent=`agora ${fp.format(m.share)}%`;$('mathMax').textContent=`${fp.format(x.max)}%`;
    $('mathSummary').textContent=office().senate?`O intervalo usa somente o teto de ${fi.format(m.rem)} eleitores ainda não totalizados. Em 2026 cada eleitor pode votar em duas candidaturas ao Senado; uma candidatura individual pode receber no máximo um voto adicional de cada eleitor.`:`O intervalo usa apenas a votação atual e o teto de ${fi.format(m.rem)} eleitores ainda não totalizados. Ele não estima distribuição de cadeiras nem antecipa quocientes eleitorais ou partidários.`;
  }
}

function renderAll(stale=false){
  if(!data||!selected)return;const m=metrics(data,selected),h=candidateHistory(),a=h.at(-2),b=h.at(-1);
  $('scopeProgress').textContent=`${fp.format(m.sections)}%`;$('scopeRing').style.setProperty('--p',`${m.sections*3.6}deg`);$('scopeSections').textContent=m.totalSections?`${fi.format(m.doneSections)} de ${fi.format(m.totalSections)} seções`:'—';
  $('candidateName').textContent=selected.nmu||selected.nm||'Candidatura';$('candidateParty').textContent=[selected.party,selected.group].filter(Boolean).join(' • ')||'—';$('candidateNumber').textContent=selected.n?`nº ${selected.n}`:'nº —';$('candidateVotes').textContent=`${fi.format(m.cv)} votos`;
  $('candidateShare').textContent=m.vv?`${fp.format(m.share)}%`:'—';$('candidateRing').style.setProperty('--p',`${clamp(m.share*3.6,0,360)}deg`);
  $('sectionsPct').textContent=`${fp.format(m.sections)}%`;$('sectionsCount').textContent=m.totalSections?`${fi.format(m.doneSections)} de ${fi.format(m.totalSections)}`:'—';$('validVotes').textContent=fi.format(m.vv);$('totalVotes').textContent=m.totalVotes?`${fi.format(m.totalVotes)} votos totais`:'—';
  $('deltaVotes').textContent=a&&b?signed(b.cv-a.cv):'—';$('deltaShare').textContent=a&&b?`${signed(b.share-a.share,fpp)} p.p. • ${signed(b.sections-a.sections,fpp)} p.p. seções`:'aguardando 2ª carga distinta';
  const when=[data.dg,data.hg].filter(Boolean).join(' às ');$('lastUpdate').textContent=`Última leitura: ${when||new Date().toLocaleTimeString('pt-BR')}${stale?' • cache local':''}`;
  renderMath(m);renderHistory();renderCandidateList();updateHeadings();
}

function renderHistory(){
  const svg=$('historyChart'),h=candidateHistory().slice(-90);$('historyPoints').textContent=`${h.length} ${h.length===1?'carga':'cargas'}`;
  if(h.length<2){renderEmptyChart();return}
  const W=1000,H=280,L=58,R=22,T=18,B=40,xmin=Math.min(...h.map(x=>x.sections)),xmax=Math.max(...h.map(x=>x.sections)),rmin=Math.min(...h.map(x=>x.share)),rmax=Math.max(...h.map(x=>x.share)),pad=Math.max(.08,(rmax-rmin)*.3),ymin=Math.max(0,rmin-pad),ymax=Math.min(100,rmax+pad),xs=Math.max(.01,xmax-xmin),ys=Math.max(.01,ymax-ymin),sx=x=>L+(x-xmin)/xs*(W-L-R),sy=y=>T+(ymax-y)/ys*(H-T-B),pts=h.map(x=>[sx(x.sections),sy(x.share),x]),path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '),area=`${path} L${pts.at(-1)[0].toFixed(2)},${H-B} L${pts[0][0].toFixed(2)},${H-B} Z`;
  let out='<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#46d7c5" stop-opacity=".22"/><stop offset="100%" stop-color="#46d7c5" stop-opacity="0"/></linearGradient></defs>';
  for(const k of [0,.25,.5,.75,1]){const y=ymin+k*(ymax-ymin),py=sy(y);out+=`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${py}" y2="${py}"/><text class="chart-axis" x="${L-10}" y="${py+4}" text-anchor="end">${fp.format(y)}%</text>`}
  for(const k of [0,.25,.5,.75,1]){const x=xmin+k*(xmax-xmin),px=sx(x);out+=`<text class="chart-axis" x="${px}" y="${H-12}" text-anchor="middle">${fp.format(x)}%</text>`}
  out+=`<path class="chart-area" d="${area}"/><path class="chart-path" d="${path}"/>`;const step=Math.max(1,Math.ceil(pts.length/24));
  pts.forEach((p,i)=>{if(i%step===0||i===pts.length-1)out+=`<circle class="chart-dot" cx="${p[0]}" cy="${p[1]}" r="4"><title>${esc(p[2].label||'Carga TSE')} • ${fp.format(p[2].sections)}% seções • ${fp.format(p[2].share)}%</title></circle>`});svg.innerHTML=out;
}
function renderEmptyChart(){$('historyChart').innerHTML='<text class="chart-empty" x="500" y="140" text-anchor="middle">O gráfico aparece após duas cargas oficiais distintas.</text>'}
function renderContextCopy(){
  const host=$('contextCopy');let parts;
  if(office().majority)parts=[['Regra do painel','A referência visual de 50% representa maioria absoluta dos votos válidos.'],['Envelope extremo','Mostra apenas percentuais finais aritmeticamente possíveis usando o teto de eleitores ainda não totalizados.'],['Sem previsão','O intervalo não usa tendência geográfica, pesquisas ou extrapolação da parcial.']];
  else if(office().senate)parts=[['Duas vagas','Em 2026 são escolhidos dois senadores por UF; cada eleitor pode votar em duas candidaturas diferentes.'],['Participação','O percentual exibido usa a base válida informada na carga oficial.'],['Sem projeção','O portal não converte a parcial em previsão de ocupação das vagas.']];
  else parts=[['Sistema proporcional','Deputados são eleitos pelo sistema proporcional, que envolve votação de partidos/federações e distribuição de cadeiras.'],['Leitura da parcial','O portal mostra somente votos oficiais, participação e evolução observada.'],['Sem cadeiras projetadas','Nenhuma parcial é transformada em previsão de eleitos ou distribuição futura de cadeiras.']];
  host.innerHTML=parts.map(([a,b])=>`<div><strong>${a}</strong><span>${b}</span></div>`).join('');
}
