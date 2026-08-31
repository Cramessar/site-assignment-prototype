(()=>{
 const A=SiteAppState,S=SiteScheduleLogic,V=SiteScheduleView,L=SiteCoverageLogic;let state=A.load(),dateKey=A.todayKey();const $=id=>document.getElementById(id);
 function persist(next){state=A.save(next);render();}
 function setVacation(personId,vacation){
  if((state.people||[]).some(p=>p.id===personId))return L.setVacation(state,personId,vacation);
  if((state.supportAdmins||[]).some(p=>p.id===personId))return L.setTsaVacation(state,personId,vacation);
  const next=S.clone(state),person=(next.directoryPeople||[]).find(p=>p.id===personId);
  if(person)person.vacation=vacation;
  return next;
 }
 function render(){$('scheduleDate').value=dateKey;$('scheduleSummary').innerHTML=V.summaryHTML(state,dateKey);$('scheduleBoard').innerHTML=V.boardHTML(state,dateKey,{editable:true});wire();}
 function wire(){
  document.querySelectorAll('[data-schedule-start],[data-schedule-end]').forEach(input=>input.addEventListener('change',()=>{const id=input.dataset.scheduleStart||input.dataset.scheduleEnd;const box=document.querySelector(`[data-schedule-editor="${id}"]`);const start=box?.querySelector(`[data-schedule-start="${id}"]`)?.value,end=box?.querySelector(`[data-schedule-end="${id}"]`)?.value;if(S.intervalFromTimes(start,end))persist(S.setShift(state,id,dateKey,start,end));}));
  document.querySelectorAll('[data-schedule-status]').forEach(sel=>sel.addEventListener('change',()=>persist(S.setCoverageStatus(state,sel.dataset.scheduleStatus,dateKey,sel.value))));
  document.querySelectorAll('[data-schedule-off]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.scheduleOff,shift=S.getShift(state,id,dateKey);persist(S.setOff(state,id,dateKey,!shift.off));}));
  document.querySelectorAll('[data-schedule-reset]').forEach(btn=>btn.addEventListener('click',()=>persist(S.clearOverride(state,btn.dataset.scheduleReset,dateKey))));
  document.querySelectorAll('[data-schedule-vacation]').forEach(btn=>btn.addEventListener('click',()=>{
   const id=btn.dataset.scheduleVacation,person=S.staffById(state,id);if(!person)return;
   const nextVacation=!person.vacation;
   if(nextVacation&&!confirm(`Mark ${person.fullName||person.name} on vacation? Weekly coverage plans that include this person will need to be regenerated before publishing.`))return;
   persist(setVacation(id,nextVacation));
  }));
 }
 function move(n){dateKey=V.addDays(dateKey,n);render();}
 $('prevDay').addEventListener('click',()=>move(-1));$('nextDay').addEventListener('click',()=>move(1));$('todayBtn').addEventListener('click',()=>{dateKey=A.todayKey();render();});$('resetDayBtn').addEventListener('click',()=>persist(S.clearDay(state,dateKey)));$('scheduleDate').addEventListener('change',e=>{if(S.isDateKey(e.target.value)){dateKey=e.target.value;render();}});render();
})();
