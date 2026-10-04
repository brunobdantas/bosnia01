'use strict';

let comparedIds=[];
let compareContext='';

const comparePalette=['#46d7c5','#70a8ff','#f2bf5e','#c69cff'];

function compareStorageKey(){return `tse26-compare-v1-${officeKey}-${scope}`}
function ensureCompareContext(){
  const key=compareStorageKey();
  if(compareContext===key)return;
  compareContext=key;
  try{comparedIds=JSON.parse(localStorage.getItem(key)||'[]').map(String).slice(0,4)}catch{comparedIds=[]}
}
function saveCompared(){try{localStorage.setItem(compareStorageKey(),JSON.stringify(comparedIds))}catch{}}
function comparedCandidates(){
  ensureCompareContext();
  return comparedIds.map(id=>candidates.find(c=>String(c.sqcand)===String(id))).filter(Boolean);
}
function toggleCompareCandidate(c){
  ensureCompareContext();
  const id=String(c.sqcand),i=comparedIds.indexOf(id);
  if(i>=0)comparedIds.splice(i,1);
  else if(comparedIds.length<4)comparedIds.push(id);
  else{
    const note=$('compareNotice');
    if(note){note.textContent='Você pode comparar até 4 candidaturas simultaneamente.';note.classList.add('visible');setTimeout(()=>note.classList.remove('visible'),2200)}
    return;
  }
  saveCompared();
  renderCandidateList();
  renderCompare();
}
function compareHistoryFor(c){
  const id=String(c.sqcand),n=String(c.n||'');
  return history().map(x=>{
    const v=x.c?.[id]||Object.values(x.c||{}).find(z=>String(z.number)===n);
    return v?{...x,cv:v.votes,share:v.share}:null;
  }).filter(Boolean);
}
function createComparePanel(){
  if($('comparePanel'))return;
  const target=document.querySelector('.detail-grid');
  if(!target)return;
  const section=document.createElement('section');
  section.id='comparePanel';
  section.className='card compare-panel';
  section.innerHTML=`
    <div class="panel-heading compare-heading">
      <div>
        <p class="eyebrow">ANÁLISE SIMULTÂNEA</p>
        <h2>Candidaturas lado a lado</h2>
      </div>
      <div class="compare-head-actions">
        <span class="neutral-tag" id="compareCount">0 selecionadas</span>
        <button class="compare-clear" id="compareClear" type="button">Limpar</button>
      </div>
    </div>
    <p class="subtle">Fixe de 2 a 4 candidaturas no mesmo cargo e abrangência. Os cards permanecem na ordem em que você as selecionou e usam as mesmas cargas oficiais.</p>
    <div class="compare-empty" id="compareEmpty">
      <div class="compare-empty-icon">＋</div>
      <strong>Fixe candidaturas para comparar</strong>
      <span>Use o botão “+ comparar” na lista de candidaturas.</span>
    </div>
    <div class="compare-cards" id="compareCards"></div>
    <div class="compare-chart-shell" id="compareChartShell" hidden>
      <div class="compare-chart-head">
        <div><strong>Evolução simultânea</strong><span>Participação informada/calculada × avanço das seções</span></div>
        <div class="compare-legend" id="compareLegend"></div>
      </div>
      <div class="chart-wrap compare-chart-wrap"><svg id="compareChart" viewBox="0 0 1000 300" role="img" aria-label="Evolução simultânea das candidaturas fixadas"></svg></div>
    </div>
    <div class="compare-notice" id="compareNotice" role="status"></div>
  `;
  target.insertAdjacentElement('afterend',section);
  $('compareClear').addEventListener('click',()=>{comparedIds=[];saveCompared();renderCandidateList();renderCompare()});
}

function installCompareToggles(){
  ensureCompareContext();
  document.querySelectorAll('.candidate-row').forEach(row=>{
    if(row.querySelector('.compare-toggle'))return;
    const id=String(row.dataset.sqcand||'');
    const c=candidates.find(x=>String(x.sqcand)===id);
    if(!c)return;
    const on=comparedIds.includes(id);
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className=`compare-toggle${on?' active':''}`;
    toggle.setAttribute('aria-pressed',String(on));
    toggle.setAttribute('aria-label',on?`Retirar ${c.nmu||c.nm||'candidatura'} da comparação`:`Adicionar ${c.nmu||c.nm||'candidatura'} à comparação`);
    toggle.title=on?'Retirar da comparação':'Adicionar à comparação';
    toggle.innerHTML=`<b>${on?'✓':'＋'}</b><small>${on?'fixada':'comparar'}</small>`;
    toggle.addEventListener('click',()=>toggleCompareCandidate(c));
    row.appendChild(toggle);
  });
}

