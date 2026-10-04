function renderHistory(){
  const svg=$('historyChart'),h=candidateHistory(),recent=h.slice(-90);$('historyPoints').textContent=`${recent.length} ${recent.length===1?'carga':'cargas'}`;
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  if(recent.length<2){svg.innerHTML='<text class="chart-empty" x="500" y="130" text-anchor="middle">O gráfico aparecerá após duas cargas oficiais distintas.</text>';return}
  const W=1000,H=260,L=58,R=22,T=18,B=38;
  let xmin=Math.min(...recent.map(x=>x.sections)),xmax=Math.max(...recent.map(x=>x.sections)),ymin=Math.min(...recent.map(x=>x.share)),ymax=Math.max(...recent.map(x=>x.share));
  if(xmax-xmin<.05){xmin=Math.max(0,xmin-.05);xmax=Math.min(100,xmax+.05)}
  const pad=Math.max(.08,(ymax-ymin)*.3);ymin=Math.max(0,ymin-pad);ymax=Math.min(100,ymax+pad);if(ymax-ymin<.1){ymin=Math.max(0,ymin-.05);ymax=Math.min(100,ymax+.05)}
  const sx=x=>L+(x-xmin)/(xmax-xmin)*(W-L-R),sy=y=>T+(ymax-y)/(ymax-ymin)*(H-T-B);
  const pts=recent.map(x=>[sx(x.sections),sy(x.share),x]);const path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area=`${path} L${pts[pts.length-1][0].toFixed(2)},${H-B} L${pts[0][0].toFixed(2)},${H-B} Z`;
  const xTicks=[0,.25,.5,.75,1].map(k=>xmin+k*(xmax-xmin)),yTicks=[0,.25,.5,.75,1].map(k=>ymin+k*(ymax-ymin));
  let out='<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#46d7c5" stop-opacity=".22"/><stop offset="100%" stop-color="#46d7c5" stop-opacity="0"/></linearGradient></defs>';
  for(const y of yTicks){const py=sy(y);out+=`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${py}" y2="${py}"/><text class="chart-axis" x="${L-10}" y="${py+4}" text-anchor="end">${fp.format(y)}%</text>`}
  for(const x of xTicks){const px=sx(x);out+=`<text class="chart-axis" x="${px}" y="${H-12}" text-anchor="middle">${fp.format(x)}%</text>`}
  out+=`<path class="chart-area" d="${area}"/><path class="chart-path" d="${path}"/>`;
  const every=Math.max(1,Math.ceil(pts.length/24));pts.forEach((p,i)=>{if(i%every===0||i===pts.length-1)out+=`<circle class="chart-dot" cx="${p[0]}" cy="${p[1]}" r="4"><title>${esc(p[2].t||'Carga TSE')} • ${fp.format(p[2].sections)}% seções • ${fp.format(p[2].share)}% válidos</title></circle>`});svg.innerHTML=out;
}

function renderDelta(){
  const h=candidateHistory(),a=h.at(-2),b=h.at(-1);
  if(!a||!b){for(const id of ['deltaValid','deltaCandidate','deltaShare','deltaSections'])$(id).textContent='—';$('lastLoadTime').textContent='aguardando 2ª carga';return}
  $('deltaValid').textContent=`${sign(b.vv-a.vv)}${fi.format(b.vv-a.vv)}`;
  $('deltaCandidate').textContent=`${sign(b.cv-a.cv)}${fi.format(b.cv-a.cv)}`;
  $('deltaShare').textContent=`${sign(b.share-a.share)}${fpp.format(b.share-a.share)} p.p.`;
  $('deltaSections').textContent=`${sign(b.sections-a.sections)}${fpp.format(b.sections-a.sections)} p.p.`;
  $('lastLoadTime').textContent=b.t||new Date(b.ts).toLocaleTimeString('pt-BR');
}

function criticalFor(rate,m){
  const newValid=Math.round(m.rem*rate),target=Math.floor((m.vv+newValid)/2)+1,need=Math.max(0,target-m.cv);
  return{newValid,need,share:newValid?100*need/newValid:(m.cv>m.vv/2?0:Infinity)};
}
function renderSensitivity(){
  if(!data||!sel)return;const m=metrics(data,sel),rate=num($('validRate').value)/100,c=criticalFor(rate,m);
  $('validRateValue').textContent=`${fp.format(rate*100)}%`;
  $('criticalShare').textContent=Number.isFinite(c.share)?`${fp.format(c.share)}%`:'Sem novos válidos';
  $('criticalVotes').textContent=c.newValid?`${fi.format(c.need)} de ${fi.format(c.newValid)} novos votos válidos`:m.cv>m.vv/2?'A maioria já existe sobre os válidos apurados.':'Não há novos votos válidos neste cenário.';
  const body=$('thresholdMatrix');body.innerHTML='';
  for(const r of [.50,.60,.70,.80,.90,1]){const x=criticalFor(r,m),tr=document.createElement('tr');const possible=x.need<=x.newValid;tr.innerHTML=`<td><strong>${fp.format(r*100)}%</strong></td><td>${fi.format(x.newValid)}</td><td>${fi.format(x.need)}</td><td><strong>${x.newValid?(possible?`${fp.format(x.share)}%`:'Acima de 100%'):(m.cv>m.vv/2?'0,00%':'—')}</strong></td>`;body.appendChild(tr)}
}

