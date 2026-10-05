'use strict';
(A=>{
const {E,F,P,esc}=A;
A.cards=(a,j,k,partial)=>`<div class="ask-candidate-grid">${[...a].sort((x,y)=>Number(x.n)-Number(y.n)).map(c=>`<article class="ask-candidate-card"><b>${esc(c.n||'—')}</b><div><strong>${esc(c.nmu||c.nm)}</strong><span>${esc(c.party)} • ${F.format(Number(c.vap)||0)} votos</span><em class="${partial?'partial':'official'}">${partial?'Eleito se terminasse agora':'Eleito • TSE'}</em></div></article>`).join('')}</div>`;
A.comp=(j,k,uf)=>{const e=A.elected(j,k);if(!e.items.length)return`<p>Ainda não há composição disponível para ${esc(A.label(k,uf))}.</p>${A.source(j,k,uf)}`;const m=new Map();for(const c of e.items)m.set(c.party,(m.get(c.party)||0)+1);const rows=[...m].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));return`<p>${e.partial?'Fotografia das vagas na carga atual':'Composição oficial'} de <strong>${esc(A.label(k,uf))}</strong> em <strong>${esc(uf)}</strong>:</p><div class="ask-seat-bar">${rows.map(([p,n])=>`<i style="width:${100*n/e.items.length}%;--p:${A.partyColor(p)}"></i>`).join('')}</div><div class="ask-party-list">${rows.map(([p,n])=>`<div><span><i style="--p:${A.partyColor(p)}"></i>${esc(p)}</span><b>${n}</b></div>`).join('')}</div><small class="ask-note">${e.partial?'“Eleito se terminasse agora”: pode mudar com novas urnas.':'Situação oficial do TSE.'}</small>${A.source(j,k,uf)}`};
A.electedAnswer=async(p,r)=>{if(!p.k)return A.reply(r,'<p>Qual cargo você quer consultar?</p>',['Quem foi eleito deputado federal em MG?','Quem foi eleito deputado estadual em MG?','Quem foi eleito senador no DF?']);const uf=p.us[0]||(p.k==='president'?'BR':A.state.lastUF);if(uf!=='BR'){A.state.lastUF=uf;localStorage.setItem(A.UK,uf)}const j=await A.get(p.k,uf),e=A.elected(j,p.k);if(!e.items.length)return A.reply(r,`<p>O TSE ainda não publicou eleitos para <strong>${esc(A.label(p.k,uf))}</strong> em <strong>${esc(uf)}</strong> nesta carga.</p>${A.source(j,p.k,uf)}`);A.reply(r,`<p>${e.partial?'A situação final ainda não foi publicada. Esta é a fotografia das vagas da carga atual:':'A carga oficial já traz as candidaturas eleitas:'}</p><h3>${esc(A.label(p.k,uf))} • ${esc(uf==='BR'?'Brasil':uf+' • '+UF[uf])}</h3>${A.cards(e.items,j,p.k,e.partial)}${A.source(j,p.k,uf)}`,[`Como ficaram as cadeiras em ${uf}?`,`Qual a participação eleitoral em ${uf}?`])};
A.seatsAnswer=async(p,r)=>{const uf=p.us[0]||A.state.lastUF;A.state.lastUF=uf;localStorage.setItem(A.UK,uf);if(p.k&&OFFICES[p.k].proportional){const j=await A.get(p.k,uf);return A.reply(r,A.comp(j,p.k,uf),[`Quem foi eleito ${A.label(p.k,uf).toLowerCase()} em ${uf}?`])}const[a,b]=await Promise.all([A.get('federalDeputy',uf),A.get('stateDeputy',uf)]);A.reply(r,`<p>Como você não especificou a casa, mostro Câmara e ${uf==='DF'?'CLDF':'Assembleia'}.</p><section class="ask-block">${A.comp(a,'federalDeputy',uf)}</section><section class="ask-block">${A.comp(b,'stateDeputy',uf)}</section>`)};
A.votesAnswer=async(p,r)=>{const uf=p.us[0]||A.state.lastUF,k=p.k||'governor';A.state.lastUF=uf;localStorage.setItem(A.UK,uf);const j=await A.get(k,uf),m=A.met(j);A.reply(r,`<p>Na carga atual de <strong>${esc(A.label(k,uf))}</strong> em <strong>${esc(uf)} • ${esc(UF[uf]||'Brasil')}</strong>:</p><div class="ask-metrics"><div><span>Válidos</span><b>${F.format(m.validVotes)}</b></div><div><span>Brancos</span><b>${F.format(m.blankVotes)}</b></div><div><span>Nulos</span><b>${F.format(m.nullVotes)}</b></div><div><span>Comparecimento computado</span><b>${P.format(m.turnout)}%</b></div><div><span>Seções</span><b>${P.format(m.sections)}%</b></div></div>${A.source(j,k,uf)}`,[`Quem foi eleito em ${uf}?`,`Como ficaram as cadeiras em ${uf}?`])};
A.progressAnswer=async(p,r)=>{const uf=p.us[0]||A.state.lastUF,k=p.k||'governor';const j=await A.get(k,uf),m=A.met(j),left=Math.max(0,m.totalSections-m.doneSections);A.reply(r,`<p><strong>${esc(A.label(k,uf))} • ${esc(uf)}</strong> está em <strong>${P.format(m.sections)}%</strong> das seções. ${m.totalSections?`São ${F.format(m.doneSections)} de ${F.format(m.totalSections)}; restam ${F.format(left)}.`:''}</p>${A.source(j,k,uf)}`)};
A.summaryAnswer=async(p,r)=>{const uf=p.us[0]||A.state.lastUF;A.state.lastUF=uf;localStorage.setItem(A.UK,uf);const ks=['president','governor','senator','federalDeputy','stateDeputy'],js=await Promise.all(ks.map(k=>A.get(k,uf)));A.reply(r,`<p><strong>${esc(uf)} • ${esc(UF[uf])}</strong> em uma tela:</p><div class="ask-summary-list">${ks.map((k,i)=>{const m=A.met(js[i]),e=A.elected(js[i],k);return`<button data-open="${k}" data-uf="${uf}"><span><strong>${esc(A.label(k,uf))}</strong><small>${e.items.length?(e.partial?e.items.length+' cadeiras na parcial':e.items.length+' eleitos'):'aguardando definição'}</small></span><b>${P.format(m.sections)}%</b></button>`}).join('')}</div>`,[`Como ficaram as cadeiras em ${uf}?`,`Quem foi eleito deputado estadual em ${uf}?`])};
A.compareAnswer=async(p,r)=>{if(p.us.length<2)return A.fail(r);const k=p.k||'governor',rows=await Promise.all(p.us.slice(0,4).map(async uf=>({uf,m:A.met(await A.get(k,uf))})));A.reply(r,`<p>Comparação da carga atual de <strong>${esc(A.label(k,rows[0].uf))}</strong>:</p><div class="ask-table-wrap"><table><thead><tr><th>UF</th><th>Seções</th><th>Válidos</th><th>Brancos</th><th>Nulos</th></tr></thead><tbody>${rows.map(x=>`<tr><th>${x.uf}</th><td>${P.format(x.m.sections)}%</td><td>${F.format(x.m.validVotes)}</td><td>${F.format(x.m.blankVotes)}</td><td>${F.format(x.m.nullVotes)}</td></tr>`).join('')}</tbody></table></div><small class="ask-note">UFs mantidas na ordem da pergunta; sem ranking.</small>`)};
A.unfinishedAnswer=async(p,r)=>{const k=p.k||'governor',out=[];let i=0;await Promise.all(Array.from({length:5},async()=>{while(i<CFG.ufs.length){const uf=CFG.ufs[i++];try{const j=await A.get(k,uf),m=A.met(j);if(m.sections<100||String(j.tf||'').toLowerCase()!=='s')out.push({uf,m})}catch{}}}));out.sort((a,b)=>a.uf.localeCompare(b.uf));A.reply(r,out.length?`<p><strong>${out.length}</strong> UFs ainda aparecem com totalização aberta na carga consultada.</p><div class="ask-progress-list">${out.map(x=>`<div><span>${x.uf} • ${esc(UF[x.uf])}</span><b>${P.format(x.m.sections)}%</b></div>`).join('')}</div>`:'<p>Não encontrei UFs com totalização aberta na consulta atual.</p>')};
A.candidateVotesAnswer=async(p,r)=>{
  const term=A.candidateTerm(p.q);
  if(!term)return A.fail(r);

  const matches=[];
  const addMatches=(j,k,uf)=>{
    for(const c of A.findCandidate(j,term))matches.push({c,j,k,uf});
  };

  if(p.k){
    const uf=p.k==='president'?'BR':(p.us[0]||A.state.lastUF);
    const j=await A.get(p.k,uf);
    addMatches(j,p.k,uf);
  }else{
    const pj=await A.get('president','BR');
    addMatches(pj,'president','BR');

    if(!matches.length&&p.us[0]){
      const uf=p.us[0];
      for(const k of ['governor','senator','federalDeputy','stateDeputy']){
        const j=await A.get(k,uf);
        addMatches(j,k,uf);
      }
    }
  }

  if(!matches.length){
    const where=p.us[0]?(' em '+p.us[0]):'';
    return A.reply(r,`<p>Não encontrei uma candidatura correspondente a <strong>${esc(term)}</strong>${where} na consulta atual. Se for um cargo estadual, informe também a UF.</p>`,[
      `Quantos votos ${term} teve para presidente?`,
      `Quantos votos ${term} teve em MG?`
    ]);
  }

  const unique=[];
  const seen=new Set();
  for(const m of matches){
    const key=String(m.c.sqcand||'')+'|'+m.k+'|'+m.uf;
    if(!seen.has(key)){seen.add(key);unique.push(m)}
  }

  if(unique.length>1){
    return A.reply(r,`<p>Encontrei mais de uma candidatura para <strong>${esc(term)}</strong>. Escolha uma:</p><div class="ask-summary-list">${unique.slice(0,12).map(m=>`<button data-q="Quantos votos ${esc(m.c.nmu||m.c.nm)} teve para ${esc(A.label(m.k,m.uf).toLowerCase())} em ${m.uf}?"><span><strong>${esc(m.c.nmu||m.c.nm)}</strong><small>${esc(A.label(m.k,m.uf))} • ${esc(m.uf==='BR'?'Brasil':m.uf)}</small></span><b>${esc(m.c.n||'')}</b></button>`).join('')}</div>`);
  }

  const {c,j,k,uf}=unique[0];
  const m=A.met(j);
  const votes=Number(c.vap)||0;
  const share=m.validVotes?100*votes/m.validVotes:0;
  const rawStatus=String(c.st||'').trim();
  const status=rawStatus||(String(c.e||'').toLowerCase()==='s'?'Situação definida pelo TSE':'');
  const place=uf==='BR'?'Brasil':`${uf} • ${UF[uf]||''}`;

  A.reply(r,`<p><strong>${esc(c.nmu||c.nm)}</strong> teve <strong>${F.format(votes)} votos</strong> para <strong>${esc(A.label(k,uf))}</strong> em <strong>${esc(place)}</strong>.</p><div class="ask-metrics"><div><span>Votos nominais</span><b>${F.format(votes)}</b></div><div><span>Participação nos válidos</span><b>${P.format(share)}%</b></div><div><span>Número</span><b>${esc(c.n||'—')}</b></div><div><span>Partido</span><b>${esc(c.party||'—')}</b></div></div>${status?`<p class="ask-candidate-status">${esc(status)}</p>`:''}${A.source(j,k,uf)}`,[
    `Quem foi eleito para ${A.label(k,uf).toLowerCase()} ${uf==='BR'?'no Brasil':'em '+uf}?`,
    `Qual foi a participação eleitoral ${uf==='BR'?'no Brasil':'em '+uf}?`
  ]);
};

A.route=async(q,r)=>{const p={q,n:A.norm(q),us:A.ufs(q),k:A.office(q),i:A.intent(q)};if(p.i==='candidateVotes')return A.candidateVotesAnswer(p,r);if(p.i==='elected')return A.electedAnswer(p,r);if(p.i==='seats')return A.seatsAnswer(p,r);if(p.i==='votes')return A.votesAnswer(p,r);if(p.i==='progress')return A.progressAnswer(p,r);if(p.i==='compare')return A.compareAnswer(p,r);if(p.i==='summary')return A.summaryAnswer(p,r);if(p.i==='unfinished')return A.unfinishedAnswer(p,r);if(p.us.length)return A.summaryAnswer(p,r);return A.fail(r)};
})(window.E360Ask);