function candidateDelta(c){
  const h=compareHistoryFor(c),a=h.at(-2),b=h.at(-1);
  return a&&b?{votes:b.cv-a.cv,share:b.share-a.share,sections:b.sections-a.sections}:null;
}
function renderCompareCards(list){
  const host=$('compareCards');host.innerHTML='';
  list.forEach((c,i)=>{
    const m=metrics(data,c),d=candidateDelta(c),article=document.createElement('article');
    article.className='compare-card';
    article.style.setProperty('--compare-color',comparePalette[i]);
    article.innerHTML=`
      <div class="compare-card-head">
        <span class="compare-index" aria-hidden="true"></span>
        <button class="compare-remove" type="button" title="Retirar da comparação" aria-label="Retirar ${esc(c.nmu||c.nm||'candidatura')} da comparação">×</button>
      </div>
      <div class="compare-candidate">
        <span class="compare-number">${esc(c.n||'—')}</span>
        <div><strong>${esc(c.nmu||c.nm||'Candidatura')}</strong><small>${esc(c.party||c.partyName||'')}</small></div>
      </div>
      <div class="compare-share"><strong>${m.vv?fp.format(m.share)+'%':'—'}</strong><span>participação nos válidos</span></div>
      <div class="compare-bar"><span style="width:${clamp(m.share,0,100)}%"></span></div>
      <div class="compare-stats">
        <div><span>Votos</span><strong>${fi.format(m.cv)}</strong></div>
        <div><span>Última carga</span><strong>${d?signed(d.votes):'—'}</strong><small>${d?signed(d.share,fpp)+' p.p.':'aguardando 2ª carga'}</small></div>
        <div><span>Seções</span><strong>${fp.format(m.sections)}%</strong></div>
      </div>
    `;
    article.querySelector('.compare-remove').addEventListener('click',()=>toggleCompareCandidate(c));
    host.appendChild(article);
  });
}
function renderCompareChart(list){
  const shell=$('compareChartShell'),svg=$('compareChart'),legend=$('compareLegend');
  if(list.length<2){shell.hidden=true;svg.innerHTML='';legend.innerHTML='';return}
  shell.hidden=false;
  const series=list.map((c,i)=>({c,color:comparePalette[i],h:compareHistoryFor(c).slice(-90)})).filter(s=>s.h.length);
  legend.innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.c.nmu||s.c.nm||'Candidatura')}</span>`).join('');
  if(series.every(s=>s.h.length<2)){svg.innerHTML='<text class="chart-empty" x="500" y="150" text-anchor="middle">O gráfico simultâneo aparece após duas cargas oficiais distintas.</text>';return}

  const points=series.flatMap(s=>s.h),W=1000,H=300,L=60,R=24,T=24,B=44;
  const xmin=Math.min(...points.map(x=>x.sections)),xmax=Math.max(...points.map(x=>x.sections)),rawMin=Math.min(...points.map(x=>x.share)),rawMax=Math.max(...points.map(x=>x.share));
  const pad=Math.max(.08,(rawMax-rawMin)*.25),ymin=Math.max(0,rawMin-pad),ymax=Math.min(100,rawMax+pad),xs=Math.max(.01,xmax-xmin),ys=Math.max(.01,ymax-ymin);
  const sx=x=>L+(x-xmin)/xs*(W-L-R),sy=y=>T+(ymax-y)/ys*(H-T-B);
  let out='';
  for(const k of [0,.25,.5,.75,1]){const y=ymin+k*(ymax-ymin),py=sy(y);out+=`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${py}" y2="${py}"/><text class="chart-axis" x="${L-10}" y="${py+4}" text-anchor="end">${fp.format(y)}%</text>`}
  for(const k of [0,.25,.5,.75,1]){const x=xmin+k*(xmax-xmin),px=sx(x);out+=`<text class="chart-axis" x="${px}" y="${H-13}" text-anchor="middle">${fp.format(x)}%</text>`}
  for(const s of series){
    if(s.h.length<2)continue;
    const pts=s.h.map(x=>[sx(x.sections),sy(x.share),x]),path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
    const last=pts.at(-1);
    out+=`<circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${s.color}" stroke="#0d1a28" stroke-width="2"><title>${esc(s.c.nmu||s.c.nm)} • ${fp.format(last[2].share)}%</title></circle>`;
  }
  svg.innerHTML=out;
}
function renderCompare(){
  createComparePanel();ensureCompareContext();
  const list=comparedCandidates();
  $('compareCount').textContent=`${list.length} selecionada${list.length===1?'':'s'}`;
  $('compareClear').disabled=!list.length;
  $('compareEmpty').hidden=list.length>0;
  $('compareCards').hidden=list.length===0;
  renderCompareCards(list);
  renderCompareChart(list);
}

createComparePanel();

const baseRenderCandidateList=renderCandidateList;
renderCandidateList=function(){
  baseRenderCandidateList();
  installCompareToggles();
};

const baseRenderAll=renderAll;
renderAll=function(stale=false){
  baseRenderAll(stale);
  renderCompare();
};

const baseResetContext=resetContext;
resetContext=function(){
  baseResetContext();
  compareContext='';
  ensureCompareContext();
  renderCompare();
};
