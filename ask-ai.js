'use strict';

(A=>{
  const intents=new Set(['elected','seats','votes','progress','compare','summary','unfinished']);
  const offices=new Set(['president','governor','senator','federalDeputy','stateDeputy']);
  const ufSet=new Set(['BR',...CFG.ufs]);

  A.state.context=A.state.context||{intent:null,office:null,ufs:[],turns:[]};

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

  A.aiContent=response=>{
    let content=response?.message?.content??response?.content??response;
    if(Array.isArray(content)){
      content=content.map(x=>typeof x==='string'?x:(x?.text||'')).join('');
    }
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
    return{
      q:local.q,
      n:local.n,
      i,
      k,
      us:[...new Set(mergedUfs)].slice(0,4)
    };
  };

  A.interpretAI=async(q,local)=>{
    if(!window.puter?.ai?.chat)throw new Error('puter_unavailable');

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

    const context={
      intent:ctx.intent||null,
      office:ctx.office||null,
      ufs:ctx.ufs||[],
      lastUF:A.state.lastUF
    };

    const messages=[
      {role:'system',content:system},
      {role:'user',content:`Contexto anterior: ${JSON.stringify(context)}\nPergunta atual: ${q}`}
    ];

    const call=window.puter.ai.chat(messages,{normalize:true});
    const response=await Promise.race([
      call,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('puter_timeout')),9000))
    ]);

    const text=A.aiContent(response);
    const match=text.match(/\{[\s\S]*\}/);
    if(!match)throw new Error('puter_invalid_json');
    const raw=JSON.parse(match[0]);
    return A.normalizePlan(raw,local);
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

  A.smartRoute=async(q,r)=>{
    const local=A.localPlan(q);
    const enriched=A.enrichWithContext(local,q);
    let plan=enriched;
    let usedAI=false;

    if(A.needsAI(q,local)){
      try{
        const aiPlan=await A.interpretAI(q,enriched);
        plan=aiPlan;
        usedAI=true;
      }catch(error){
        console.info('[Eleição 360] IA indisponível; usando interpretador local.',error?.message||error);
        plan=enriched;
      }
    }

    await A.executePlan(plan,r);
    A.rememberPlan(plan,q,usedAI);

    if(usedAI){
      r.insertAdjacentHTML('beforeend','<div class="ask-ai-note">IA interpretou a pergunta • números e situações calculados somente com dados do TSE</div>');
      A.E('askSourceStatus').textContent='IA + dados oficiais do TSE';
      document.documentElement.dataset.aiLast='puter';
      return 'ai';
    }

    A.E('askSourceStatus').textContent=window.puter?.ai?.chat?'IA híbrida • dados oficiais do TSE':'Modo local • dados oficiais do TSE';
    document.documentElement.dataset.aiLast='local';
    return 'local';
  };

  A.resetAIContext=()=>{
    A.state.context={intent:null,office:null,ufs:[],turns:[]};
  };

  A.refreshAIStatus=()=>{
    const ok=!!window.puter?.ai?.chat;
    document.documentElement.dataset.aiProvider=ok?'puter':'fallback';
    const node=A.E('askSourceStatus');
    if(node)node.textContent=ok?'IA híbrida • dados oficiais do TSE':'Modo local • dados oficiais do TSE';
  };
})(window.E360Ask);
