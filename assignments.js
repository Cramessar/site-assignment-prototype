(()=>{
 const A=SiteAppState,C=MultiShiftCoverage,S=SiteScheduleLogic,V=WeeklyAssignmentView;
 let state=A.load(),dateKey=A.todayKey(),selectedKey='';
 const $=id=>document.getElementById(id),esc=A.esc;
 function planChoices(){return C.weeklyPlansForDate(state,dateKey);}
 function currentPlan(){const plans=planChoices();return plans.find(p=>p.periodKey===selectedKey)||plans[0]||null;}
 function renderSummary(plan){
   const cards=plan?[
    ['Operational week',A.fmtRange(plan.periodStart,plan.periodEnd),(plan.periodDates||[]).length+' scheduled calendar days'],
    ['Coverage shifts',(plan.selectedShiftIds||[]).map(id=>S.shiftDefinition(state,id)?.name||id).join(' + '),(plan.windows||[]).length+' coverage windows'],
    ['Sites','38','ticket-weighted assignments'],
    ['Published',plan.publishedAt?new Date(plan.publishedAt).toLocaleDateString():'Preview','weekly source of truth']
   ]:[['Operational week','No published plan','Choose a date covered by a published assignment week'],['Coverage shifts','—','—'],['Sites','38','waiting for publication'],['Published','—','—']];
   $('weekSummary').innerHTML=cards.map(([l,v,s])=>`<div class="summary-card"><span>${esc(l)}</span><strong>${esc(v)}</strong><small>${esc(s)}</small></div>`).join('');
 }
 function render(){
   $('assignmentDate').value=dateKey;
   const plans=planChoices();
   $('planSelect').innerHTML=plans.length?plans.map(p=>`<option value="${esc(p.periodKey)}">${esc((p.selectedShiftIds||[]).map(id=>S.shiftDefinition(state,id)?.name||id).join(' + '))} • ${esc(A.fmtRange(p.periodStart,p.periodEnd))}</option>`).join(''):'<option value="">No published plan for this date</option>';
   const plan=currentPlan();if(plan)$('planSelect').value=plan.periodKey;
   $('outBanner').innerHTML=A.outBannerHTML(state,dateKey,{dates:plan?.periodDates||A.weekDateKeys(dateKey),shiftIds:plan?.selectedShiftIds||[]});
   renderSummary(plan);
   if(!plan){$('assignmentStatus').className='badge warning';$('assignmentStatus').textContent='No published week';$('assignmentTitle').textContent='Site assignments';$('assignmentSubtitle').textContent='A supervisor can generate and publish a weekly plan from Supervisor Builder.';$('assignmentLegend').innerHTML='';$('assignmentTable').innerHTML='<div class="empty-panel"><strong>No weekly site assignment has been published for this date.</strong><span>Use Supervisor Builder to create one.</span></div>';$('handoffStrip').innerHTML='';return;}
   const effective=C.effectiveWeeklyPlan(state,plan,dateKey);
   const stale=C.weeklyPlanStale(state,plan);
   const adjusted=Boolean(effective?.dailyAdjusted);
   $('assignmentStatus').className=`badge ${stale||adjusted?'warning':'success'}`;
   $('assignmentStatus').textContent=adjusted?'Published • daily coverage adjusted':stale?'Published • weekly refresh needed':'Published';
   $('assignmentTitle').textContent=(plan.selectedShiftIds||[]).map(id=>S.shiftDefinition(state,id)?.name||id).join(' + ');
   $('assignmentSubtitle').textContent=adjusted
     ? `Operational week ${A.fmtRange(plan.periodStart,plan.periodEnd)}. Non-working staffing statuses for ${new Date(dateKey+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'})} have been redistributed automatically.`
     : `Operational week ${A.fmtRange(plan.periodStart,plan.periodEnd)}. Base site ownership remains consistent across the week.`;
   $('assignmentLegend').innerHTML=V.legend();$('assignmentTable').innerHTML=V.table(state,effective);$('handoffStrip').innerHTML=V.handoffStrip(state,effective);
 }
 async function hydrateAndRender(){
   const dates=A.weekDateKeys(dateKey);
   state=await A.hydrateScheduleData(state,dates[0],dates[dates.length-1]);
   state=await A.hydratePublishedAssignments(state,dateKey);
   state=A.save(state);
   render();
 }
 $('assignmentDate').addEventListener('change',e=>{dateKey=e.target.value||dateKey;selectedKey='';hydrateAndRender();});
 $('planSelect').addEventListener('change',e=>{selectedKey=e.target.value;render();});
 window.addEventListener('storage',()=>{state=A.load();hydrateAndRender();});
 hydrateAndRender();
 setInterval(hydrateAndRender,60000);
})();
