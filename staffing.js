(()=>{
 const A=SiteAppState,S=SiteScheduleLogic,V=SiteScheduleView;let state=A.load(),dateKey=A.todayKey();const $=id=>document.getElementById(id);

 async function persist(next,personId){
  state=A.save(next);
  render();
  if(personId)await A.syncScheduleException(state,personId,dateKey);
 }

 function render(){
  $('scheduleDate').value=dateKey;
  $('scheduleSummary').innerHTML=V.summaryHTML(state,dateKey);
  $('scheduleBoard').innerHTML=V.boardHTML(state,dateKey,{editable:true});
  wire();
 }

 async function hydrateAndRender(){
  const dates=A.weekDateKeys(dateKey);
  state=await A.hydrateScheduleData(state,dates[0],dates[dates.length-1]);
  render();
 }

 function wire(){
  document.querySelectorAll('[data-schedule-start],[data-schedule-end]').forEach(input=>input.addEventListener('change',()=>{
   const id=input.dataset.scheduleStart||input.dataset.scheduleEnd;
   const box=document.querySelector(`[data-schedule-editor="${id}"]`);
   const start=box?.querySelector(`[data-schedule-start="${id}"]`)?.value;
   const end=box?.querySelector(`[data-schedule-end="${id}"]`)?.value;
   if(S.intervalFromTimes(start,end))persist(S.setShift(state,id,dateKey,start,end),id);
  }));

  document.querySelectorAll('[data-schedule-status]').forEach(sel=>sel.addEventListener('change',()=>{
   const id=sel.dataset.scheduleStatus;
   persist(S.setCoverageStatus(state,id,dateKey,sel.value),id);
  }));

  document.querySelectorAll('[data-schedule-off]').forEach(btn=>btn.addEventListener('click',()=>{
   const id=btn.dataset.scheduleOff,shift=S.getShift(state,id,dateKey);
   persist(S.setOff(state,id,dateKey,!shift.off),id);
  }));

  document.querySelectorAll('[data-schedule-reset]').forEach(btn=>btn.addEventListener('click',()=>{
   const id=btn.dataset.scheduleReset;
   persist(S.clearOverride(state,id,dateKey),id);
  }));
 }

 function move(n){dateKey=V.addDays(dateKey,n);hydrateAndRender();}
 $('prevDay').addEventListener('click',()=>move(-1));
 $('nextDay').addEventListener('click',()=>move(1));
 $('todayBtn').addEventListener('click',()=>{dateKey=A.todayKey();hydrateAndRender();});
 $('resetDayBtn').addEventListener('click',async()=>{
  const ids=Object.keys(state.scheduleOverrides?.[dateKey]||{});
  state=A.save(S.clearDay(state,dateKey));
  render();
  await Promise.all(ids.map(id=>A.syncScheduleException(state,id,dateKey)));
 });
 $('scheduleDate').addEventListener('change',e=>{if(S.isDateKey(e.target.value)){dateKey=e.target.value;hydrateAndRender();}});
 hydrateAndRender();
})();