function renderScenario(){
  if(!data||!sel)return;const m=metrics(data,sel),vr=num($('simValidRate').value)/100,cr=num($('candidateRate').value)/100,nv=Math.round(m.rem*vr),nc=Math.round(nv*cr),fv=m.vv+nv,fc=m.cv+nc,s=fv?100*fc/fv:0;
  $('simValidRateValue').textContent=`${fp.format(100*vr)}%`;$('candidateRateValue').textContent=`${fp.format(100*cr)}%`;$('scenarioShare').textContent=fv?`${fp.format(s)}%`:'—';$('scenarioNewValid').textContent=fi.format(nv);$('scenarioCandidateVotes').textContent=fi.format(nc);
  const v=$('scenarioVerdict');v.className='verdict';if(!fv)v.textContent='Sem votos válidos no cenário';else if(fc>fv/2){v.classList.add('above');v.textContent='Neste cenário: acima de 50%'}else{v.classList.add('below');v.textContent='Neste cenário: 50% ou menos'}
}

function render(stale=false,newLoad=false){
  if(!data||!sel)return;const m=metrics(data,sel),sp=pct(data?.s?.pstn??data?.s?.pst),ts=num(data?.s?.ts),st=num(data?.s?.st),tv=num(data?.v?.tv),ok=validDest(sel);
  $('candidateName').textContent=sel.nmu||sel.nm||'Candidatura';$('candidateParty').textContent=[sel.party,sel.group].filter(Boolean).join(' • ')||'—';$('candidateShare').textContent=m.vv?`${fp.format(m.share)}%`:'—';$('shareRing').style.setProperty('--share',`${clamp(m.share*3.6,0,360)}deg`);$('thresholdFill').style.width=`${clamp(m.share,0,100)}%`;
  $('sectionsPct').textContent=`${fp.format(sp)}%`;$('sectionsCount').textContent=ts?`${fi.format(st)} de ${fi.format(ts)} seções`:'—';$('validVotes').textContent=fi.format(m.vv);$('totalVotes').textContent=tv?`${fi.format(tv)} votos computados no total`:'—';$('candidateVotes').textContent=fi.format(m.cv);$('candidateBallot').textContent=sel.n?`número ${sel.n}`:'—';
  if(!m.vv||!ok){$('halfDelta').textContent='—';$('halfDeltaLabel').textContent=ok?'Aguardando votos válidos':'Votos não classificados como válidos'}else if(m.delta>=0){$('halfDelta').textContent=`+${fi.format(m.delta)}`;$('halfDeltaLabel').textContent='votos acima da maioria dos válidos já apurados'}else{$('halfDelta').textContent=fi.format(-m.delta);$('halfDeltaLabel').textContent='votos abaixo da maioria dos válidos já apurados'}
  $('remainingElectors').textContent=fi.format(m.rem);$('minFinalShare').textContent=m.finalMaxValid?`${fp.format(m.minShare)}%`:'—';$('maxFinalShare').textContent=m.finalMaxValid?`${fp.format(m.maxShare)}%`:'—';$('envelopeBand').style.left=`${clamp(m.minShare,0,100)}%`;$('envelopeBand').style.width=`${clamp(m.maxShare-m.minShare,0,100)}%`;
  $('worstCaseShareMetric').textContent=m.rem?(m.worstNeed<=m.rem?`${fp.format(100*m.worstNeed/m.rem)}%`:'> 100%'):(m.cv>m.vv/2?'0,00%':'—');$('worstCaseVotes').textContent=m.rem?`${fi.format(m.worstNeed)} votos no cenário de teto máximo`:'Não há eleitorado restante em seções não totalizadas.';
  $('bufferVotes').textContent=m.buffer?fi.format(m.buffer):'0';$('bufferLabel').textContent=m.buffer?'novos votos válidos todos para outras candidaturas poderiam entrar antes de perder a maioria atual.':'Não há colchão matemático sobre 50% dos válidos apurados.';
  const b=$('mathState');b.className='state-badge';if(!m.vv){b.textContent='Aguardando';$('mathSummary').textContent='Ainda não há votos válidos suficientes para calcular o envelope matemático.'}else if(m.guaranteed){b.classList.add('guaranteed');b.textContent='Maioria matematicamente garantida';$('mathSummary').textContent='A maioria absoluta permaneceria acima de 50% até no cenário extremo mais desfavorável permitido pelo teto de eleitores ainda não totalizados.'}else if(m.impossible){b.classList.add('impossible');b.textContent='Maioria matematicamente inalcançável';$('mathSummary').textContent='Mesmo receber todo o teto de votos restantes não permitiria ultrapassar 50% dos votos válidos no cenário extremo.'}else{b.classList.add('open');b.textContent='Matematicamente em aberto';$('mathSummary').textContent='O envelope extremo ainda atravessa a referência de 50%. Há combinações matematicamente possíveis dos votos restantes dos dois lados desse limiar.'}
  const when=[data.dg,data.hg].filter(Boolean).join(' às ');$('lastUpdate').textContent=`Última carga TSE: ${when||new Date().toLocaleTimeString('pt-BR')}${stale?' • cache local':''}`;
  renderSensitivity();renderScenario();renderHistory();renderDelta();
  if(newLoad){document.querySelector('.share-card')?.classList.remove('flash');requestAnimationFrame(()=>document.querySelector('.share-card')?.classList.add('flash'))}
}

