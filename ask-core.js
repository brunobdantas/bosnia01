'use strict';
window.E360Ask=window.E360Ask||{};
(A=>{
A.E=id=>document.getElementById(id);A.F=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});A.P=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});A.C=new Map();A.RK='e360-chat-recent';A.UK='e360-chat-uf';A.state={busy:false,lastUF:localStorage.getItem(A.UK)||'DF'};
A.alias={AC:'acre',AL:'alagoas',AP:'amapa',AM:'amazonas',BA:'bahia',CE:'ceara',DF:'distrito federal brasilia',ES:'espirito santo',GO:'goias',MA:'maranhao',MT:'mato grosso',MS:'mato grosso do sul',MG:'minas gerais minas',PA:'para',PB:'paraiba',PR:'parana',PE:'pernambuco',PI:'piaui',RJ:'rio de janeiro',RN:'rio grande do norte',RS:'rio grande do sul',RO:'rondonia',RR:'roraima',SC:'santa catarina',SP:'sao paulo',SE:'sergipe',TO:'tocantins'};
A.officeAliases=[['stateDeputy',['deputado distrital','distrital','cldf','deputado estadual','assembleia']],['federalDeputy',['deputado federal','camara']],['governor',['governador','governadora']],['senator',['senador','senado']],['president',['presidente','presidencia']]];
A.esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
A.norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
A.setExplorer=v=>{document.body.classList.toggle('explorer-open',!!v);requestAnimationFrame(()=>document.querySelector(v?'.race-nav-wrap':'#experienceApp')?.scrollIntoView({behavior:'smooth',block:'start'}))};
A.ufs=q=>{const raw=String(q).toLowerCase(),n=A.norm(q),r=[];if(n.includes('meu estado'))r.push(A.state.lastUF);for(const uf of CFG.ufs){if(new RegExp(`\\b${uf.toLowerCase()}\\b`).test(n))r.push(uf);for(const x of A.alias[uf].split(' '))if(x.length>4&&n.includes(x))r.push(uf)}if(raw.includes('pará'))r.push('PA');return[...new Set(r)]};
A.office=q=>{const n=A.norm(q);for(const[k,a]of A.officeAliases)if(a.some(x=>n.includes(A.norm(x))))return k;return null};
A.intent=q=>{const n=A.norm(q);if(/quais estados|que estados/.test(n)&&/(nao terminar|ainda nao|totaliza|apur)/.test(n))return'unfinished';if(/compare|comparar|comparacao/.test(n))return'compare';if(/cadeir|composicao|bancada|vagas|partidos/.test(n))return'seats';if(/quem foi eleito|eleitos|eleitas|quem ganhou/.test(n))return'elected';if((/quantos votos|votos .* teve|teve .* votos|recebeu .* votos|votos .* recebeu/.test(n))&&!/(brancos|nulos|validos|comparecimento|participacao)/.test(n))return'candidateVotes';if(/participacao|comparecimento|brancos|nulos|validos/.test(n))return'votes';if(/apurad|totaliza|secoes|quanto falta|terminou/.test(n))return'progress';if(/resuma|resumo|panorama|como ficou/.test(n))return'summary';return'auto'};
A.candidateTerm=q=>{
  let n=A.norm(q);
  const words=['quantos','quanto','votos','voto','o','a','os','as','teve','tem','recebeu','recebe','conseguiu','obteve','candidato','candidata','presidente','presidencia','governador','governadora','senador','senado','deputado','deputada','federal','estadual','distrital','camara','assembleia','cldf','em','no','na','nos','nas','do','da','dos','das','de','brasil','eleicao','eleicoes','2026'];
  const stop=new Set(words);
  const ufWords=new Set();
  for(const uf of CFG.ufs){
    ufWords.add(uf.toLowerCase());
    for(const x of A.alias[uf].split(' '))ufWords.add(x);
  }
  return n.split(' ').filter(x=>x&&x.length>1&&!stop.has(x)&&!ufWords.has(x)).join(' ').trim();
};
A.findCandidate=(j,term)=>{
  const t=A.norm(term);
  if(!t)return[];
  const tokens=t.split(' ').filter(Boolean);
  return A.flat(j).filter(c=>{
    const name=A.norm((c.nmu||'')+' '+(c.nm||''));
    return name.includes(t)||tokens.every(x=>name.includes(x));
  });
};
A.url=(k,uf)=>{const o=OFFICES[k],t=(k==='president'?(uf||'BR'):(uf||A.state.lastUF)).toUpperCase(),c=k==='stateDeputy'?(t==='DF'?'0008':'0007'):o.code,e=String(o.election).padStart(6,'0'),s=t.toLowerCase();return`${CFG.base}/${o.election}/dados/${s}/${s}-c${c}-e${e}-u.json`};
A.get=async(k,uf)=>{const t=(k==='president'?(uf||'BR'):(uf||A.state.lastUF)).toUpperCase(),ck=`${k}|${t}`,h=A.C.get(ck);if(h&&Date.now()-h.at<15000)return h.j;const ls=`e360-chat-${ck}`;try{const r=await fetch(A.url(k,t),{cache:'no-cache',headers:{Accept:'application/json'}});if(!r.ok)throw 0;const j=await r.json();A.C.set(ck,{j,at:Date.now()});try{localStorage.setItem(ls,JSON.stringify(j))}catch{}return j}catch{const x=localStorage.getItem(ls);if(x){const j=JSON.parse(x);A.C.set(ck,{j,at:Date.now()});return j}throw new Error('TSE indisponível')}};
A.flat=j=>{const out=[];for(const c of j?.carg||[])(c.agr||[]).forEach((g,i)=>{for(const p of g.par||[])for(const x of p.cand||[])out.push({...x,party:p.sg||'',group:`${i}|${g.nm||''}`,seats:Number(g.vag)||0,dest:x.dvt||p.dvt||''})});return out};
A.valid=c=>{const d=A.norm(c.dest);return!d||d.startsWith('valido')};
A.stat=(c,k,j)=>{const s=String(c.st||'').trim(),n=A.norm(s);if(s){if(n.startsWith('eleito'))return'elected';if(n.includes('2 turno'))return'runoff';if(n.includes('suplente'))return'alternate';if(n.includes('nao eleito'))return'not'}if(String(c.e||'').toLowerCase()==='s'){if(OFFICES[k].majority){const m=String(j.md||'').toLowerCase();if(m==='e')return'elected';if(m==='s')return'runoff'}else return'elected'}return''};
A.elected=(j,k)=>{const a=A.flat(j),off=a.filter(c=>A.stat(c,k,j)==='elected');if(off.length)return{items:off,partial:false};if(!OFFICES[k].proportional||String(j.tf||'').toLowerCase()==='s')return{items:[],partial:false};const g=new Map();for(const c of a){if(!A.valid(c))continue;if(!g.has(c.group))g.set(c.group,{n:c.seats,a:[]});g.get(c.group).a.push(c)}const out=[];for(const x of g.values()){x.a.sort((a,b)=>Number(b.vap)-Number(a.vap)||Number(a.n)-Number(b.n));out.push(...x.a.slice(0,x.n))}return{items:out,partial:out.length>0}};
A.met=j=>{const m=metrics(j,null);return{...m,stamp:[j.dt,j.ht].filter(Boolean).join(' ')||[j.dg,j.hg].filter(Boolean).join(' ')||'—',turnout:m.electorate?100*m.totalVotes/m.electorate:0}};
A.label=(k,uf)=>k==='stateDeputy'?(uf==='DF'?'Deputado Distrital':'Deputado Estadual'):{president:'Presidente',governor:'Governador',senator:'Senado',federalDeputy:'Deputado Federal'}[k];
A.source=(j,k,uf)=>{const m=A.met(j);return`<div class="ask-source-line">Fonte: TSE • ${A.esc(m.stamp)} • ${A.P.format(m.sections)}% das seções <button data-open="${k}" data-uf="${uf}">Ver dados completos</button></div>`};
A.partyColor=p=>{let h=0;for(const x of String(p))h=((h<<5)-h)+x.charCodeAt(0);return['#2563eb','#7c3aed','#0f766e','#b45309','#be123c','#0369a1','#4d7c0f','#334155'][Math.abs(h)%8]};
})(window.E360Ask);
