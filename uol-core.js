'use strict';

const CFG={
  base:'https://resultados.tse.jus.br/oficial/ele2026',
  pollMs:3000,
  summaryMs:30000,
  maxBackoffMs:30000,
  ufs:['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
};
const UF={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const OFFICES={
  president:{slug:'presidente',label:'Presidente',code:'0001',election:'6257',scope:'federal',rule:'Maioria absoluta',majority:true},
  governor:{slug:'governador',label:'Governador',code:'0003',election:'6259',scope:'state',rule:'Maioria absoluta',majority:true},
  senator:{slug:'senado',label:'Senador',code:'0005',election:'6259',scope:'state',rule:'2 vagas em 2026',senate:true},
  federalDeputy:{slug:'camara',label:'Deputado Federal',code:'0006',election:'6259',scope:'state',rule:'Sistema proporcional',proportional:true},
  stateDeputy:{slug:'assembleia',label:'Deputado Estadual/Distrital',code:'dynamic',election:'6259',scope:'state',rule:'Sistema proporcional',proportional:true}
};
const SLUG_TO_OFFICE=Object.fromEntries(Object.entries(OFFICES).map(([k,v])=>[v.slug,k]));
const $=id=>document.getElementById(id);
const fi=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const fp=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fpp=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});

let officeKey='president';
let scope='BR';
let preferredUF=localStorage.getItem('tse26-preferred-uf')||'DF';
let data=null,candidates=[],selected=null;
let busy=false,failures=0,nextAt=0,timer=null,countdownTimer=null,summaryTimer=null,lastSuccessAt=0,lastDistinctKey='';
let showAll=false,comparedIds=[],statusFilter='all';

