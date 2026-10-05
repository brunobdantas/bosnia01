'use strict';

let generator=null;
let transformers=null;
let loading=null;
let currentDevice='wasm';

function send(type,payload={}){self.postMessage({type,...payload})}

async function ensureModel(device){
  if(generator)return generator;
  if(loading)return loading;

  currentDevice=device||'wasm';
  loading=(async()=>{
    send('status',{stage:'library',label:'Carregando motor local…'});
    transformers=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0');

    const {pipeline,env}=transformers;
    env.allowLocalModels=false;
    env.useBrowserCache=true;

    send('status',{stage:'model',label:'Preparando IA local…',progress:0});
    const progress_callback=p=>{
      const raw=Number(p?.progress);
      send('progress',{
        stage:p?.status||'model',
        file:p?.file||'',
        progress:Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):null
      });
    };

    const load=(dtype,device)=>pipeline(
      'text-generation',
      'onnx-community/SmolLM2-135M-Instruct-ONNX',
      {dtype,device,progress_callback}
    );

    if(currentDevice==='webgpu'){
      try{
        generator=await load('q4f16','webgpu');
      }catch(error){
        send('status',{stage:'fallback',label:'Ajustando IA local para este aparelho…'});
        generator=await load('q4','webgpu');
      }
    }else{
      generator=await load('q4','wasm');
    }

    send('ready',{device:currentDevice});
    return generator;
  })().catch(error=>{
    loading=null;
    generator=null;
    send('error',{message:String(error?.message||error)});
    throw error;
  });

  return loading;
}

function extractText(output){
  const generated=output?.[0]?.generated_text;
  if(Array.isArray(generated)){
    const last=[...generated].reverse().find(x=>x?.role==='assistant')||generated.at(-1);
    return String(last?.content||'').trim();
  }
  return String(generated||output?.[0]?.text||'').trim();
}

self.onmessage=async event=>{
  const m=event.data||{};
  try{
    if(m.type==='init'){
      await ensureModel(m.device||'wasm');
      return;
    }
    if(m.type==='infer'){
      const pipe=await ensureModel(m.device||currentDevice||'wasm');
      const output=await pipe(m.messages||[],{
        max_new_tokens:120,
        do_sample:false,
        temperature:0,
        repetition_penalty:1.05
      });
      send('result',{id:m.id,text:extractText(output)});
    }
  }catch(error){
    send('error',{id:m.id||null,message:String(error?.message||error)});
  }
};
