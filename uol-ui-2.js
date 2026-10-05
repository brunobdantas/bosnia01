
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
  const all=series.flatMap(s=>s.h).filter(x=>Number.isFinite(num(x.sections,NaN))&&Number.isFinite(num(x.share,NaN)));
  if(all.length<2){
    svg.innerHTML='<text class="chart-empty" x="500" y="'+Math.round(H/2)+'" text-anchor="middle">São necessárias pelo menos duas cargas distintas.</text>';
    return;
  }

  const W=1000,L=72,R=28,T=24,B=48;
  const xvals=all.map(x=>num(x.sections));
  const xmin=Math.min(...xvals),xmax=Math.max(...xvals),xspan=xmax-xmin;
  const rmin=Math.min(...all.map(x=>num(x.share))),rmax=Math.max(...all.map(x=>num(x.share)));
  const ypad=Math.max(.08,(rmax-rmin)*.22);
  let ymin=Math.max(0,rmin-ypad),ymax=Math.min(100,rmax+ypad);
  if(ymax-ymin<.16){
    const mid=(ymax+ymin)/2;
    ymin=Math.max(0,mid-.08);
    ymax=Math.min(100,mid+.08);
  }
  const yspan=Math.max(1e-9,ymax-ymin);

  const sameProgress=xspan<1e-7;
  const snapshots=[...new Map(
    [...all]
      .sort((a,b)=>num(a.ts)-num(b.ts))
      .map(x=>[String(x.key||x.ts||x.label),x])
  ).values()];
  const snapIndex=new Map(snapshots.map((x,i)=>[String(x.key||x.ts||x.label),i]));
  const snapDen=Math.max(1,snapshots.length-1);

  const normalizedX=(point,fallbackIndex,seriesLength)=>{
    if(sameProgress){
      const key=String(point.key||point.ts||point.label);
      const idx=snapIndex.has(key)?snapIndex.get(key):fallbackIndex;
      return snapshots.length>1?idx/snapDen:(seriesLength>1?fallbackIndex/(seriesLength-1):0);
    }
    return (num(point.sections)-xmin)/Math.max(1e-12,xspan);
  };
  const sxNorm=t=>L+clamp(t,0,1)*(W-L-R);
  const sy=y=>T+(ymax-num(y))/yspan*(H-T-B);

  const progressDecimals=xspan>=1?2:xspan>=.1?2:xspan>=.01?3:xspan>=.001?4:5;
  const progressFmt=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:progressDecimals,maximumFractionDigits:progressDecimals});
  const yFmt=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  let out='';

  for(const k of [0,.25,.5,.75,1]){
    const y=ymin+k*(ymax-ymin),py=sy(y);
    out+=`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${py}" y2="${py}"/>`;
    out+=`<text class="chart-axis" x="${L-12}" y="${py+4}" text-anchor="end">${yFmt.format(y)}%</text>`;
  }

  const xticks=[
    {k:0,anchor:'start'},
    {k:.5,anchor:'middle'},
    {k:1,anchor:'end'}
  ];
  for(const t of xticks){
    const px=sxNorm(t.k);
    let label='';
    if(sameProgress){
      const idx=Math.round(t.k*snapDen);
      label=`Carga ${idx+1}`;
    }else{
      label=`${progressFmt.format(xmin+t.k*xspan)}%`;
    }
    out+=`<text class="chart-axis chart-axis-x" x="${px}" y="${H-15}" text-anchor="${t.anchor}">${label}</text>`;
  }

  out+=`<text class="chart-axis chart-axis-title" x="${(L+W-R)/2}" y="${H-1}" text-anchor="middle">${sameProgress?'cargas oficiais':'seções totalizadas'}</text>`;

  for(const s of series){
    if(s.h.length<2)continue;
    const points=s.h.map((point,i)=>[sxNorm(normalizedX(point,i,s.h.length)),sy(point.share),point]);
    const path=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;

    for(const [px,py,point] of points){
      const xLabel=sameProgress?'mesmo avanço de seções':`${progressFmt.format(point.sections)}% das seções`;
      const loadLabel=point.label?esc(point.label):'carga oficial';
      out+=`<circle cx="${px}" cy="${py}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2"><title>${loadLabel} • ${xLabel} • ${yFmt.format(point.share)}%</title></circle>`;
    }
  }

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
