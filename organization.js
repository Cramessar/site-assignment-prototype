(()=>{
 const A=SiteAppState,S=SiteScheduleLogic;let state=A.load();const $=id=>document.getElementById(id),esc=A.esc;const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 function members(def){return S.allStaff(state).filter(p=>S.operationalShiftId(state,p)===def.id);}
 function render(){
  $('rosterBadge').textContent=`${S.allStaff(state).length} people in prototype`;
  $('orgGrid').innerHTML=S.shiftCatalog(state).filter(def=>def.id!=='unassigned').map(def=>{
    const count=members(def).length,days=new Set((def.activeDays||[]).map(Number));
    return `<article class="org-card"><h3>${esc(def.name)}</h3><div class="supervisor"><strong>${esc(def.supervisorName||'Not assigned')}</strong> • ${esc(def.supervisorTitle||'Shift Supervisor')}</div><div class="org-meta"><span>${count} team member${count===1?'':'s'}</span><span>${def.defaultStart&&def.defaultEnd?`${esc(S.formatTime(def.defaultStart))}–${esc(S.formatTime(def.defaultEnd))}`:'Hours TBD'}</span></div><div class="shift-time-grid"><label>Default start<input type="time" data-org-start="${esc(def.id)}" value="${esc(def.defaultStart||'')}"></label><label>Default end<input type="time" data-org-end="${esc(def.id)}" value="${esc(def.defaultEnd||'')}"></label></div><div class="day-editor"><span>Active days</span><div class="day-toggles">${dayNames.map((name,i)=>`<label class="day-toggle"><input type="checkbox" data-org-day="${esc(def.id)}" value="${i}" ${days.has(i)?'checked':''}><span>${name[0]}</span></label>`).join('')}</div></div><button class="button primary" type="button" data-org-save="${esc(def.id)}">Save shift schedule</button></article>`;
  }).join('');
  const supervisors=S.shiftCatalog(state).filter(d=>d.supervisorTitle==='Shift Supervisor');
  $('leadershipSummary').innerHTML=supervisors.map(d=>`<div><strong>${esc(d.supervisorName)}</strong><span>${esc(d.name)} • reports to Tony</span></div>`).join('')+`<div><strong>Tony Rodriguez</strong><span>Manager</span></div><div><strong>Michael Westfield</strong><span>Manager • Commissioning</span></div>`;
  document.querySelectorAll('[data-org-save]').forEach(btn=>btn.addEventListener('click',()=>saveShift(btn.dataset.orgSave)));
 }
 async function saveShift(id){
  const start=document.querySelector(`[data-org-start="${id}"]`).value,end=document.querySelector(`[data-org-end="${id}"]`).value;
  const days=[...document.querySelectorAll(`[data-org-day="${id}"]:checked`)].map(x=>Number(x.value));
  if(!S.intervalFromTimes(start,end)){alert('Enter a valid start and end time. Overnight shifts are supported.');return;}
  state=A.save(S.setShiftSchedule(state,id,start,end,days));
  const saved=await A.syncShiftDefault(state,id);
  if(!saved)alert('The shift changed in this browser, but the shared database update failed.');
  render();
 }
 async function hydrateAndRender(){
  state=await A.hydrateScheduleData(state);
  render();
 }
 hydrateAndRender();
})();
