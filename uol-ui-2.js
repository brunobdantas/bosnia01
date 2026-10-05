
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
  const all=series.flatMap(s=>s.h).filter(x=>Number.isFinite(num(x.share,NaN)));
  if(all.length<2){
    svg.innerHTML='<text class="chart-empty" x="500" y="'+Math.round(H/2)+'" text-anchor="middle">São necessárias pelo menos duas cargas distintas.</text>';
    return;
  }

  const W=1000,L=78,R=30,T=24,B=54;
  const totalizedValues=all.map(x=>num(x.totalizedTs,NaN)).filter(Number.isFinite);
  const generatedValues=all.map(x=>num(x.generatedTs,NaN)).filter(Number.isFinite);
  const sourceValues=all.map(x=>num(x.sourceTs,NaN)).filter(Number.isFinite);

  const distinctCount=arr=>new Set(arr.map(v=>String(v))).size;
  let timeKind='totalized';
  let timeAccessor=x=>num(x.totalizedTs,NaN);

  if(totalizedValues.length!==all.length||distinctCount(totalizedValues)<2){
    if(generatedValues.length===all.length&&distinctCount(generatedValues)>=2){
      timeKind='generated';
      timeAccessor=x=>num(x.generatedTs,NaN);
    }else{
      timeKind='source';
      timeAccessor=x=>num(x.sourceTs,NaN);
    }
  }

  const ordered=[...all].sort((a,b)=>{
    const ta=timeAccessor(a),tb=timeAccessor(b);
    if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb)return ta-tb;
    return num(a.ts)-num(b.ts);
  });

  const times=ordered.map(timeAccessor).filter(Number.isFinite);
  let tmin=Math.min(...times),tmax=Math.max(...times),tspan=tmax-tmin;
  const sameTime=!Number.isFinite(tspan)||tspan<1000;

  const snapshots=[...new Map(
    ordered.map(x=>[String(x.key||x.sourceTs||x.ts||x.label),x])
  ).values()];
  const snapIndex=new Map(snapshots.map((x,i)=>[String(x.key||x.sourceTs||x.ts||x.label),i]));
  const snapDen=Math.max(1,snapshots.length-1);

  const rmin=Math.min(...all.map(x=>num(x.share))),rmax=Math.max(...all.map(x=>num(x.share)));
  const ypad=Math.max(.08,(rmax-rmin)*.22);
  let ymin=Math.max(0,rmin-ypad),ymax=Math.min(100,rmax+ypad);
  if(ymax-ymin<.16){
    const mid=(ymax+ymin)/2;
    ymin=Math.max(0,mid-.08);
    ymax=Math.min(100,mid+.08);
  }
  const yspan=Math.max(1e-9,ymax-ymin);

  const normalizedX=(point,fallbackIndex,seriesLength)=>{
    if(sameTime){
      const key=String(point.key||point.sourceTs||point.ts||point.label);
      const idx=snapIndex.has(key)?snapIndex.get(key):fallbackIndex;
      return snapshots.length>1?idx/snapDen:(seriesLength>1?fallbackIndex/(seriesLength-1):0);
    }
    const t=timeAccessor(point);
    return Number.isFinite(t)?(t-tmin)/Math.max(1,tspan):(seriesLength>1?fallbackIndex/(seriesLength-1):0);
  };

  const sxNorm=t=>L+clamp(t,0,1)*(W-L-R);
  const sy=y=>T+(ymax-num(y))/yspan*(H-T-B);
  const yFmt=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const dateParts=(ms,withDate=false)=>{
    const d=new Date(ms);
    const hh=String(d.getUTCHours()).padStart(2,'0');
    const mm=String(d.getUTCMinutes()).padStart(2,'0');
    const ss=String(d.getUTCSeconds()).padStart(2,'0');
    if(!withDate)return `${hh}:${mm}:${ss}`;
    const day=String(d.getUTCDate()).padStart(2,'0');
    const mon=String(d.getUTCMonth()+1).padStart(2,'0');
    return `${day}/${mon} ${hh}:${mm}:${ss}`;
  };

  const crossesDay=!sameTime&&new Date(tmin).getUTCDate()!==new Date(tmax).getUTCDate();
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

  for(const tick of xticks){
    const px=sxNorm(tick.k);
    let label='';
    if(sameTime){
      const idx=Math.round(tick.k*snapDen);
      label=`Carga ${idx+1}`;
    }else{
      label=dateParts(tmin+tick.k*tspan,crossesDay);
    }
    out+=`<text class="chart-axis chart-axis-x" x="${px}" y="${H-18}" text-anchor="${tick.anchor}">${label}</text>`;
  }

  const axisTitle=sameTime
    ? 'cargas oficiais'
    : (timeKind==='totalized'?'horário da totalização (TSE)':timeKind==='generated'?'horário de geração do arquivo (TSE)':'horário da carga');
  out+=`<text class="chart-axis chart-axis-title" x="${(L+W-R)/2}" y="${H-2}" text-anchor="middle">${axisTitle}</text>`;

  for(const s of series){
    if(s.h.length<2)continue;
    const sorted=[...s.h].sort((a,b)=>{
      const ta=timeAccessor(a),tb=timeAccessor(b);
      if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb)return ta-tb;
      return num(a.ts)-num(b.ts);
    });
    const points=sorted.map((point,i)=>[sxNorm(normalizedX(point,i,sorted.length)),sy(point.share),point]);
    const path=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;

    for(const [px,py,point] of points){
      const t=timeAccessor(point);
      const timeLabel=Number.isFinite(t)?dateParts(t,true):(point.label||'carga oficial');
      const sectionsLabel=Number.isFinite(num(point.sections,NaN))?`${new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:5}).format(point.sections)}% das seções`:'seções não informadas';
      out+=`<circle cx="${px}" cy="${py}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2"><title>${esc(timeLabel)} • ${sectionsLabel} • ${yFmt.format(point.share)}%</title></circle>`;
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
