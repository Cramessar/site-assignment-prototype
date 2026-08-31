(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SiteScheduleLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function allStaff(state) {
    const seen = new Set();
    return [...(state.people || []), ...(state.supportAdmins || []), ...(state.directoryPeople || [])]
      .filter(person => person && person.id && !seen.has(person.id) && seen.add(person.id));
  }

  function staffById(state, personId) { return allStaff(state).find(p => p.id === personId) || null; }
  function shiftCatalog(state) { return Array.isArray(state?.shiftCatalog) ? state.shiftCatalog : []; }
  function shiftDefinition(state, shiftId) { return shiftCatalog(state).find(s => s.id === shiftId) || null; }
  function operationalShiftId(person) { return person?.operationalShiftId || (person?.shift === 'morning' ? 'weekend-day' : person?.shift === 'mid' ? 'weekend-mid' : 'unassigned'); }
  function coverageGroup(person) { return person?.coverageGroup || person?.shift || null; }

  function scheduleRules(state) {
    const configured = state?.rules?.scheduleDefaults || {};
    return {
      morning: configured.morning || { start: '06:00', end: '16:00' },
      mid: configured.mid || { start: '12:00', end: '20:00' }
    };
  }

  function timelineRules(state) {
    const configured = state?.rules?.scheduleTimeline || {};
    return { start: configured.start || '05:00', end: configured.end || '21:00' };
  }

  function isDateKey(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
  function timeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hour = Number(match[1]), minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59 || (hour === 24 && minute !== 0)) return null;
    return hour * 60 + minute;
  }
  function minutesToTime(value) {
    const raw = Math.max(0, Math.round(Number(value) || 0));
    if (raw === 1440) return '24:00';
    const minutes = raw % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  function formatTime(value) {
    const minutes = timeToMinutes(value);
    if (minutes == null) return '—';
    const normalized = minutes % 1440;
    const hour24 = Math.floor(normalized / 60), minute = normalized % 60;
    return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
  }
  function formatDuration(minutes) {
    const value = Math.max(0, Number(minutes) || 0), hours = Math.floor(value / 60), mins = value % 60;
    if (!mins) return `${hours}h`; if (!hours) return `${mins}m`; return `${hours}h ${mins}m`;
  }
  function intervalFromTimes(start, end) {
    const sm = timeToMinutes(start), rawEnd = timeToMinutes(end);
    if (sm == null || rawEnd == null) return null;
    let em = rawEnd;
    if (em <= sm) em += 1440;
    if (em - sm <= 0 || em - sm > 1440) return null;
    return { start: sm, end: em };
  }

  function defaultShiftForPerson(state, personId) {
    const person = staffById(state, personId);
    if (!person) return null;
    const def = shiftDefinition(state, operationalShiftId(person));
    let start = def?.defaultStart || null, end = def?.defaultEnd || null;
    if ((!start || !end) && !def && (person.shift === 'morning' || person.shift === 'mid')) {
      const legacy = scheduleRules(state)[person.shift]; start = legacy.start; end = legacy.end;
    }
    const baseInterval = start && end ? intervalFromTimes(start, end) : null;
    if (!baseInterval) {
      return { start: null, end: null, off: false, coverageStatus: 'working', source: 'unconfigured', unconfigured: true, durationMinutes: 0 };
    }
    return { start, end, off: false, coverageStatus: 'working', source: 'default', unconfigured: false, durationMinutes: baseInterval.end - baseInterval.start };
  }

  function rawOverride(state, personId, dateKey) { return isDateKey(dateKey) ? (state?.scheduleOverrides?.[dateKey]?.[personId] || null) : null; }
  function getShift(state, personId, dateKey) {
    const person = staffById(state, personId);
    if (!person) return null;
    if (person.vacation) return { start:null,end:null,off:true,vacation:true,coverageStatus:'vacation',source:'vacation',durationMinutes:0,unconfigured:false };
    const base = defaultShiftForPerson(state, personId);
    const override = rawOverride(state, personId, dateKey);
    if (!override) return base;
    if (override.off) return { ...base, ...override, start:null,end:null,off:true,vacation:false,coverageStatus:override.coverageStatus || 'off',source:'override',durationMinutes:0,unconfigured:false };
    const start = override.start || base.start, end = override.end || base.end;
    const interval = intervalFromTimes(start, end);
    if (!interval) return { ...base, source: base.unconfigured ? 'unconfigured' : 'default', invalidOverride:true };
    return { ...base, ...override, start,end,off:false,vacation:false,coverageStatus:override.coverageStatus || 'working',source:'override',durationMinutes:interval.end-interval.start,unconfigured:false };
  }

  function ensureOverrides(next, dateKey) {
    if (!next.scheduleOverrides || typeof next.scheduleOverrides !== 'object') next.scheduleOverrides = {};
    if (!next.scheduleOverrides[dateKey] || typeof next.scheduleOverrides[dateKey] !== 'object') next.scheduleOverrides[dateKey] = {};
  }
  function setShift(state, personId, dateKey, start, end) {
    const next=clone(state); if (!staffById(next,personId)||!isDateKey(dateKey)) return next;
    const interval=intervalFromTimes(start,end); if(!interval) return next;
    ensureOverrides(next,dateKey); const existing=next.scheduleOverrides[dateKey][personId]||{};
    next.scheduleOverrides[dateKey][personId]={...existing,start,end,off:false,coverageStatus:existing.coverageStatus||'working'}; return next;
  }
  function setOff(state, personId, dateKey, off=true) {
    const next=clone(state); if(!staffById(next,personId)||!isDateKey(dateKey)) return next; ensureOverrides(next,dateKey);
    if(off) next.scheduleOverrides[dateKey][personId]={off:true,coverageStatus:'off'};
    else delete next.scheduleOverrides[dateKey][personId];
    return next;
  }
  function setCoverageStatus(state, personId, dateKey, coverageStatus) {
    const allowed=new Set(['working','training','meeting','unavailable']); const next=clone(state);
    if(!staffById(next,personId)||!isDateKey(dateKey)||!allowed.has(coverageStatus)) return next;
    ensureOverrides(next,dateKey); const existing=next.scheduleOverrides[dateKey][personId]||{}; const base=defaultShiftForPerson(next,personId);
    next.scheduleOverrides[dateKey][personId]={...existing,start:existing.start||base.start,end:existing.end||base.end,off:false,coverageStatus}; return next;
  }
  function clearOverride(state, personId, dateKey) { const next=clone(state); if(!next.scheduleOverrides?.[dateKey])return next; delete next.scheduleOverrides[dateKey][personId]; if(!Object.keys(next.scheduleOverrides[dateKey]).length)delete next.scheduleOverrides[dateKey]; return next; }
  function clearDay(state,dateKey){const next=clone(state);if(next.scheduleOverrides?.[dateKey])delete next.scheduleOverrides[dateKey];return next;}

  function setShiftDefault(state, shiftId, start, end) {
    const next=clone(state), def=shiftDefinition(next,shiftId); if(!def) return next;
    const interval=intervalFromTimes(start,end); if(!interval) return next;
    def.defaultStart=start; def.defaultEnd=end;
    if(def.coverageGroup){ if(!next.rules)next.rules={}; if(!next.rules.scheduleDefaults)next.rules.scheduleDefaults={}; next.rules.scheduleDefaults[def.coverageGroup]={start,end}; }
    return next;
  }
  function clearShiftDefault(state, shiftId) {
    const next=clone(state), def=shiftDefinition(next,shiftId); if(!def)return next; def.defaultStart=null;def.defaultEnd=null; return next;
  }

  function intervalForShift(shift){if(!shift||shift.off||shift.vacation||shift.unconfigured)return null;return intervalFromTimes(shift.start,shift.end);}
  function intervalForCoverage(shift){if(!shift||shift.off||shift.vacation||(shift.coverageStatus||'working')!=='working')return null;return intervalForShift(shift);}
  function overlapMinutes(a,b){const l=intervalForShift(a),r=intervalForShift(b);return !l||!r?0:Math.max(0,Math.min(l.end,r.end)-Math.max(l.start,r.start));}
  function overlapsForPerson(state,personId,dateKey){const own=getShift(state,personId,dateKey);if(!intervalForShift(own))return[];return allStaff(state).filter(p=>p.id!==personId).map(person=>{const shift=getShift(state,person.id,dateKey);return{person,shift,minutes:overlapMinutes(own,shift)}}).filter(x=>x.minutes>0).sort((a,b)=>(b.minutes-a.minutes)||a.person.name.localeCompare(b.person.name));}

  function coverageSegments(intervals){const points=[];intervals.forEach(i=>{if(!i)return;points.push({at:i.start,delta:1},{at:i.end,delta:-1})});points.sort((a,b)=>(a.at-b.at)||(a.delta-b.delta));if(!points.length)return[];const out=[];let count=0,last=points[0].at,i=0;while(i<points.length){const at=points[i].at;if(at>last&&count>0)out.push({start:last,end:at,count});while(i<points.length&&points[i].at===at){count+=points[i].delta;i++}last=at}return out;}
  function crossTeamOverlapSegments(state,dateKey){
    const m=allStaff(state).filter(p=>coverageGroup(p)==='morning').map(p=>intervalForShift(getShift(state,p.id,dateKey))).filter(Boolean);
    const d=allStaff(state).filter(p=>coverageGroup(p)==='mid').map(p=>intervalForShift(getShift(state,p.id,dateKey))).filter(Boolean);
    const mc=coverageSegments(m),dc=coverageSegments(d),out=[];mc.forEach(a=>dc.forEach(b=>{const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);if(end>start)out.push({start,end,morningCount:a.count,midCount:b.count})}));return out;
  }
  function mergeSegments(segments){const sorted=segments.slice().sort((a,b)=>a.start-b.start||a.end-b.end),out=[];sorted.forEach(s=>{const last=out[out.length-1];if(last&&s.start<=last.end)last.end=Math.max(last.end,s.end);else out.push({start:s.start,end:s.end})});return out;}

  function dayStats(state,dateKey){
    const rows=allStaff(state).map(person=>({person,shift:getShift(state,person.id,dateKey)}));
    const activeRows=rows.filter(r=>intervalForShift(r.shift));
    const morningRows=activeRows.filter(r=>coverageGroup(r.person)==='morning'),midRows=activeRows.filter(r=>coverageGroup(r.person)==='mid');
    const overlapSegments=crossTeamOverlapSegments(state,dateKey),mergedOverlap=mergeSegments(overlapSegments);
    const shiftStats={}; shiftCatalog(state).forEach(def=>{const all=rows.filter(r=>operationalShiftId(r.person)===def.id), active=all.filter(r=>intervalForShift(r.shift)); shiftStats[def.id]={def,total:all.length,activeCount:active.length,hours:active.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,unconfigured:all.filter(r=>r.shift?.unconfigured).length};});
    return {rows,activeCount:activeRows.length,morningCount:morningRows.length,midCount:midRows.length,morningHours:morningRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,midHours:midRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,exceptions:rows.filter(r=>rawOverride(state,r.person.id,dateKey)).length,overlapSegments,mergedOverlap,overlapMinutes:mergedOverlap.reduce((s,x)=>s+x.end-x.start,0),shiftStats,totalHours:activeRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,unconfiguredCount:rows.filter(r=>r.shift?.unconfigured).length};
  }

  function barPosition(state,shift){const interval=intervalForShift(shift);if(!interval)return null;const t=timelineRules(state),ts=timeToMinutes(t.start),te=timeToMinutes(t.end),span=Math.max(1,te-ts),cs=Math.max(ts,Math.min(te,interval.start)),ce=Math.max(ts,Math.min(te,interval.end));return{leftPct:((cs-ts)/span)*100,widthPct:Math.max(0,((ce-cs)/span)*100),clippedBefore:interval.start<ts,clippedAfter:interval.end>te};}

  return {clone,allStaff,staffById,shiftCatalog,shiftDefinition,operationalShiftId,coverageGroup,scheduleRules,timelineRules,isDateKey,timeToMinutes,minutesToTime,formatTime,formatDuration,intervalFromTimes,defaultShiftForPerson,rawOverride,getShift,setShift,setOff,setCoverageStatus,clearOverride,clearDay,setShiftDefault,clearShiftDefault,intervalForShift,intervalForCoverage,overlapMinutes,overlapsForPerson,coverageSegments,crossTeamOverlapSegments,mergeSegments,dayStats,barPosition};
});
