'use strict';

(A=>{
  const intents=new Set(['elected','seats','votes','progress','compare','summary','unfinished']);
  const offices=new Set(['president','governor','senator','federalDeputy','stateDeputy']);
  const ufSet=new Set(['BR',...CFG.ufs]);

  A.state.context=A.state.context||{intent:null,office:null,ufs:[],turns:[]};
  A.state.aiReady=false;
  A.state.aiLoadState='idle';

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
    if(/\b(quem sao esses|quais desses|por partido|so os nomes|so eleitos|agora compare|e quanto|e os outros)\b/.test(n))return true;
    return false;
  };

  A.isAISignedIn=()=>{
    try{return !!window.puter?.auth?.isSignedIn?.()}catch{return false}
  };

  A.refreshAIStatus=()=>{
    const btn=A.E('askAiButton'),node=A.E('askSourceStatus');
    const available=!!window.puter?.ai?.chat;
    const signed=available&&A.isAISignedIn();

    if(signed){
      document.documentElement.dataset.aiProvider='puter-active';
      if(node)node.textContent='IA ativa • dados oficiais do TSE';
      if(btn){btn.disabled=false;btn.classList.add('active');btn.querySelector('span').textContent='IA ativa'}
      return;
    }

    if(available){
      document.documentElement.dataset.aiProvider='puter-ready';
      if(node)node.textContent='IA opcional • dados oficiais do TSE';
      if(btn){btn.disabled=false;btn.classList.remove('active');btn.querySelector('span').textContent='Ativar IA grátis'}
      return;
    }

    document.documentElement.dataset.aiProvider='fallback';
    if(node)node.textContent='Modo local • dados oficiais do TSE';
    if(btn){
      btn.classList.remove('active');
      btn.disabled=A.state.aiLoadState==='loading';
      btn.querySelector('span').textContent=A.state.aiLoadState==='loading'?'Carregando IA…':'Tentar carregar IA';
    }
  };

  A.loadAIProvider=()=>{
    if(window.puter?.ai?.chat){
      A.state.aiReady=true;
      A.state.aiLoadState='ready';
      A.refreshAIStatus();
      return Promise.resolve(true);
    }
    if(A._aiLoader)return A._aiLoader;

    A.state.aiLoadState='loading';
    A.refreshAIStatus();

    A._aiLoader=new Promise(resolve=>{
      let done=false;
      const finish=ok=>{
        if(done)return;
        done=true;
        A.state.aiReady=!!ok;
        A.state.aiLoadState=ok?'ready':'failed';
        A.refreshAIStatus();
        resolve(!!ok);
      };
      const script=document.createElement('script');
      script.src='https://js.puter.com/v2/';
      script.async=true;
      script.dataset.e360Ai='puter';
      script.onload=()=>finish(!!window.puter?.ai?.chat);
      script.onerror=()=>finish(false);
      document.head.appendChild(script);
      setTimeout(()=>finish(!!window.puter?.ai?.chat),7000);
    });

    return A._aiLoader;
  };

  A.toast=msg=>{
    const t=A.E('askToast');
    if(!t)return;
    t.textContent=msg;
    t.hidden=false;
    clearTimeout(A.toast._t);
    A.toast._t=setTimeout(()=>t.hidden=true,3000);
  };

  A.activateAI=async()=>{
    if(!window.puter?.auth?.signIn){
      A.toast('A IA ainda está carregando. Tente novamente em alguns segundos.');
      A.loadAIProvider();
      return false;
    }

    if(A.isAISignedIn()){
      A.refreshAIStatus();
      A.toast('IA já está ativa.');
      return true;
    }

    const btn=A.E('askAiButton');
    if(btn){btn.disabled=true;btn.querySelector('span').textContent='Ativando IA…'}

    try{
      await window.puter.auth.signIn({attempt_temp_user_creation:true});
      const ok=A.isAISignedIn();
      A.refreshAIStatus();
      if(ok)A.toast('IA ativada. Agora você pode fazer perguntas mais livres.');
      return ok;
    }catch(error){
      console.info('[Eleição 360] Ativação da IA cancelada ou bloqueada.',error?.error||error?.message||error);
      A.refreshAIStatus();
      A.toast(error?.error==='popup_blocked'
        ? 'O navegador bloqueou a janela de ativação. Libere pop-ups e tente novamente.'
        : 'A IA não foi ativada. O modo local continua funcionando.');
      return false;
    }
  };

  A.aiContent=response=>{
    let content=response?.message?.content??response?.content??response;
    if(Array.isArray(content))content=content.map(x=>typeof x==='string'?x:(x?.text||'')).join('');
    return String(content||'').trim();
  };

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

  A.interpretAI=async(q,local)=>{
    if(!window.puter?.ai?.chat)throw new Error('puter_unavailable');
    if(!A.isAISignedIn())throw new Error('puter_not_signed_in');

    const ctx=A.state.context||{};
    const system=[
      'Você interpreta perguntas sobre resultados das Eleições 2026 no Brasil.',
      'NÃO responda a pergunta. NÃO produza números, votos, percentuais, nomes de eleitos ou previsões.',
      'Sua única tarefa é transformar a frase em um plano estruturado.',
      'Retorne SOMENTE um objeto JSON válido, sem markdown, com exatamente estas chaves:',
      '{"intent":"elected|seats|votes|progress|compare|summary|unfinished","office":"president|governor|senator|federalDeputy|stateDeputy|null","ufs":["UF"]}',
      'UF deve ser sigla oficial brasileira em maiúsculas; use BR apenas para Presidência nacional.',
      'Use o contexto anterior apenas quando o usuário fizer continuação, por exemplo "e no DF?", "agora Senado", "e por partido?".',
      'Para pedidos "por partido", "composição", "bancada", use intent seats.',
      'Para eleitos ou quem ganhou, use elected.',
      'Para brancos, nulos, válidos ou comparecimento, use votes; se comparar UFs, use compare.',
      'Para seções, andamento, quanto falta ou totalização, use progress.',
      'Para panorama/resumo de uma UF, use summary.',
      'Para UFs que ainda não terminaram, use unfinished.',
      'Nunca inferir preferência política, nunca prever vencedor e nunca classificar candidatos.'
    ].join(' ');

    const messages=[
      {role:'system',content:system},
      {role:'user',content:`Contexto anterior: ${JSON.stringify({intent:ctx.intent||null,office:ctx.office||null,ufs:ctx.ufs||[],lastUF:A.state.lastUF})}\nPergunta atual: ${q}`}
    ];

    const response=await Promise.race([
      window.puter.ai.chat(messages,{model:'gpt-5-nano',normalize:true}),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('puter_timeout')),10000))
    ]);

    const text=A.aiContent(response);
    const match=text.match(/\{[\s\S]*\}/);
    if(!match)throw new Error('puter_invalid_json');
    return A.normalizePlan(JSON.parse(match[0]),local);
  };

  A.executePlan=async(p,r)=>{
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
    if(['votes','progress','summary','unfinished','compare'].includes(p.i))return p.i!=='compare'||p.us?.length>=2;
    if(['elected','seats'].includes(p.i))return !!p.k||p.i==='seats';
    return false;
  };

  A.aiActivationCard=(r,q)=>{
    const safe=A.esc(q);
    A.reply(r,`<div class="ask-ai-gate"><strong>Essa pergunta se beneficia da IA.</strong><p>Ative a IA grátis para eu interpretar linguagem mais livre. Os resultados continuarão vindo somente do TSE.</p><button type="button" data-ai-activate data-ai-q="${safe}">Ativar IA grátis e responder</button></div>`);
  };

  A.smartRoute=async(q,r,{forceAI=false}={})=>{
    const local=A.localPlan(q);
    const enriched=A.enrichWithContext(local,q);
    let plan=enriched;
    let usedAI=false;
    const wantsAI=forceAI||A.needsAI(q,local);

    if(wantsAI&&A.isAISignedIn()){
      try{
        plan=await A.interpretAI(q,enriched);
        usedAI=true;
      }catch(error){
        console.info('[Eleição 360] IA falhou; usando interpretador local.',error?.message||error);
        plan=enriched;
      }
    }else if(wantsAI&&!A.isAISignedIn()&&!A.canExecuteLocally(enriched)){
      A.aiActivationCard(r,q);
      document.documentElement.dataset.aiLast='needs-auth';
      return 'needs-auth';
    }

    await A.executePlan(plan,r);
    A.rememberPlan(plan,q,usedAI);

    if(usedAI){
      r.insertAdjacentHTML('beforeend','<div class="ask-ai-note">IA interpretou a pergunta • números e situações calculados somente com dados do TSE</div>');
      A.bind?.(r);
      A.E('askSourceStatus').textContent='IA ativa • dados oficiais do TSE';
      document.documentElement.dataset.aiLast='puter';
      return 'ai';
    }

    A.refreshAIStatus();
    document.documentElement.dataset.aiLast='local';
    return 'local';
  };

  A.retryWithAI=async(q,r)=>{
    const ok=await A.activateAI();
    if(!ok)return;
    r.innerHTML='<div class="ask-thinking"><i></i><i></i><i></i></div>';
    try{
      await A.smartRoute(q,r,{forceAI:true});
    }catch(error){
      console.error(error);
      A.reply(r,'<p>Não consegui usar a IA agora. O modo local continua disponível.</p>');
    }
  };

  A.resetAIContext=()=>{A.state.context={intent:null,office:null,ufs:[],turns:[]}};

})(window.E360Ask);
