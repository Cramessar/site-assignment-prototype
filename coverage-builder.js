(function (root, factory) {
  const api = factory(
    root.SiteCoverageLogic || (typeof require === 'function' ? require('./logic.js') : null),
    root.SiteScheduleLogic || (typeof require === 'function' ? require('./schedule.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MultiShiftCoverage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, S) {
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function siteById(state,id){ return (state.sites||[]).find(s=>s.id===id)||null; }
  function staffById(state,id){ return S.staffById(state,id); }
  function tickets(state,siteId){ return Number(siteById(state,siteId)?.tickets30)||0; }
  function isEngineer(person){ return person?.role === 'tce' || person?.role === 'tse'; }
  function isTsa(person){ return person?.role === 'tsa'; }
  function shiftId(state,person){ return S.operationalShiftId(state,person); }
  function shiftName(state,id){ return S.shiftDefinition(state,id)?.name || id; }

  function assignmentLocks(state){
    const configured=state?.rules?.assignmentLocks;
    const fallback=state?.rules?.lockedMorningAssignments||[];
    const raw=Array.isArray(configured)&&configured.length?configured:fallback;
    return raw.map((x,i)=>({id:x.id||`lock-${i}-${x.personId}-${x.siteId}`,personId:x.personId,siteId:x.siteId}));
  }

  function engineersForShift(state, shiftIdValue){
    return S.allStaff(state).filter(p=>isEngineer(p)&&shiftId(state,p)===shiftIdValue);
  }
  function tsasForShift(state, shiftIdValue){
    return S.allStaff(state).filter(p=>isTsa(p)&&shiftId(state,p)===shiftIdValue);
  }
  function eligibleShifts(state,dateKey){
    return S.shiftCatalog(state).map(def=>{
      const engineers=engineersForShift(state,def.id), tsas=tsasForShift(state,def.id);
      return {def,engineers,tsas,active:S.shiftActiveOnDate(state,def.id,dateKey),assignable:engineers.length>0};
    });
  }

  function selectedPeople(state,shiftIds,roleCheck){
    const selected=new Set(shiftIds||[]);
    return S.allStaff(state).filter(p=>selected.has(shiftId(state,p))&&roleCheck(p));
  }

  function activeIds(state,dateKey,start,end,shiftIds,roleCheck){
    return selectedPeople(state,shiftIds,roleCheck).filter(person=>{
      const interval=S.intervalForCoverage(S.getShift(state,person.id,dateKey));
      return interval&&interval.start<=start&&interval.end>=end;
    }).map(p=>p.id);
  }

  function planRange(state,dateKey,shiftIds){
    const participants=[...selectedPeople(state,shiftIds,isEngineer),...selectedPeople(state,shiftIds,isTsa)];
    const intervals=participants.map(p=>S.intervalForShift(S.getShift(state,p.id,dateKey))).filter(Boolean);
    if(!intervals.length)return null;
    return {start:Math.min(...intervals.map(i=>i.start)),end:Math.max(...intervals.map(i=>i.end))};
  }

  function windowsForDate(state,dateKey,shiftIds){
    const range=planRange(state,dateKey,shiftIds);
    if(!range)return[];
    const boundaries=new Set([range.start,range.end]);
    const participants=[...selectedPeople(state,shiftIds,isEngineer),...selectedPeople(state,shiftIds,isTsa)];
    participants.forEach(person=>{
      const interval=S.intervalForShift(S.getShift(state,person.id,dateKey));
      if(!interval)return;
      if(interval.end<=range.start||interval.start>=range.end)return;
      boundaries.add(Math.max(range.start,interval.start));
      boundaries.add(Math.min(range.end,interval.end));
    });
    const points=[...boundaries].sort((a,b)=>a-b), out=[];
    for(let i=0;i<points.length-1;i+=1){if(points[i+1]>points[i])out.push({start:points[i],end:points[i+1]});}
    return out;
  }

  function shiftShares(state,activeEngineerIds){
    const groups={};
    activeEngineerIds.forEach(id=>{const p=staffById(state,id),sid=shiftId(state,p);(groups[sid]||(groups[sid]=[])).push(id);});
    const ids=Object.keys(groups);
    if(!ids.length)return {groups,shares:{}};
    const shares={};
    if(ids.length===2&&ids.includes('weekend-day')&&ids.includes('weekend-mid')){
      const rules=L.rules(state);
      shares['weekend-day']=Number(rules.overlapMorningTarget)||0.6;
      shares['weekend-mid']=Number(rules.overlapMidTarget)||0.4;
    }else{
      const total=activeEngineerIds.length;
      ids.forEach(id=>shares[id]=groups[id].length/total);
    }
    return {groups,shares};
  }

  function assignSites(state,activeEngineerIds){
    const personSites=Object.fromEntries(activeEngineerIds.map(id=>[id,[]]));
    const personLoads=Object.fromEntries(activeEngineerIds.map(id=>[id,0]));
    const siteOwners={};
    const lockedSites=[];
    if(!activeEngineerIds.length)return {siteOwners,personSites,personLoads,shiftLoads:{},lockedSites};

    const {groups,shares}=shiftShares(state,activeEngineerIds);
    const total=L.totalTickets(state)||1;
    const targets={};
    Object.entries(groups).forEach(([sid,ids])=>ids.forEach(id=>{targets[id]=Math.max(1,total*(shares[sid]||0)/ids.length);}));
    const activeSet=new Set(activeEngineerIds);
    const lockMap=new Map();
    assignmentLocks(state).forEach(lock=>{if(activeSet.has(lock.personId))lockMap.set(lock.siteId,lock.personId);});
    const free=[];
    (state.sites||[]).forEach(site=>{
      const lockedOwner=lockMap.get(site.id);
      if(lockedOwner){
        personSites[lockedOwner].push(site.id);personLoads[lockedOwner]+=Number(site.tickets30)||0;siteOwners[site.id]=lockedOwner;lockedSites.push(site.id);
      }else free.push(site);
    });
    free.sort((a,b)=>(Number(b.tickets30)||0)-(Number(a.tickets30)||0)||a.id.localeCompare(b.id));
    free.forEach(site=>{
      const weight=Number(site.tickets30)||0;
      const owner=activeEngineerIds.slice().sort((a,b)=>{
        const ar=(personLoads[a]+weight)/(targets[a]||1), br=(personLoads[b]+weight)/(targets[b]||1);
        return (ar-br)||((personLoads[a]/(targets[a]||1))-(personLoads[b]/(targets[b]||1)))||(personSites[a].length-personSites[b].length)||a.localeCompare(b);
      })[0];
      personSites[owner].push(site.id);personLoads[owner]+=weight;siteOwners[site.id]=owner;
    });
    const shiftLoads={};
    activeEngineerIds.forEach(id=>{const sid=shiftId(state,staffById(state,id));shiftLoads[sid]=(shiftLoads[sid]||0)+personLoads[id];});
    return {siteOwners,personSites,personLoads,shiftLoads,lockedSites};
  }

  function existingTsaPreference(state,engineerId){
    for(const [adminId,engineers] of Object.entries(state.tsaAssignments||{})){if((engineers||[]).includes(engineerId))return adminId;}
    return null;
  }

  function assignTsas(state,activeEngineerIds,activeAdminIds,personLoads){
    const tsaByEngineer={};
    const loads=Object.fromEntries(activeAdminIds.map(id=>[id,{count:0,weight:0}]));
    activeEngineerIds.slice().sort((a,b)=>(personLoads[b]||0)-(personLoads[a]||0)||a.localeCompare(b)).forEach(engineerId=>{
      if(!activeAdminIds.length){tsaByEngineer[engineerId]=null;return;}
      const preferred=existingTsaPreference(state,engineerId);
      let choices=activeAdminIds.slice();
      if(preferred&&choices.includes(preferred)){
        const minCount=Math.min(...choices.map(id=>loads[id].count));
        if(loads[preferred].count<=minCount+1)choices=[preferred];
      }
      const chosen=choices.sort((a,b)=>(loads[a].count-loads[b].count)||(loads[a].weight-loads[b].weight)||a.localeCompare(b))[0];
      tsaByEngineer[engineerId]=chosen;loads[chosen].count+=1;loads[chosen].weight+=Math.max(1,personLoads[engineerId]||0);
    });
    return {tsaByEngineer,tsaLoads:loads};
  }

  function scheduleFingerprint(state,dateKey,shiftIds){
    const ids=[...(shiftIds||[])].sort();
    const staff=S.allStaff(state).filter(p=>ids.includes(shiftId(state,p))&&(isEngineer(p)||isTsa(p))).map(p=>{
      const shift=S.getShift(state,p.id,dateKey);
      return [p.id,shift.start,shift.end,shift.off,shift.vacation,shift.coverageStatus||'working'].join(':');
    }).sort();
    const defs=ids.map(id=>{const d=S.shiftDefinition(state,id);return [id,d?.defaultStart,d?.defaultEnd,(d?.activeDays||[]).join(',')].join(':');});
    const locks=assignmentLocks(state).map(x=>`${x.personId}:${x.siteId}`).sort();
    return JSON.stringify({ids,staff,defs,locks,sites:(state.sites||[]).map(s=>`${s.id}:${s.tickets30}`).join('|')});
  }

  function generatePlan(state,dateKey,shiftIds){
    const selected=[...(shiftIds||[])].filter((id,i,a)=>a.indexOf(id)===i);
    const windows=windowsForDate(state,dateKey,selected).map((raw,index)=>{
      const activeEngineers=activeIds(state,dateKey,raw.start,raw.end,selected,isEngineer);
      const activeAdmins=activeIds(state,dateKey,raw.start,raw.end,selected,isTsa);
      const sites=assignSites(state,activeEngineers);
      const tsa=assignTsas(state,activeEngineers,activeAdmins,sites.personLoads);
      const activeShiftIds=[...new Set(activeEngineers.map(id=>shiftId(state,staffById(state,id))))];
      return {id:`ms-${index}-${raw.start}-${raw.end}`,start:raw.start,end:raw.end,activeEngineers,activeAdmins,activeShiftIds,siteOwners:sites.siteOwners,personSites:sites.personSites,personLoads:sites.personLoads,shiftLoads:sites.shiftLoads,lockedSites:sites.lockedSites,tsaByEngineer:tsa.tsaByEngineer};
    });
    return {type:'multi-shift',dateKey,selectedShiftIds:selected,generatedAt:new Date().toISOString(),scheduleFingerprint:scheduleFingerprint(state,dateKey,selected),windows};
  }

  function health(state,plan){
    const issues=[],warnings=[],totalSites=(state.sites||[]).length;
    if(!(plan?.selectedShiftIds||[]).length)issues.push('No shifts selected');
    if(!(plan?.windows||[]).length)issues.push('Selected shifts have no scheduled staffing on this date');
    (plan?.windows||[]).forEach(w=>{
      const label=`${S.formatTime(S.minutesToTime(w.start))}–${S.formatTime(S.minutesToTime(w.end))}`;
      if(!w.activeEngineers.length)issues.push(`${label}: no engineers available`);
      else if(Object.keys(w.siteOwners||{}).length!==totalSites)issues.push(`${label}: site coverage incomplete`);
      w.activeEngineers.forEach(id=>{if(!w.tsaByEngineer?.[id])warnings.push(`${label}: ${staffById(state,id)?.name||id} has no TSA`);});
      const loads=Object.values(w.personLoads||{}).filter(v=>Number.isFinite(v));
      if(loads.length>1){const avg=loads.reduce((a,b)=>a+b,0)/loads.length,max=Math.max(...loads),min=Math.min(...loads);if(avg&&((max-min)/avg)>.55)warnings.push(`${label}: engineer workload spread is wide`);}
    });
    return {ok:issues.length===0,issues,warnings,status:issues.length?'red':warnings.length?'yellow':'green'};
  }

  function handoffs(state,plan){
    const out=[],windows=plan?.windows||[];
    for(let i=1;i<windows.length;i+=1){
      const prev=windows[i-1],next=windows[i],siteGroups=new Map();
      (state.sites||[]).forEach(site=>{
        const from=prev.siteOwners?.[site.id]||null,to=next.siteOwners?.[site.id]||null;
        if(from===to)return;const key=`${from||'none'}>${to||'none'}`;
        if(!siteGroups.has(key))siteGroups.set(key,{from,to,sites:[]});siteGroups.get(key).sites.push(site.id);
      });
      const tsaChanges=[],engineers=new Set([...Object.keys(prev.tsaByEngineer||{}),...Object.keys(next.tsaByEngineer||{})]);
      engineers.forEach(engineerId=>{const from=prev.tsaByEngineer?.[engineerId]||null,to=next.tsaByEngineer?.[engineerId]||null;if(from!==to)tsaChanges.push({engineerId,from,to});});
      if(siteGroups.size||tsaChanges.length)out.push({at:next.start,siteGroups:[...siteGroups.values()],tsaChanges});
    }
    return out;
  }

  function publishedPlan(state,dateKey){return state?.coveragePlans?.[dateKey]||null;}
  function isPlanStale(state,dateKey,plan){return !plan||plan.scheduleFingerprint!==scheduleFingerprint(state,dateKey,plan.selectedShiftIds||[]);}
  function publishPlan(state,dateKey,plan){const next=clone(state);next.coveragePlans=next.coveragePlans||{};next.coveragePlans[dateKey]=clone(plan);next.coveragePlans[dateKey].publishedAt=new Date().toISOString();return next;}
  function clearPublishedPlan(state,dateKey){const next=clone(state);if(next.coveragePlans)delete next.coveragePlans[dateKey];return next;}

  function shiftLoadSummary(state,window){
    const total=Object.values(window.shiftLoads||{}).reduce((a,b)=>a+b,0)||1;
    return Object.entries(window.shiftLoads||{}).map(([id,load])=>({shiftId:id,name:shiftName(state,id),tickets:load,pct:load/total,engineers:window.activeEngineers.filter(pid=>shiftId(state,staffById(state,pid))===id).length})).sort((a,b)=>a.name.localeCompare(b.name));
  }


  function dateFromKey(dateKey){const [y,m,d]=String(dateKey||'').split('-').map(Number);return !y||!m||!d?null:new Date(y,m-1,d,12,0,0,0);}
  function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(dateKeyValue,amount){const d=dateFromKey(dateKeyValue);if(!d)return dateKeyValue;d.setDate(d.getDate()+Number(amount||0));return dateKey(d);}
  function datesBetween(startKey,endKey){const out=[];let cur=startKey;for(let i=0;i<14;i+=1){out.push(cur);if(cur===endKey)break;cur=addDays(cur,1);}return out;}
  function operationalPeriod(state,dateKeyValue,shiftIds){
    const selected=[...(shiftIds||[])].filter((x,i,a)=>a.indexOf(x)===i);
    const activeDays=new Set();selected.forEach(id=>{const def=S.shiftDefinition(state,id);(def?.activeDays||[]).forEach(day=>activeDays.add(Number(day)));});
    const selectedDate=dateFromKey(dateKeyValue);if(!selectedDate)return {startDate:dateKeyValue,endDate:dateKeyValue,dates:[dateKeyValue],label:'Selected day'};
    if(!activeDays.size)return {startDate:dateKeyValue,endDate:dateKeyValue,dates:[dateKeyValue],label:'Selected day'};
    if(activeDays.size===7){
      const dow=selectedDate.getDay(),back=(dow+6)%7;const start=addDays(dateKeyValue,-back),end=addDays(start,6);
      return {startDate:start,endDate:end,dates:datesBetween(start,end),label:'Operational week'};
    }
    let anchorKey=dateKeyValue;let currentDow=selectedDate.getDay();
    if(!activeDays.has(currentDow)){for(let step=1;step<=6;step+=1){const candidate=addDays(dateKeyValue,step),d=dateFromKey(candidate);if(activeDays.has(d.getDay())){anchorKey=candidate;currentDow=d.getDay();break;}}}
    let back=0,forward=0;
    while(back<6){const d=dateFromKey(addDays(anchorKey,-(back+1)));if(!activeDays.has(d.getDay()))break;back+=1;}
    while(forward<6){const d=dateFromKey(addDays(anchorKey,forward+1));if(!activeDays.has(d.getDay()))break;forward+=1;}
    const start=addDays(anchorKey,-back),end=addDays(anchorKey,forward);
    return {startDate:start,endDate:end,dates:datesBetween(start,end),label:'Operational week'};
  }
  function periodKey(state,dateKeyValue,shiftIds){const p=operationalPeriod(state,dateKeyValue,shiftIds),ids=[...(shiftIds||[])].sort().join('+');return `${p.startDate}--${p.endDate}--${ids}`;}
  function templateDateForPeriod(state,period,shiftIds){
    let best=period.startDate,bestCount=-1;
    (period.dates||[]).forEach(day=>{const count=(shiftIds||[]).filter(id=>S.shiftActiveOnDate(state,id,day)).length;if(count>bestCount){best=day;bestCount=count;}});
    return best;
  }
  function generateWeeklyPlan(state,dateKeyValue,shiftIds){
    const selected=[...(shiftIds||[])].filter((id,i,a)=>a.indexOf(id)===i);
    const period=operationalPeriod(state,dateKeyValue,selected);
    const templateDate=templateDateForPeriod(state,period,selected);
    const stableState=clone(state);stableState.scheduleOverrides={};
    const base=generatePlan(stableState,templateDate,selected);
    return {...base,type:'weekly-multi-shift',dateKey:dateKeyValue,templateDate,periodStart:period.startDate,periodEnd:period.endDate,periodDates:period.dates,periodKey:periodKey(state,dateKeyValue,selected),generatedAt:new Date().toISOString()};
  }
  function weeklyPlans(state){return state?.weeklyCoveragePlans&&typeof state.weeklyCoveragePlans==='object'?state.weeklyCoveragePlans:{};}
  function weeklyPlansForDate(state,dateKeyValue){return Object.values(weeklyPlans(state)).filter(plan=>plan&&plan.periodStart<=dateKeyValue&&plan.periodEnd>=dateKeyValue).sort((a,b)=>String(b.publishedAt||b.generatedAt||'').localeCompare(String(a.publishedAt||a.generatedAt||'')));}
  function publishedWeeklyPlan(state,dateKeyValue,shiftIds){
    if(shiftIds?.length){const key=periodKey(state,dateKeyValue,shiftIds);return weeklyPlans(state)[key]||null;}
    return weeklyPlansForDate(state,dateKeyValue)[0]||null;
  }
  function publishWeeklyPlan(state,plan){const next=clone(state);next.weeklyCoveragePlans=next.weeklyCoveragePlans||{};const copy=clone(plan);copy.publishedAt=new Date().toISOString();next.weeklyCoveragePlans[copy.periodKey]=copy;return next;}
  function clearWeeklyPlan(state,planOrKey){const next=clone(state),key=typeof planOrKey==='string'?planOrKey:planOrKey?.periodKey;if(key&&next.weeklyCoveragePlans)delete next.weeklyCoveragePlans[key];return next;}
  function weeklyPlanStale(state,plan){
    if(!plan)return true;
    const stable=clone(state);stable.scheduleOverrides={};
    return plan.scheduleFingerprint!==scheduleFingerprint(stable,plan.templateDate||plan.periodStart,plan.selectedShiftIds||[]);
  }

  function planWindowSignature(plan){
    return JSON.stringify((plan?.windows||[]).map(w=>({
      start:w.start,end:w.end,
      activeEngineers:[...(w.activeEngineers||[])].sort(),
      activeAdmins:[...(w.activeAdmins||[])].sort(),
      siteOwners:Object.entries(w.siteOwners||{}).sort((a,b)=>a[0].localeCompare(b[0])),
      tsaByEngineer:Object.entries(w.tsaByEngineer||{}).sort((a,b)=>a[0].localeCompare(b[0]))
    })));
  }

  function effectiveWeeklyPlan(state,plan,dateKeyValue){
    if(!plan)return null;
    const live=generatePlan(state,dateKeyValue,plan.selectedShiftIds||[]);
    const adjusted=planWindowSignature(live)!==planWindowSignature(plan);
    return {
      ...clone(plan),
      windows:live.windows,
      effectiveDate:dateKeyValue,
      dailyAdjusted:adjusted,
      liveScheduleFingerprint:live.scheduleFingerprint,
      type:'weekly-effective'
    };
  }

  return {clone,isEngineer,isTsa,assignmentLocks,engineersForShift,tsasForShift,eligibleShifts,selectedPeople,windowsForDate,shiftShares,assignSites,assignTsas,scheduleFingerprint,generatePlan,health,handoffs,publishedPlan,isPlanStale,publishPlan,clearPublishedPlan,shiftLoadSummary,dateFromKey,dateKey,addDays,datesBetween,operationalPeriod,periodKey,templateDateForPeriod,generateWeeklyPlan,weeklyPlans,weeklyPlansForDate,publishedWeeklyPlan,publishWeeklyPlan,clearWeeklyPlan,weeklyPlanStale,planWindowSignature,effectiveWeeklyPlan};
});
