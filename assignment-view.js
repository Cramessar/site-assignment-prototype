(function(root){
  const S=root.SiteScheduleLogic, C=root.MultiShiftCoverage, A=root.SiteAppState;
  const esc=v=>A.esc(v);
  function staff(state,id){return S.staffById(state,id);}
  function shortTime(minutes){const f=S.formatTime(S.minutesToTime(minutes));return f.replace(':00 ','').replace(' AM','a').replace(' PM','p');}
  function windowLabel(w){return `${shortTime(w.start)}–${shortTime(w.end)}`;}
  function siteChip(state,plan,personId,siteId,index){
    const prev=index>0?plan.windows[index-1]?.siteOwners?.[siteId]:null;
    const next=index<plan.windows.length-1?plan.windows[index+1]?.siteOwners?.[siteId]:null;
    const incoming=index>0&&prev!==personId;
    const outgoing=index<plan.windows.length-1&&next!==personId;
    const site=(state.sites||[]).find(s=>s.id===siteId);
    const cls=incoming&&outgoing?' transfer':incoming?' incoming':outgoing?' outgoing':'';
    const title=[`${siteId} • ${site?.tickets30||0} tickets / 30d`,incoming?`Takes over from ${staff(state,prev)?.name||'coverage pool'}`:'',outgoing?`Hands off to ${staff(state,next)?.name||'coverage pool'}`:''].filter(Boolean).join(' • ');
    return `<span class="assignment-site-chip${cls}" title="${esc(title)}">${esc(siteId)}</span>`;
  }
  function tsaSummary(state,plan,personId){
    const parts=[];let last=null;
    (plan.windows||[]).forEach(w=>{
      if(!(w.activeEngineers||[]).includes(personId))return;
      const admin=w.tsaByEngineer?.[personId]||null;
      if(admin===last&&parts.length){parts[parts.length-1].end=w.end;return;}
      parts.push({admin,start:w.start,end:w.end});last=admin;
    });
    if(!parts.length)return '<span class="assignment-muted">—</span>';
    return parts.map(p=>`<div class="assignment-tsa-line"><strong>${esc(staff(state,p.admin)?.name||'Uncovered')}</strong><small>${esc(windowLabel(p))}</small></div>`).join('');
  }
  function row(state,plan,person){
    const dateKey=plan?.effectiveDate||plan?.dateKey||plan?.templateDate;
    const dailyShift=dateKey?S.getShift(state,person.id,dateKey):null;
    const status=dailyShift?.coverageStatus||'working';
    const statusLabel=person.vacation?'Vacation':dailyShift?.off?'Off':status!=='working'?(status.charAt(0).toUpperCase()+status.slice(1)):null;
    const cells=(plan.windows||[]).map((w,index)=>{
      if(statusLabel)return `<td class="assignment-window-cell vacation"><span>${esc(statusLabel)}</span></td>`;
      if(!(w.activeEngineers||[]).includes(person.id))return `<td class="assignment-window-cell inactive"><span>—</span></td>`;
      const ids=w.personSites?.[person.id]||[];
      const load=w.personLoads?.[person.id]||0;
      return `<td class="assignment-window-cell"><div class="assignment-sites">${ids.map(id=>siteChip(state,plan,person.id,id,index)).join('')}</div><small class="assignment-load">${ids.length} sites • ${load} ticket weight</small></td>`;
    }).join('');
    return `<tr data-person="${esc(person.id)}"><th scope="row"><strong>${esc(person.fullName||person.name)}</strong><small>${esc(person.title||String(person.role||'').toUpperCase())}</small></th>${cells}<td class="assignment-tsa-cell">${statusLabel?`<span class="assignment-muted">${esc(statusLabel)}</span>`:tsaSummary(state,plan,person.id)}</td></tr>`;
  }
  function table(state,plan,options={}){
    if(!plan?.windows?.length)return '<div class="empty-panel"><strong>No assignment plan published.</strong><span>A supervisor can generate and publish an operational-week plan.</span></div>';
    const selected=plan.selectedShiftIds||[];
    const groups=selected.map(shiftId=>{
      const def=S.shiftDefinition(state,shiftId);
      const people=C.engineersForShift(state,shiftId).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
      return {shiftId,def,people};
    }).filter(g=>g.people.length);
    const headers=(plan.windows||[]).map(w=>`<th><span>${esc(windowLabel(w))}</span><small>${esc((w.activeShiftIds||[]).map(id=>S.shiftDefinition(state,id)?.name||id).join(' + '))}</small></th>`).join('');
    const body=groups.map(g=>`<tr class="assignment-shift-band"><th colspan="${(plan.windows||[]).length+2}"><strong>${esc(g.def?.name||g.shiftId)}</strong><span>Supervisor: ${esc(g.def?.supervisorName||'Not assigned')}</span></th></tr>${g.people.map(p=>row(state,plan,p)).join('')}`).join('');
    return `<div class="assignment-table-scroll"><table class="assignment-table"><thead><tr><th class="assignment-person-col">Team member</th>${headers}<th class="assignment-tsa-col">TSA support</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function legend(){return `<div class="assignment-legend"><span><i class="legend-chip"></i> stays with owner</span><span><i class="legend-chip outgoing"></i> hands off next</span><span><i class="legend-chip incoming"></i> takes over</span></div>`;}
  function handoffStrip(state,plan){
    const hs=C.handoffs(state,plan);if(!hs.length)return '<div class="handoff-strip quiet"><strong>No site handoffs</strong><span>Ownership remains stable through the selected shifts.</span></div>';
    return `<div class="handoff-strip">${hs.map(h=>{const count=h.siteGroups.reduce((s,g)=>s+g.sites.length,0);return `<div><strong>${esc(shortTime(h.at))}</strong><span>${count} site handoff${count===1?'':'s'} • ${h.tsaChanges.length} TSA change${h.tsaChanges.length===1?'':'s'}</span></div>`;}).join('')}</div>`;
  }
  root.WeeklyAssignmentView={table,legend,handoffStrip,windowLabel,shortTime};
})(typeof globalThis!=='undefined'?globalThis:this);
