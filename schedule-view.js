(function (root, factory) {
  const api = factory(root.SiteScheduleLogic || (typeof require === 'function' ? require('./schedule.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SiteScheduleView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  function esc(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function dateFromKey(dateKey){const [y,m,d]=String(dateKey||'').split('-').map(Number);return !y||!m||!d?new Date():new Date(y,m-1,d,12,0,0,0);}
  function addDays(dateKey,amount){const d=dateFromKey(dateKey);d.setDate(d.getDate()+Number(amount||0));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function formatDateLabel(dateKey){return dateFromKey(dateKey).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
  function roleShort(role,title){return title || (role==='tce'?'TCE':role==='tse'?'TSE':role==='tsa'?'TSA':role==='tss'?'TSS':String(role||'').toUpperCase());}
  function personDisplayName(person){return person?.fullName || person?.name || ''}
  function shiftDefForPerson(state,person){return S.shiftDefinition(state,S.operationalShiftId(state,person));}
  function shiftName(state,person){return shiftDefForPerson(state,person)?.name || 'Unassigned';}

  function axisMarks(state){const t=S.timelineRules(state),start=S.timeToMinutes(t.start),end=S.timeToMinutes(t.end),span=Math.max(1,end-start),step=240,marks=[];for(let minute=start;minute<end;minute+=step){const left=((minute-start)/span)*100;const edgeClass=minute===start?' first':'';marks.push(`<i class="schedule-hour${edgeClass}" style="left:${left.toFixed(4)}%"><span>${esc(S.formatTime(S.minutesToTime(minute)))}</span></i>`);}return marks.join('');}
  function overlapZones(state,stats){const t=S.timelineRules(state),start=S.timeToMinutes(t.start),end=S.timeToMinutes(t.end),span=Math.max(1,end-start);return stats.mergedOverlap.map(s=>{const left=((Math.max(start,s.start)-start)/span)*100,width=((Math.min(end,s.end)-Math.max(start,s.start))/span)*100;return width<=0?'':`<i class="schedule-overlap-zone" style="left:${left.toFixed(4)}%;width:${width.toFixed(4)}%" title="Weekend Day / Weekend Mid coverage overlap"></i>`}).join('');}
  function overlapLabel(stats){if(!stats.mergedOverlap.length)return{value:'None',sub:'No Weekend Day / Weekend Mid overlap',tone:'warn'};const windows=stats.mergedOverlap.map(s=>`${S.formatTime(S.minutesToTime(s.start))}–${S.formatTime(S.minutesToTime(s.end))}`);return{value:windows.join(', '),sub:`${S.formatDuration(stats.overlapMinutes)} current coverage-team overlap`,tone:'good'};}
  function summaryHTML(state,dateKey){const stats=S.dayStats(state,dateKey),overlap=overlapLabel(stats),configured=S.shiftCatalog(state).filter(s=>s.defaultStart&&s.defaultEnd).length,totalShifts=S.shiftCatalog(state).filter(s=>s.id!=='unassigned').length;const card=(l,v,sub,t='')=>`<div class="schedule-summary-card ${t}"><span>${esc(l)}</span><strong>${esc(v)}</strong><small>${esc(sub)}</small></div>`;return[
    card('Coverage-team overlap',overlap.value,overlap.sub,overlap.tone),
    card('People scheduled',String(stats.activeCount),`${stats.totalHours.toFixed(stats.totalHours%1?1:0)} total scheduled hours`),
    card('Shift defaults',`${configured}/${totalShifts}`,configured<totalShifts?'Some shift hours still need configuration':'All shift hours configured',configured<totalShifts?'warn':'good'),
    card('Daily exceptions',String(stats.exceptions),stats.exceptions?'Custom hours / status / off':'Everyone on shift defaults',stats.exceptions?'warn':'')
  ].join('');}

  function editorHTML(person,shift,vacation){
    if(vacation)return `<div class="schedule-duration"><strong class="schedule-vacation">Vacation</strong><small>Assignments redistributed where configured</small></div>`;
    if((shift.segments||[]).length>1){
      return `<div class="schedule-inline-editor split-recurring"><div class="schedule-duration"><strong>${esc(S.shiftTimeLabel(shift))}</strong><small>Recurring split schedule • use an exception to replace this day</small></div><button type="button" data-schedule-off="${esc(person.id)}">Off</button><button type="button" data-schedule-reset="${esc(person.id)}">Reset</button></div>`;
    }
    const disabled=shift.off?'disabled':'',start=shift.off?'':(shift.start||''),end=shift.off?'':(shift.end||''),status=shift.coverageStatus||'working';
    return `<div class="schedule-inline-editor" data-schedule-editor="${esc(person.id)}">
      <label><span>Start</span><input type="time" value="${esc(start)}" data-schedule-start="${esc(person.id)}" ${disabled}></label>
      <label><span>End</span><input type="time" value="${esc(end)}" data-schedule-end="${esc(person.id)}" ${disabled}></label>
      <label class="schedule-status-control"><span>Status</span><select data-schedule-status="${esc(person.id)}" ${disabled}><option value="working" ${status==='working'?'selected':''}>Working</option><option value="vacation" ${status==='vacation'?'selected':''}>Vacation</option><option value="training" ${status==='training'?'selected':''}>Training</option><option value="meeting" ${status==='meeting'?'selected':''}>Meeting</option><option value="unavailable" ${status==='unavailable'?'selected':''}>Unavailable</option></select></label>
      <button type="button" data-schedule-off="${esc(person.id)}" class="${shift.off?'active':''}">${shift.off?'Restore':'Off'}</button><button type="button" data-schedule-reset="${esc(person.id)}">Reset</button>
    </div>`;
  }
  function publicDurationHTML(state,person,shift,dateKey){if(shift.vacation)return `<div class="schedule-duration"><strong class="schedule-vacation">Vacation</strong><small>Not scheduled</small></div>`;if(shift.inactiveShift)return `<div class="schedule-duration"><strong>Inactive</strong><small>Shift not active for this day</small></div>`;if(shift.off)return `<div class="schedule-duration"><strong>Off</strong><small>Not scheduled</small>${S.rawOverride(state,person.id,dateKey)?'<span class="schedule-exception">Exception</span>':''}</div>`;if(shift.unconfigured)return `<div class="schedule-duration"><strong>Hours TBD</strong><small>Shift default not configured</small></div>`;const status=shift.coverageStatus||'working',statusLabel=status==='working'?'':`<span class="schedule-exception">${esc(status[0].toUpperCase()+status.slice(1))}</span>`;return `<div class="schedule-duration"><strong>${esc(S.formatDuration(shift.durationMinutes))}</strong><small>${esc(S.shiftTimeLabel(shift))}</small>${statusLabel||(S.rawOverride(state,person.id,dateKey)?'<span class="schedule-exception">Exception</span>':'')}</div>`;}

  function rowHTML(state,person,dateKey,stats,options){
    const shift=S.getShift(state,person.id,dateKey),positions=S.barPositions(state,shift),selected=options.selectedPersonId===person.id?'selected':'',group=S.coverageGroup(person),tsa=person.role==='tsa'?'tsa':'',supervisor=S.isShiftSupervisor(state,person)?'supervisor':'';
    let track=overlapZones(state,stats);
    if(positions.length){
      const segments=(shift.segments||[]).length?shift.segments:[{start:shift.start,end:shift.end}];
      const statusClass=shift.coverageStatus&&shift.coverageStatus!=='working'?'noncoverage':'';
      positions.forEach((pos,index)=>{
        const segment=segments[index]||segments[0],label=`${S.formatTime(segment.start)}–${S.formatTime(segment.end)}`;
        track+=`<div class="schedule-bar ${group==='mid'?'mid':group==='morning'?'morning':'other'} ${tsa} ${statusClass}" style="left:${pos.leftPct.toFixed(4)}%;width:${pos.widthPct.toFixed(4)}%" title="${esc(personDisplayName(person))} • ${esc(label)}">${esc(label)}</div>`;
      });
    }else track+=`<div class="schedule-off-bar">${shift.vacation?'Vacation':shift.inactiveShift?'Inactive today':shift.recurringOff?'Not scheduled today':shift.off?'Off':shift.unconfigured?'Hours not configured':'Off'}</div>`;
    const right=options.editable?editorHTML(person,shift,person.vacation):publicDurationHTML(state,person,shift,dateKey),manager=person.manager?` • Mgr ${person.manager}`:'',supervisorChip=supervisor?` • Shift supervisor`:'';
    return `<div class="schedule-row ${selected} ${supervisor}" data-schedule-person="${esc(person.id)}"><div class="schedule-person"><div class="schedule-person-head"><strong>${esc(personDisplayName(person))}</strong></div><small>${esc(roleShort(person.role,person.title))}${esc(manager)}${esc(supervisorChip)}</small></div><div class="schedule-track">${track}</div>${right}</div>`;
  }

  function groupPeople(state,shiftId){return S.allStaff(state).filter(p=>S.operationalShiftId(state,p)===shiftId).sort((a,b)=>{const sa=S.isShiftSupervisor(state,a)||a.role==='tss'||a.role==='manager'||a.role==='supervisor'?-1:a.role==='tsa'?1:0,sb=S.isShiftSupervisor(state,b)||b.role==='tss'||b.role==='manager'||b.role==='supervisor'?-1:b.role==='tsa'?1:0;return sa-sb||personDisplayName(a).localeCompare(personDisplayName(b));});}
  function boardHTML(state,dateKey,options={}){const stats=S.dayStats(state,dateKey),axisRight=options.editable?'Shift controls':'Duration',axis=`<div class="schedule-axis"><div class="schedule-axis-label">Team member</div><div class="schedule-axis-track">${axisMarks(state)}</div><div class="schedule-axis-label schedule-axis-duration" style="text-align:right">${esc(axisRight)}</div></div>`;const visible=new Set(S.visibleShiftIds(state,dateKey));const groups=S.shiftCatalog(state).filter(def=>visible.has(def.id)).map(def=>{const people=groupPeople(state,def.id);if(!people.length)return'';const hours=def.defaultStart&&def.defaultEnd?`Default ${S.formatTime(def.defaultStart)}–${S.formatTime(def.defaultEnd)}`:'Default hours not configured';return `<div class="schedule-group shift-group-v7"><strong>${esc(def.name)}</strong><span>${esc(hours)} • Supervisor: ${esc(def.supervisorName||'Not assigned')} • ${people.length} people</span></div>${people.map(p=>rowHTML(state,p,dateKey,stats,options)).join('')}`;}).join('');return `<div class="schedule-board-scroll"><div class="schedule-board-inner ${options.editable?'editable':''}">${axis}${groups}</div></div>`;}

  function personScheduleHTML(state,personId,dateKey){const person=S.staffById(state,personId);if(!person)return'';const shift=S.getShift(state,personId,dateKey),def=shiftDefForPerson(state,person);if(shift.vacation)return `<div class="schedule-person-mini"><strong>Vacation</strong><span>${esc(formatDateLabel(dateKey))} • ${esc(def?.name||'Unassigned')}</span></div>`;if(shift.inactiveShift)return `<div class="schedule-person-mini"><strong>Inactive for selected day</strong><span>${esc(formatDateLabel(dateKey))} • ${esc(def?.name||'Unassigned')}</span></div>`;if(shift.off)return `<div class="schedule-person-mini"><strong>Not scheduled</strong><span>${esc(formatDateLabel(dateKey))} • ${esc(def?.name||'Unassigned')}</span></div>`;if(shift.unconfigured)return `<div class="schedule-person-mini"><strong>Default hours not configured</strong><span>${esc(def?.name||'Unassigned')} • Supervisor ${esc(def?.supervisorName||'Not assigned')}</span></div>`;const overlaps=S.overlapsForPerson(state,personId,dateKey).filter(x=>S.operationalShiftId(state,x.person)!==S.operationalShiftId(state,person)),pills=overlaps.slice(0,8).map(x=>`<span class="schedule-overlap-pill">${esc(personDisplayName(x.person))} • ${esc(S.formatDuration(x.minutes))}</span>`).join('');return `<div class="schedule-person-mini"><strong>${esc(S.shiftTimeLabel(shift))} • ${esc(S.formatDuration(shift.durationMinutes))}</strong><span>${esc(formatDateLabel(dateKey))} • ${esc(def?.name||'Unassigned')}${S.rawOverride(state,personId,dateKey)?' • adjusted shift':''}</span></div>${pills?`<div class="schedule-overlap-list">${pills}</div>`:''}`;}

  return {todayKey,addDays,formatDateLabel,roleShort,personDisplayName,shiftName,summaryHTML,boardHTML,personScheduleHTML};
});
