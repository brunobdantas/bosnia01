'use strict';

const CFG={
  base:'https://resultados.tse.jus.br/oficial/ele2026/6257/dados',
  ele:'006257',cargo:'0001',
  mainMs:3000,ufMs:30000,maxBackoffMs:30000,
  ufs:['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
};
const UF={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const $=id=>document.getElementById(id);
const fi=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const fp=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fpp=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
let data=null,cands=[],sel=null,busy=false,ufBusy=false,failureStreak=0,nextAt=0,lastSuccessfulAt=0,lastDistinctKey=null,mainTimer=null,ufTimer=null,countdownTimer=null;

const num=(v,d=0)=>{if(v==null||v==='')return d;if(typeof v==='number')return Number.isFinite(v)?v:d;let s=String(v).trim();if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:d};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pct=v=>clamp(num(v),0,100);
const sign=n=>n>0?'+':'';
const scopeUrl=scope=>{const u=scope.toLowerCase(),f=scope==='BR'?`br-c${CFG.cargo}-e${CFG.ele}-u.json`:`${u}-c${CFG.cargo}-e${CFG.ele}-u.json`;return `${CFG.base}/${u}/${f}`};

function candidates(j){const a=[];for(const c of j?.carg||[])for(const g of c?.agr||[])for(const p of g?.par||[])for(const x of p?.cand||[])a.push({...x,party:p.sg||'',group:g.nm||'',dest:x.dvt||p.dvt||''});return a}
function validDest(c){const d=String(c?.dest||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return !d||d.startsWith('valido')}
function distinctKey(j){return String(j?.idg||[j?.dg,j?.hg,j?.s?.st,j?.v?.vv].join('|'))}

async function load(u,key,timeoutMs=7000){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const r=await fetch(u,{cache:'no-cache',headers:{Accept:'application/json'},signal:ctl.signal});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const j=await r.json();
    try{localStorage.setItem(key,JSON.stringify(j))}catch{}
    return{j,stale:false};
  }catch(error){
    try{const x=localStorage.getItem(key);if(x)return{j:JSON.parse(x),stale:true,error}}catch{}
    throw error;
  }finally{clearTimeout(t)}
}

function metrics(j,c){
  const vv=num(j?.v?.vv),cv=num(c?.vap),share=vv?100*cv/vv:0;
  const te=num(j?.e?.te),est=num(j?.e?.est),rem=Math.max(0,num(j?.e?.esnt,Math.max(0,te-est)));
  const finalMaxValid=vv+rem,majorityExtreme=Math.floor(finalMaxValid/2)+1,majorityNow=Math.floor(vv/2)+1;
  const minShare=finalMaxValid?100*cv/finalMaxValid:0;
  const maxShare=finalMaxValid?100*(cv+rem)/finalMaxValid:0;
  const buffer=Math.max(0,2*cv-vv-1);
  return{vv,cv,share,rem,finalMaxValid,majorityExtreme,majorityNow,minShare,maxShare,
    worstNeed:Math.max(0,majorityExtreme-cv),
    guaranteed:cv>=majorityExtreme,
    impossible:cv+rem<majorityExtreme,
    delta:cv-majorityNow,buffer};
}

function source(kind,text){const p=$('sourcePill');p.classList.remove('live','error');if(kind)p.classList.add(kind);$('sourceStatus').textContent=text;const pulse=$('syncPulse');pulse.className=kind==='live'?'live':kind==='error'?'error':'';$('syncText').textContent=kind==='live'?'Ao vivo':kind==='error'?'Reconectando':'Sincronizando'}
function notice(kind,text){const n=$('notice');n.className=`notice ${kind}`;n.textContent=text}

function fillSelect(){
  const s=$('candidateSelect'),prev=sel?.sqcand&&String(sel.sqcand);s.innerHTML='';
  const sorted=[...cands].sort((a,b)=>num(a.n)-num(b.n));
  for(const c of sorted){const o=document.createElement('option');o.value=String(c.sqcand);o.textContent=`${c.n} • ${c.nmu||c.n}${c.party?` (${c.party})`:''}`;s.appendChild(o)}
  sel=cands.find(c=>String(c.sqcand)===prev)||sorted.find(validDest)||sorted[0]||null;
  if(sel)s.value=String(sel.sqcand);s.disabled=!sel;
}

function historyStorage(){try{return JSON.parse(localStorage.getItem('tse26-history-v2')||'[]')}catch{return[]}}
function saveSnapshot(j){
  const key=distinctKey(j);if(!key||key===lastDistinctKey)return false;lastDistinctKey=key;
  const list=candidates(j),vv=num(j?.v?.vv),sections=pct(j?.s?.pstn??j?.s?.pst),map={};
  for(const c of list)map[String(c.sqcand)]={v:num(c.vap),s:vv?100*num(c.vap)/vv:0,n:String(c.n||'')};
  const hist=historyStorage();if(hist.some(x=>x.key===key))return false;
  hist.push({key,ts:Date.now(),t:[j.dg,j.hg].filter(Boolean).join(' '),sections,vv,c:map});
  while(hist.length>180)hist.shift();
  try{localStorage.setItem('tse26-history-v2',JSON.stringify(hist))}catch{}
  return true;
}
function candidateHistory(){if(!sel)return[];const id=String(sel.sqcand),n=String(sel.n||'');return historyStorage().map(x=>{const c=x.c?.[id]||Object.values(x.c||{}).find(v=>String(v.n)===n);return c?{...x,cv:c.v,share:c.s}:null}).filter(Boolean)}

