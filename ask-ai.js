'use strict';

(A=>{
  const intents=new Set(['candidateVotes','elected','seats','votes','progress','compare','summary','unfinished']);
  const offices=new Set(['president','governor','senator','federalDeputy','stateDeputy']);
  const ufSet=new Set(['BR',...CFG.ufs]);

  A.state.context=A.state.context||{intent:null,office:null,ufs:[],turns:[]};
  A.state.aiReady=false;
  A.state.aiLoadState='idle';
  A.state.aiProgress=0;
  A.state.aiDevice='';

  A.localPlan=q=>({
    q,
    n:A.norm(q),
    us:A.ufs(q),
    k:A.office(q),
    i:A.intent(q)
  });

  A.isFollowup=q=>{
    const n=A.norm(q);
    return /^(e |agora |tambem |e no |e na |e em |esses |essas |desses |dessas |la\b|nesse |nessa |isso\b|e os |e as )/.test(n)
      || /\b(mesmo cargo|mesma uf|nesse estado|nessa uf|desses eleitos|essas cadeiras)\b/.test(n);
  };

  A.enrichWithContext=(p,q)=>{
    const ctx=A.state.context||{};
    if(!A.isFollowup(q))return p;
    return{
      ...p,
      i:p.i==='auto'?(ctx.intent||'auto'):p.i,
      k:p.k||(ctx.office||null),
      us:p.us?.length?p.us:[...(ctx.ufs||[])]
    };
  };

  A.needsAI=(q,p)=>{
    const n=A.norm(q);
    if(p.i==='auto')return true;
    if(A.isFollowup(q))return true;
    if(!p.k&&['elected','seats'].includes(p.i)&&A.state.context?.office)return true;
    if(/\b(quem sao esses|quais desses|por partido|so os nomes|so eleitos|agora compare|e quanto|e os outros|explique|me mostre|quero entender)\b/.test(n))return true;
    return false;
  };

  A.localAIDevice=()=>navigator.gpu?'webgpu':'wasm';

  A.refreshAIStatus=()=>{
    const btn=A.E('askAiButton'),node=A.E('askSourceStatus');
    const st=A.state.aiLoadState;

    if(st==='ready'){
      document.documentElement.dataset.aiProvider='local-ready';
      if(node)node.textContent=`IA local ativa • ${A.state.aiDevice==='webgpu'?'WebGPU':'CPU'} • TSE`;
      if(btn){
        btn.disabled=false;
        btn.classList.add('active');
        btn.querySelector('span').textContent='IA local ativa';
      }
      return;
    }

    if(st==='loading'){
      document.documentElement.dataset.aiProvider='local-loading';
      const p=Math.round(A.state.aiProgress||0);
      if(node)node.textContent=p>0?`Preparando IA local • ${p}%`:'Preparando IA local…';
      if(btn){
        btn.disabled=true;
        btn.classList.remove('active');
        btn.querySelector('span').textContent=p>0?`IA local ${p}%`:'Carregando IA local…';
      }
      return;
    }

    if(st==='failed'){
      document.documentElement.dataset.aiProvider='local-failed';
      if(node)node.textContent='Modo local determinístico • dados TSE';
      if(btn){
        btn.disabled=false;
        btn.classList.remove('active');
        btn.querySelector('span').textContent='Tentar IA local';
      }
      return;
    }

    document.documentElement.dataset.aiProvider='local-idle';
    if(node)node.textContent='Dados oficiais do TSE';
    if(btn){
      btn.disabled=false;
      btn.classList.remove('active');
      btn.querySelector('span').textContent='Preparar IA local';
    }
  };

  A.toast=msg=>{
    const t=A.E('askToast');
    if(!t)return;
    t.textContent=msg;
    t.hidden=false;
    clearTimeout(A.toast._t);
    A.toast._t=setTimeout(()=>t.hidden=true,3200);
  };

  A.ensureAIWorker=()=>{
    if(A._aiWorker)return A._aiWorker;
    const w=new Worker('ask-local-worker.js?v=20261005-localai-1',{type:'module'});
    A._aiWorker=w;
    A._aiPending=new Map();

    w.onmessage=e=>{
      const m=e.data||{};
      if(m.type==='progress'){
        const p=Number(m.progress);
        if(Number.isFinite(p))A.state.aiProgress=Math.max(A.state.aiProgress||0,p);
        A.refreshAIStatus();
        return;
      }
      if(m.type==='status'){
        A.state.aiLoadState='loading';
        A.refreshAIStatus();
        return;
      }
      if(m.type==='ready'){
        A.state.aiReady=true;
        A.state.aiLoadState='ready';
        A.state.aiProgress=100;
        A.state.aiDevice=m.device||A.localAIDevice();
        A.refreshAIStatus();
        A._aiInitResolve?.(true);
        A._aiInitResolve=null;
        A._aiInitReject=null;
        return;
      }
      if(m.type==='result'){
        const p=A._aiPending.get(m.id);
        if(p){
          A._aiPending.delete(m.id);
          p.resolve(String(m.text||''));
        }
        return;
      }
      if(m.type==='error'){
        if(m.id){
          const p=A._aiPending.get(m.id);
          if(p){
            A._aiPending.delete(m.id);
            p.reject(new Error(m.message||'local_ai_error'));
          }
        }else{
          A.state.aiReady=false;
          A.state.aiLoadState='failed';
          A.refreshAIStatus();
          A._aiInitReject?.(new Error(m.message||'local_ai_error'));
          A._aiInitResolve=null;
          A._aiInitReject=null;
        }
      }
    };

    w.onerror=error=>{
      console.info('[Eleição 360] IA local indisponível.',error?.message||error);
      A.state.aiReady=false;
      A.state.aiLoadState='failed';
      A.refreshAIStatus();
      A._aiInitReject?.(new Error(error?.message||'worker_error'));
      A._aiInitResolve=null;
      A._aiInitReject=null;
    };

    return w;
  };

  A.loadAIProvider=()=>{
    if(A.state.aiReady)return Promise.resolve(true);
    if(A._aiLoader)return A._aiLoader;

    A.state.aiLoadState='loading';
    A.state.aiProgress=0;
    A.refreshAIStatus();

    A._aiLoader=new Promise((resolve,reject)=>{
      A._aiInitResolve=resolve;
      A._aiInitReject=reject;
      try{
        A.ensureAIWorker().postMessage({type:'init',device:A.localAIDevice()});
      }catch(error){
        reject(error);
      }
    }).then(()=>{
      A.state.aiReady=true;
      A.state.aiLoadState='ready';
      A.refreshAIStatus();
      return true;
    }).catch(error=>{
      console.info('[Eleição 360] Falha ao carregar IA local; mantendo parser determinístico.',error?.message||error);
      A.state.aiReady=false;
      A.state.aiLoadState='failed';
      A._aiLoader=null;
      A.refreshAIStatus();
      return false;
    });

    return A._aiLoader;
  };

  A.activateAI=async()=>{
    if(A.state.aiReady){
      A.toast('IA local já está ativa neste aparelho.');
      return true;
    }
    A.toast('Preparando IA local. Na primeira vez o navegador baixa o modelo e o guarda em cache.');
    const ok=await A.loadAIProvider();
    if(ok)A.toast('IA local pronta. Nenhum cadastro ou chave é necessário.');
    else A.toast('A IA local não pôde iniciar neste navegador. O modo determinístico continua funcionando.');
    return ok;
  };

  A.aiContent=text=>String(text||'').trim();

  A.normalizePlan=(raw,local)=>{
    const ctx=A.state.context||{};
    const i=intents.has(raw?.intent)?raw.intent:(intents.has(local?.i)?local.i:(intents.has(ctx.intent)?ctx.intent:'summary'));
    const k=offices.has(raw?.office)?raw.office:(offices.has(local?.k)?local.k:(offices.has(ctx.office)?ctx.office:null));
    const us=(Array.isArray(raw?.ufs)?raw.ufs:[])
      .map(x=>String(x||'').toUpperCase())
      .filter(x=>ufSet.has(x));
    const mergedUfs=us.length?us:(local?.us?.length?local.us:[...(ctx.ufs||[])]);
    return{q:local.q,n:local.n,i,k,us:[...new Set(mergedUfs)].slice(0,4)};
  };

  A.localAIInfer=async(messages)=>{
    const ok=A.state.aiReady||await A.loadAIProvider();
    if(!ok)throw new Error('local_ai_unavailable');

    const id='q'+Date.now()+'-'+Math.random().toString(36).slice(2);
    const worker=A.ensureAIWorker();
    const promise=new Promise((resolve,reject)=>{
      A._aiPending.set(id,{resolve,reject});
      setTimeout(()=>{
        const p=A._aiPending.get(id);
        if(p){
          A._aiPending.delete(id);
          reject(new Error('local_ai_timeout'));
        }
      },30000);
    });

    worker.postMessage({type:'infer',id,messages,device:A.localAIDevice()});
    return promise;
  };

  A.interpretAI=async(q,local)=>{
    const ctx=A.state.context||{};
    const system=[
      'Você interpreta perguntas sobre resultados das Eleições 2026 no Brasil.',
      'NÃO responda a pergunta. NÃO produza números, votos, percentuais, nomes de eleitos ou previsões.',
      'Sua única tarefa é transformar a frase em um plano estruturado.',
      'Retorne SOMENTE um objeto JSON válido, sem markdown, com exatamente estas chaves:',
      '{"intent":"candidateVotes|elected|seats|votes|progress|compare|summary|unfinished","office":"president|governor|senator|federalDeputy|stateDeputy|null","ufs":["UF"]}',
      'UF deve ser sigla oficial brasileira em maiúsculas; use BR apenas para Presidência nacional.',
      'Use o contexto anterior apenas quando o usuário fizer continuação, por exemplo "e no DF?", "agora Senado", "e por partido?".',
      'Pergunta sobre votos de uma pessoa/candidato = candidateVotes.',
      'Composição, bancada, cadeiras, vagas ou por partido = seats.',
      'Eleitos ou quem ganhou = elected.',
      'Brancos, nulos, válidos ou comparecimento = votes; se comparar UFs, compare.',
      'Seções, andamento, quanto falta ou totalização = progress.',
      'Panorama/resumo de uma UF = summary.',
      'UFs que ainda não terminaram = unfinished.',
      'Exemplos: "e no DF?" após uma pergunta sobre Câmara mantém o cargo e troca ufs para ["DF"].',
      'Exemplo: "agora por partido" após Câmara = {"intent":"seats","office":"federalDeputy","ufs":ufs_do_contexto}.',
      'Exemplo: "quem entrou em Minas?" com contexto de deputado federal = elected + federalDeputy + MG.',
      'Exemplo: "quantos votos o Zema teve?" = candidateVotes; office pode ser null se o cargo não estiver explícito.',
      'Nunca inferir preferência política, nunca prever vencedor e nunca classificar candidatos.'
    ].join(' ');

    const messages=[
      {role:'system',content:system},
      {role:'user',content:`Contexto anterior: ${JSON.stringify({intent:ctx.intent||null,office:ctx.office||null,ufs:ctx.ufs||[],lastUF:A.state.lastUF})}\nPergunta atual: ${q}`}
    ];

    const text=A.aiContent(await A.localAIInfer(messages));
    const match=text.match(/\{[\s\S]*\}/);
    if(!match)throw new Error('local_ai_invalid_json');
    return A.normalizePlan(JSON.parse(match[0]),local);
  };

  A.executePlan=async(p,r)=>{
    if(p.i==='candidateVotes')return A.candidateVotesAnswer(p,r);
    if(p.i==='elected')return A.electedAnswer(p,r);
    if(p.i==='seats')return A.seatsAnswer(p,r);
    if(p.i==='votes')return A.votesAnswer(p,r);
    if(p.i==='progress')return A.progressAnswer(p,r);
    if(p.i==='compare')return A.compareAnswer(p,r);
    if(p.i==='summary')return A.summaryAnswer(p,r);
    if(p.i==='unfinished')return A.unfinishedAnswer(p,r);
    if(p.us?.length)return A.summaryAnswer(p,r);
    return A.fail(r);
  };

  A.rememberPlan=(p,q,usedAI)=>{
    const prev=A.state.context||{};
    A.state.context={
      intent:intents.has(p.i)?p.i:prev.intent,
      office:offices.has(p.k)?p.k:prev.office,
      ufs:p.us?.length?[...p.us]:[...(prev.ufs||[])],
      turns:[...(prev.turns||[]),{q,usedAI,at:Date.now()}].slice(-6)
    };
  };

  A.canExecuteLocally=p=>{
    if(!p)return false;
    if(p.i==='candidateVotes')return true;
    if(['votes','progress','summary','unfinished','compare'].includes(p.i))return p.i!=='compare'||p.us?.length>=2;
    if(['elected','seats'].includes(p.i))return !!p.k||p.i==='seats';
    return false;
  };

  A.smartRoute=async(q,r,{forceAI=false}={})=>{
    const local=A.localPlan(q);
    const enriched=A.enrichWithContext(local,q);
    let plan=enriched;
    let usedAI=false;
    const wantsAI=forceAI||A.needsAI(q,local);

    if(wantsAI){
      const ok=A.state.aiReady||await A.loadAIProvider();
      if(ok){
        try{
          plan=await A.interpretAI(q,enriched);
          usedAI=true;
        }catch(error){
          console.info('[Eleição 360] IA local não interpretou; usando parser determinístico.',error?.message||error);
          plan=enriched;
        }
      }
    }

    if(!usedAI&&!A.canExecuteLocally(plan)&&wantsAI){
      return A.fail(r);
    }

    await A.executePlan(plan,r);
    A.rememberPlan(plan,q,usedAI);

    if(usedAI){
      r.insertAdjacentHTML('beforeend','<div class="ask-ai-note">IA local interpretou a pergunta • números e situações calculados somente com dados do TSE</div>');
      A.bind?.(r);
      A.E('askSourceStatus').textContent='IA local ativa • dados oficiais do TSE';
      document.documentElement.dataset.aiLast='local-model';
      return 'ai';
    }

    A.refreshAIStatus();
    document.documentElement.dataset.aiLast='deterministic';
    return 'local';
  };

  A.resetAIContext=()=>{A.state.context={intent:null,office:null,ufs:[],turns:[]}};

})(window.E360Ask);