const num=(v,d=0)=>{
  if(v===null||v===undefined||v==='')return d;
  if(typeof v==='number')return Number.isFinite(v)?v:d;
  let s=String(v).trim();
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:d;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pct=v=>clamp(num(v),0,100);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const signed=(n,f=fi)=>`${n>0?'+':''}${f.format(n)}`;
const office=()=>OFFICES[officeKey];
const officeCode=(uf=scope)=>officeKey==='stateDeputy'?(uf==='DF'?'0008':'0007'):office().code;
const officeLabel=(uf=scope)=>officeKey==='stateDeputy'?(uf==='DF'?'Deputado Distrital':'Deputado Estadual'):office().label;
const scopeLabel=(uf=scope)=>uf==='BR'?'Brasil':`${uf} • ${UF[uf]}`;

function resultUrlFor(key,uf){
  const o=OFFICES[key],e=String(o.election).padStart(6,'0');
  const targetUf=(uf||(key==='president'?'BR':preferredUF)).toUpperCase();
  const code=key==='stateDeputy'?(targetUf==='DF'?'0008':'0007'):o.code;
  const s=targetUf.toLowerCase();
  return `${CFG.base}/${o.election}/dados/${s}/${s}-c${code}-e${e}-u.json`;
}
function resultUrl(){return resultUrlFor(officeKey,scope)}
function photoUrl(c,key=officeKey,uf=scope){
  const o=OFFICES[key],folder=key==='president'?'br':String(uf||preferredUF).toLowerCase();
  return `${CFG.base}/${o.election}/fotos/${folder}/${c.sqcand}.jpeg`;
}
const storageKey=()=>`tse26-uol-v1-${officeKey}-${scope}`;
const historyKey=()=>`tse26-uol-history-v1-${officeKey}-${scope}`;
const compareKey=()=>`tse26-uol-compare-v1-${officeKey}-${scope}`;
const distinctKey=j=>String(j?.idg||[j?.dg,j?.hg,j?.s?.st,j?.v?.tv].join('|'));

function flattenCandidates(j){
  const out=[];
  for(const cargo of j?.carg||[]){
    (cargo?.agr||[]).forEach((agr,agrIndex)=>{
      const agrKey=`agr-${agrIndex}|${String(agr?.sqagr||agr?.n||agr?.nm||'')}`;
      const agrSeats=Math.max(0,num(agr?.vag));
      for(const par of agr?.par||[])for(const cand of par?.cand||[]){
        out.push({
          ...cand,
          party:par?.sg||'',
          partyName:par?.nm||'',
          group:agr?.nm||'',
          agrKey,
          agrSeats,
          destination:cand?.dvt||par?.dvt||''
        });
      }
    });
  }
  return out;
}
function validDestination(c){
  const d=String(c?.destination||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return !d||d.startsWith('valido');
}

let provisionalSeatCache={key:'',ids:new Set(),seatCount:0};
function provisionalSeatSet(){
  if(!office().proportional||!data)return new Set();
  const cacheKey=`${officeKey}|${scope}|${distinctKey(data)}`;
  if(provisionalSeatCache.key===cacheKey)return provisionalSeatCache.ids;

  const groups=new Map();
  for(const c of candidates){
    if(!validDestination(c))continue;
    const key=String(c.agrKey||c.party||'');
    if(!groups.has(key))groups.set(key,{seats:Math.max(0,num(c.agrSeats)),items:[]});
    groups.get(key).items.push(c);
  }

  const ids=new Set();
  let seatCount=0;
  for(const g of groups.values()){
    if(g.seats<=0)continue;
    g.items.sort((a,b)=>num(b.vap)-num(a.vap)||num(a.n)-num(b.n)||String(a.nmu||a.nm||'').localeCompare(String(b.nmu||b.nm||''),'pt-BR'));
    for(const c of g.items.slice(0,g.seats))ids.add(String(c.sqcand));
    seatCount+=Math.min(g.seats,g.items.length);
  }

  provisionalSeatCache={key:cacheKey,ids,seatCount};
  return ids;
}
function isProvisionalElected(c){
  return !!(office().proportional&&String(data?.tf||'').toLowerCase()!=='s'&&provisionalSeatSet().has(String(c?.sqcand)));
}
function candidateShare(c,j){
  const reported=num(c?.pvap,NaN);
  if(Number.isFinite(reported))return reported;
  const m=metrics(j,null),cv=num(c?.vap);
  return m.validVotes?100*cv/m.validVotes:0;
}
function metrics(j,c){
  const v=j?.v||{},all=flattenCandidates(j),candidateSum=all.filter(validDestination).reduce((s,x)=>s+num(x.vap),0);
  const hasVv=v.vv!==undefined&&v.vv!==null&&v.vv!=='';
  const hasNom=v.tvn!==undefined||v.vp!==undefined;
  const validVotes=hasVv?num(v.vv):(hasNom?num(v.tvn)+num(v.vp):candidateSum);
  const totalVotes=num(v.tv);
  const blankVotes=num(v.vb);
  const nullVotes=Math.max(0,totalVotes-validVotes-blankVotes);
  const te=num(j?.e?.te),est=num(j?.e?.est),remaining=Math.max(0,num(j?.e?.esnt,Math.max(0,te-est)));
  return{
    validVotes,totalVotes,blankVotes,nullVotes,electorate:te,totalizedElectorate:est,remaining,
    sections:pct(j?.s?.pstn??j?.s?.pst),totalSections:num(j?.s?.ts),doneSections:num(j?.s?.st),
    candidateVotes:c?num(c.vap):0,candidateShare:c?candidateShare(c,j):0
  };
}
function majorityMath(m){
  const maxValid=m.validVotes+m.remaining,currentThreshold=Math.floor(m.validVotes/2)+1,extremeThreshold=Math.floor(maxValid/2)+1;
  return{
    minShare:maxValid?100*m.candidateVotes/maxValid:0,
    maxShare:maxValid?100*(m.candidateVotes+m.remaining)/maxValid:0,
    diffCurrent:m.candidateVotes-currentThreshold,
    needExtreme:Math.max(0,extremeThreshold-m.candidateVotes)
  };
}
function genericRange(m){
  if(office().senate){
    const minDen=m.validVotes+2*m.remaining,maxDen=m.validVotes+m.remaining;
    return{min:minDen?100*m.candidateVotes/minDen:0,max:maxDen?100*(m.candidateVotes+m.remaining)/maxDen:0};
  }
  const den=m.validVotes+m.remaining;
  return{min:den?100*m.candidateVotes/den:0,max:den?100*(m.candidateVotes+m.remaining)/den:0};
}
function statusMeta(c){
  const raw=String(c?.st||'').trim();
  const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/º/g,'o');
  if(raw){
    if(normalized.includes('nao eleito'))return{key:'not-elected',label:raw,icon:'—'};
    if(normalized.includes('suplente'))return{key:'alternate',label:raw,icon:'S'};
    if(normalized.includes('2o turno')||normalized.includes('2 turno'))return{key:'runoff',label:raw,icon:'2º'};
    if(normalized.startsWith('eleito'))return{key:'elected',label:raw,icon:'✓'};
    return{key:'defined',label:raw,icon:'•'};
  }
  if(String(c?.e||'').toLowerCase()==='s'){
    const md=String(data?.md||'').trim().toLowerCase();
    const final=String(data?.tf||'').trim().toLowerCase()==='s';
    if(office().majority){
      if(md==='e')return{key:'elected',label:'Eleito • definição matemática TSE',icon:'✓',early:!final};
      if(md==='s')return{key:'runoff',label:'2º turno • definição matemática TSE',icon:'2º',early:!final};
      return{key:'defined',label:'Situação definida pelo TSE',icon:'•',early:!final};
    }
    return{key:'elected',label:'Eleito • TSE',icon:'✓',early:!final};
  }
  if(isProvisionalElected(c))return{key:'current-elected',label:'Eleito se terminasse agora',icon:'1',provisional:true};
  return null;
}
function officialStatus(c){return statusMeta(c)?.label||''}

function initials(c){
  const name=String(c?.nmu||c?.nm||'?').trim();
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
}

async function fetchJson(url,key,timeoutMs=7500){
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{cache:'no-cache',headers:{Accept:'application/json'},signal:ctl.signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const j=await r.json();
    if(key)try{localStorage.setItem(key,JSON.stringify(j))}catch{}
    return{j,stale:false};
  }catch(error){
    if(key)try{const cached=localStorage.getItem(key);if(cached)return{j:JSON.parse(cached),stale:true,error}}catch{}
    throw error;
  }finally{clearTimeout(to)}
}
function snapshotHistory(){
  try{return JSON.parse(localStorage.getItem(historyKey())||'[]')}catch{return[]}
}
function saveSnapshot(j){
  const key=distinctKey(j); if(!key||key===lastDistinctKey)return false; lastDistinctKey=key;
  const map={};
  for(const c of flattenCandidates(j))map[String(c.sqcand)]={votes:num(c.vap),share:candidateShare(c,j),number:String(c.n||'')};
  const h=snapshotHistory();
  if(h.some(x=>x.key===key))return false;
  h.push({key,ts:Date.now(),label:[j?.dg,j?.hg].filter(Boolean).join(' '),sections:pct(j?.s?.pstn??j?.s?.pst),c:map});
  while(h.length>180)h.shift();
  try{localStorage.setItem(historyKey(),JSON.stringify(h))}catch{}
  return true;
}
function historyFor(c){
  if(!c)return[];
  const id=String(c.sqcand),n=String(c.n||'');
  return snapshotHistory().map(x=>{
    const v=x.c?.[id]||Object.values(x.c||{}).find(z=>String(z.number)===n);
    return v?{...x,cv:v.votes,share:v.share}:null;
  }).filter(Boolean);
}
function loadCompared(){
  try{comparedIds=JSON.parse(localStorage.getItem(compareKey())||'[]').map(String).slice(0,4)}catch{comparedIds=[]}
}
function saveCompared(){try{localStorage.setItem(compareKey(),JSON.stringify(comparedIds))}catch{}}
function comparedCandidates(){return comparedIds.map(id=>candidates.find(c=>String(c.sqcand)===id)).filter(Boolean)}
function chooseSelected(){
  const wanted=new URLSearchParams(location.search).get('cand');
  const previous=selected?.sqcand&&String(selected.sqcand);
  selected=candidates.find(c=>String(c.sqcand)===String(wanted||previous||''))||[...candidates].sort((a,b)=>num(a.n)-num(b.n))[0]||null;
}
function source(kind,text){
  const p=$('sourcePill');p.classList.remove('live','error');if(kind)p.classList.add(kind);$('sourceStatus').textContent=text;
}
function notice(kind,text){const n=$('notice');n.className=`notice ${kind}`;n.textContent=text}
