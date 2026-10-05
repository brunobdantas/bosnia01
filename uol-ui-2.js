
function renderLoadMeta(m){
  $('progressPct').textContent=`${fp.format(m.sections)}%`;$('progressBar').style.width=`${m.sections}%`;
  $('sectionsText').textContent=m.totalSections?`${fi.format(m.doneSections)} de ${fi.format(m.totalSections)} seções`:'—';
  $('totalVotes').textContent=fi.format(m.totalVotes);$('electorate').textContent=fi.format(m.electorate);$('remainingElectors').textContent=fi.format(m.remaining);
  $('generationId').textContent=String(data?.idg||'—');
  const when=[data?.dg,data?.hg].filter(Boolean).join(' às ');$('lastUpdate').textContent=`Última carga: ${when||'—'}`;
}
function toggleCompare(c){
  const id=String(c.sqcand),i=comparedIds.indexOf(id);
  if(i>=0)comparedIds.splice(i,1);
  else if(comparedIds.length<4)comparedIds.push(id);
  else{notice('waiting','A comparação aceita até 4 candidaturas no mesmo cargo e localidade.');return}
  saveCompared();renderCandidates();renderComparison();
}
function renderComparison(){
  const list=comparedCandidates(),panel=$('comparisonPanel'),host=$('comparisonCards');
  $('compareBadge').textContent=String(list.length);
  panel.hidden=list.length===0;if(!list.length)return;
  host.innerHTML='';
  list.forEach((c,i)=>{
    const m=metrics(data,c),h=historyFor(c),a=h.at(-2),b=h.at(-1),d=a&&b?b.cv-a.cv:null;
    const card=document.createElement('article');card.className='compare-card';card.style.setProperty('--c',PALETTE[i]);
    const head=document.createElement('div');head.className='compare-card-head';head.appendChild(photoElement(c,true));
    const text=document.createElement('div');text.innerHTML=`<strong>${esc(c.nmu||c.nm||'Candidatura')}</strong><small>${esc(c.party||'')} ${c.n?`• nº ${esc(c.n)}`:''}</small>`;head.appendChild(text);
    card.appendChild(head);
    card.insertAdjacentHTML('beforeend',`<div class="compare-share">${fp.format(m.candidateShare)}%</div><div class="compare-votes">${fi.format(m.candidateVotes)} votos</div><footer><span>última carga: ${d===null?'—':signed(d)} votos</span><span>${fp.format(m.sections)}% apurado</span></footer>`);
    host.appendChild(card);
  });
  renderComparisonChart(list);
}
function renderComparisonChart(list){
  const wrap=$('comparisonChartWrap'),svg=$('comparisonChart'),legend=$('comparisonLegend');
  if(list.length<2){wrap.hidden=true;return}wrap.hidden=false;
  const series=list.map((c,i)=>({c,color:PALETTE[i],h:historyFor(c).slice(-90)})).filter(s=>s.h.length);
  legend.innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.c.nmu||s.c.nm||'')}</span>`).join('');
  const ptsAll=series.flatMap(s=>s.h);if(ptsAll.length<2){svg.innerHTML='<text class="chart-empty" x="500" y="150" text-anchor="middle">A comparação histórica aparece após duas cargas distintas.</text>';return}
  renderMultiChart(svg,series,300);
}
function renderHistory(){
  const svg=$('historyChart'),h=historyFor(selected).slice(-90);
  $('historyTitle').textContent=selected?(selected.nmu||selected.nm||'Candidatura'):'Candidatura selecionada';
  $('historyPoints').textContent=`${h.length} carga${h.length===1?'':'s'}`;
  if(h.length<2){svg.innerHTML='<text class="chart-empty" x="500" y="140" text-anchor="middle">O gráfico aparece após duas cargas oficiais distintas.</text>';return}
  renderMultiChart(svg,[{c:selected,color:'#128c7e',h}],280);
}
function renderMultiChart(svg,series,H){
  const all=series.flatMap(s=>s.h),W=1000,L=58,R=22,T=20,B=40,xmin=Math.min(...all.map(x=>x.sections)),xmax=Math.max(...all.map(x=>x.sections)),rmin=Math.min(...all.map(x=>x.share)),rmax=Math.max(...all.map(x=>x.share)),pad=Math.max(.08,(rmax-rmin)*.25),ymin=Math.max(0,rmin-pad),ymax=Math.min(100,rmax+pad),xs=Math.max(.01,xmax-xmin),ys=Math.max(.01,ymax-ymin),sx=x=>L+(x-xmin)/xs*(W-L-R),sy=y=>T+(ymax-y)/ys*(H-T-B);
  let out='';
  for(const k of [0,.25,.5,.75,1]){const y=ymin+k*(ymax-ymin),py=sy(y);out+=`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${py}" y2="${py}"/><text class="chart-axis" x="${L-10}" y="${py+4}" text-anchor="end">${fp.format(y)}%</text>`}
  for(const k of [0,.25,.5,.75,1]){const x=xmin+k*(xmax-xmin),px=sx(x);out+=`<text class="chart-axis" x="${px}" y="${H-12}" text-anchor="middle">${fp.format(x)}%</text>`}
  for(const s of series){if(s.h.length<2)continue;const points=s.h.map(x=>[sx(x.sections),sy(x.share),x]),path=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;const last=points.at(-1);out+=`<circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`}
  svg.innerHTML=out;
}
function renderOtherRaces(items){
  const host=$('otherRaces');host.innerHTML='';
  for(const item of items){
    const row=document.createElement('div');row.className='other-race';
    row.innerHTML=`<div><strong>${esc(item.label)}</strong><span>${esc(item.location)}</span></div><b>${item.progress===null?'—':fp.format(item.progress)+'%'}</b>`;
    row.addEventListener('click',()=>navigateRace(item.key,item.scope));host.appendChild(row);
  }
}
