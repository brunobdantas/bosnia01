
function renderStates(filter=''){
  const host=$('stateGrid'),q=filter.trim().toLocaleLowerCase('pt-BR');host.innerHTML='';
  for(const uf of CFG.ufs.filter(u=>!q||u.toLowerCase().includes(q)||UF[u].toLocaleLowerCase('pt-BR').includes(q))){
    const b=document.createElement('button');b.type='button';b.className='state-option'+(scope===uf?' active':'');
    b.innerHTML=`<strong>${uf}</strong><span>${UF[uf]}</span>`;b.addEventListener('click',()=>{closeStateModal();navigateRace(officeKey,uf)});host.appendChild(b);
  }
}
function openStateModal(){$('stateModal').hidden=false;$('stateSearch').value='';renderStates();setTimeout(()=>$('stateSearch').focus(),0)}
function closeStateModal(){$('stateModal').hidden=true}
function renderAll(stale=false){
  if(!data||!selected)return;
  const m=metrics(data,selected);
  renderTabs();renderHeaders();renderFilters();renderCandidates();renderVoteSummary(m);renderLoadMeta(m);renderMath(m);renderComparison();renderHistory();
  if(stale)$('lastUpdate').textContent+=' • cache local';
}
