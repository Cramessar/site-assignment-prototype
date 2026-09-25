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
  function normalizedName(value){ return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function firstToken(value){ return normalizedName(value).split(/\s+/)[0] || ''; }
  function managerShiftId(state, managerName) {
    const token = firstToken(managerName);
    if (!token) return null;
    const aliases = { matt: 'matthew', femi: 'oluwafemi', chaitu: 'chaitanya' };
    const candidates = new Set([token, aliases[token] || token]);
    const tokenMatch = value => {
      const first = firstToken(value);
      const normalized = normalizedName(value);
      return [...candidates].some(candidate => first === candidate || first.startsWith(candidate) || candidate.startsWith(first) || normalized.includes(candidate));
    };
    const byCatalog = shiftCatalog(state).find(def => tokenMatch(def.supervisorName));
    if (byCatalog) return byCatalog.id;
    const byStaff = allStaff(state).find(person => tokenMatch(person.fullName || person.name));
    return byStaff ? operationalShiftId(state, byStaff) : null;
  }
  function operationalShiftId(state, person) {
    if (person && !state && typeof state === 'object') { /* noop legacy guard */ }
    if (!person && state && state.id) { person = state; state = null; }
    let shiftId = person?.operationalShiftId || (person?.shift === 'morning' ? 'weekend-day' : person?.shift === 'mid' ? 'weekend-mid' : 'unassigned');
    if ((shiftId === 'unassigned' || !shiftId) && state && person?.manager) {
      const inferred = managerShiftId(state, person.manager);
      if (inferred) shiftId = inferred;
    }
    return shiftId || 'unassigned';
  }
  function coverageGroup(person) { return person?.coverageGroup || person?.shift || null; }
  function dateFromKey(dateKey) { const [y,m,d] = String(dateKey || '').split('-').map(Number); return !y || !m || !d ? null : new Date(y, m - 1, d, 12, 0, 0, 0); }
  function isoWeekdayForDateKey(dateKey) { const d=dateFromKey(dateKey); if(!d)return null; const day=d.getDay(); return day===0?7:day; }
  function shiftActiveOnDate(state, shiftId, dateKey) {
    const d = dateFromKey(dateKey);
    if (!d) return true;
    const day = d.getDay();
    const def = shiftDefinition(state, shiftId);
    if (Array.isArray(def?.activeDays)) return def.activeDays.map(Number).includes(day);
    if (shiftId === 'weekday-morning' || shiftId === 'weekday-mid') return [1,2,3,4].includes(day);
    if (shiftId === 'weekday-night') return [1,2,3,4].includes(day);
    if (shiftId === 'weekend-day' || shiftId === 'weekend-mid' || shiftId === 'weekend-night') return [5,6,0,1].includes(day);
    return true;
  }
  function visibleShiftIds(state, dateKey) { return shiftCatalog(state).filter(def => shiftActiveOnDate(state, def.id, dateKey)).map(def => def.id); }
  function isShiftSupervisor(state, person) {
    const shiftId = operationalShiftId(state, person);
    const def = shiftDefinition(state, shiftId);
    if (!def) return false;
    const personName = normalizedName(person?.fullName || person?.name);
    return Boolean((def.supervisorId && def.supervisorId === person?.id) || (def.supervisorName && normalizedName(def.supervisorName) === personName));
  }

  function scheduleRules(state) {
    const configured = state?.rules?.scheduleDefaults || {};
    return {
      morning: configured.morning || { start: '06:00', end: '16:00' },
      mid: configured.mid || { start: '12:00', end: '22:00' }
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
    const def = shiftDefinition(state, operationalShiftId(state, person));
    let start = def?.defaultStart || null, end = def?.defaultEnd || null;
    if ((!start || !end) && !def && (person.shift === 'morning' || person.shift === 'mid')) {
      const legacy = scheduleRules(state)[person.shift]; start = legacy.start; end = legacy.end;
    }
    const baseInterval = start && end ? intervalFromTimes(start, end) : null;
    if (!baseInterval) {
      return { start: null, end: null, segments: [], off: false, coverageStatus: 'working', source: 'unconfigured', unconfigured: true, durationMinutes: 0 };
    }
    return { start, end, segments:[{start,end}], off: false, coverageStatus: 'working', source: 'default', unconfigured: false, durationMinutes: baseInterval.end - baseInterval.start };
  }

  function recurringProfile(state, personId) {
    return state?.recurringSchedules?.[personId] || null;
  }

  function recurringShiftForPerson(state, personId, dateKey) {
    const profile=recurringProfile(state,personId),iso=isoWeekdayForDateKey(dateKey);
    if(!profile||!iso)return null;
    const segments=(profile.segments||[])
      .filter(segment=>Number(segment.isoWeekday)===iso)
      .sort((a,b)=>(Number(a.segmentOrder||0)-Number(b.segmentOrder||0)));
    if(!segments.length){
      if(!profile.replacesShiftDefault)return null;
      return {start:null,end:null,segments:[],off:true,vacation:false,recurringOff:true,coverageStatus:'off',source:'recurring',durationMinutes:0,unconfigured:false};
    }
    const valid=segments.map(segment=>({start:segment.start,end:segment.end,interval:intervalFromTimes(segment.start,segment.end)})).filter(x=>x.interval);
    if(!valid.length)return {start:null,end:null,segments:[],off:false,coverageStatus:'working',source:'recurring',durationMinutes:0,unconfigured:true};
    return {
      start:valid[0].start,
      end:valid[valid.length-1].end,
      segments:valid.map(x=>({start:x.start,end:x.end})),
      off:false,
      coverageStatus:'working',
      source:'recurring',
      unconfigured:false,
      durationMinutes:valid.reduce((sum,x)=>sum+(x.interval.end-x.interval.start),0)
    };
  }

  function rawOverride(state, personId, dateKey) { return isDateKey(dateKey) ? (state?.scheduleOverrides?.[dateKey]?.[personId] || null) : null; }
  function getShift(state, personId, dateKey) {
    const person = staffById(state, personId);
    if (!person) return null;
    if (person.vacation) return { start:null,end:null,segments:[],off:true,vacation:true,coverageStatus:'vacation',source:'vacation',durationMinutes:0,unconfigured:false };
    const shiftId = operationalShiftId(state, person);
    const recurring=isDateKey(dateKey)?recurringShiftForPerson(state,personId,dateKey):null;
    const defaultBase=defaultShiftForPerson(state,personId);
    const base=recurring||defaultBase;
    const override=rawOverride(state,personId,dateKey);
    if(!recurring&&isDateKey(dateKey)&&!shiftActiveOnDate(state,shiftId,dateKey)&&!override){
      return {...defaultBase,start:null,end:null,segments:[],off:true,vacation:false,inactiveShift:true,coverageStatus:'off',source:'inactive-shift',durationMinutes:0,unconfigured:false};
    }
    if(!override)return base;
    const status=override.coverageStatus||(override.off?'off':'working');
    if(override.off||status==='vacation')return {...base,...override,start:null,end:null,segments:[],off:true,vacation:status==='vacation',coverageStatus:status,source:'override',durationMinutes:0,unconfigured:false};
    const start=override.start||base?.start,end=override.end||base?.end;
    const interval=intervalFromTimes(start,end);
    if(!interval)return {...base,source:base?.unconfigured?'unconfigured':(base?.source||'default'),invalidOverride:true};
    return {...base,...override,start,end,segments:[{start,end}],off:false,vacation:false,coverageStatus:status,source:'override',durationMinutes:interval.end-interval.start,unconfigured:false};
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
  function setShiftDays(state, shiftId, activeDays) {
    const next=clone(state), def=shiftDefinition(next,shiftId); if(!def)return next;
    const clean=[...new Set((activeDays||[]).map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))].sort((a,b)=>a-b);
    def.activeDays=clean; return next;
  }
  function setShiftSchedule(state, shiftId, start, end, activeDays) {
    let next=setShiftDefault(state,shiftId,start,end);
    next=setShiftDays(next,shiftId,activeDays);
    return next;
  }

  function intervalsForShift(shift){
    if(!shift||shift.off||shift.vacation||shift.unconfigured)return[];
    const segments=Array.isArray(shift.segments)&&shift.segments.length?shift.segments:(shift.start&&shift.end?[{start:shift.start,end:shift.end}]:[]);
    return segments.map(segment=>intervalFromTimes(segment.start,segment.end)).filter(Boolean);
  }
  function intervalsForCoverage(shift){
    if(!shift||shift.off||shift.vacation||(shift.coverageStatus||'working')!=='working')return[];
    return intervalsForShift(shift);
  }
  function intervalForShift(shift){
    const intervals=intervalsForShift(shift);
    if(!intervals.length)return null;
    return {start:Math.min(...intervals.map(x=>x.start)),end:Math.max(...intervals.map(x=>x.end))};
  }
  function intervalForCoverage(shift){
    const intervals=intervalsForCoverage(shift);
    if(!intervals.length)return null;
    return {start:Math.min(...intervals.map(x=>x.start)),end:Math.max(...intervals.map(x=>x.end))};
  }
  function overlapMinutes(a,b){
    const left=intervalsForShift(a),right=intervalsForShift(b);let total=0;
    left.forEach(l=>right.forEach(r=>{total+=Math.max(0,Math.min(l.end,r.end)-Math.max(l.start,r.start));}));
    return total;
  }
  function overlapsForPerson(state,personId,dateKey){
    const own=getShift(state,personId,dateKey);if(!intervalsForShift(own).length)return[];
    return allStaff(state).filter(p=>p.id!==personId).map(person=>{const shift=getShift(state,person.id,dateKey);return{person,shift,minutes:overlapMinutes(own,shift)}}).filter(x=>x.minutes>0).sort((a,b)=>(b.minutes-a.minutes)||a.person.name.localeCompare(b.person.name));
  }

  function coverageSegments(intervals){const points=[];intervals.forEach(i=>{if(!i)return;points.push({at:i.start,delta:1},{at:i.end,delta:-1})});points.sort((a,b)=>(a.at-b.at)||(a.delta-b.delta));if(!points.length)return[];const out=[];let count=0,last=points[0].at,i=0;while(i<points.length){const at=points[i].at;if(at>last&&count>0)out.push({start:last,end:at,count});while(i<points.length&&points[i].at===at){count+=points[i].delta;i++}last=at}return out;}
  function crossTeamOverlapSegments(state,dateKey){
    const m=allStaff(state).filter(p=>coverageGroup(p)==='morning').flatMap(p=>intervalsForShift(getShift(state,p.id,dateKey)));
    const d=allStaff(state).filter(p=>coverageGroup(p)==='mid').flatMap(p=>intervalsForShift(getShift(state,p.id,dateKey)));
    const mc=coverageSegments(m),dc=coverageSegments(d),out=[];mc.forEach(a=>dc.forEach(b=>{const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);if(end>start)out.push({start,end,morningCount:a.count,midCount:b.count})}));return out;
  }
  function mergeSegments(segments){const sorted=segments.slice().sort((a,b)=>a.start-b.start||a.end-b.end),out=[];sorted.forEach(s=>{const last=out[out.length-1];if(last&&s.start<=last.end)last.end=Math.max(last.end,s.end);else out.push({start:s.start,end:s.end})});return out;}

  function outToday(state,dateKey) {
    if (!isDateKey(dateKey)) return [];
    const labels = {
      vacation: 'Vacation',
      off: 'Off',
      unavailable: 'Unavailable',
      training: 'Training',
      meeting: 'Meeting'
    };
    return allStaff(state).map(person => {
      if (person.vacation) {
        return { person, status: 'vacation', label: labels.vacation, shiftId: operationalShiftId(state, person) };
      }
      const override = rawOverride(state, person.id, dateKey);
      if (!override) return null;
      const status = override.off ? (override.coverageStatus || 'off') : (override.coverageStatus || 'working');
      if (!labels[status]) return null;
      return { person, status, label: labels[status], shiftId: operationalShiftId(state, person) };
    }).filter(Boolean).sort((a,b) => {
      const shiftA = shiftDefinition(state,a.shiftId)?.name || a.shiftId || '';
      const shiftB = shiftDefinition(state,b.shiftId)?.name || b.shiftId || '';
      return shiftA.localeCompare(shiftB) || (a.person.fullName || a.person.name).localeCompare(b.person.fullName || b.person.name);
    });
  }

  function shiftTimeLabel(shift){
    if(!shift||shift.off||shift.vacation)return '';
    const segments=Array.isArray(shift.segments)&&shift.segments.length?shift.segments:(shift.start&&shift.end?[{start:shift.start,end:shift.end}]:[]);
    return segments.map(s=>`${formatTime(s.start)}–${formatTime(s.end)}`).join(' + ');
  }

  function outForDates(state,dateKeys,shiftIds){
    const wanted=new Set(shiftIds||[]),rows=[];
    (dateKeys||[]).forEach(dateKey=>{
      outToday(state,dateKey).forEach(row=>{
        if(wanted.size&&!wanted.has(row.shiftId))return;
        rows.push({...row,dateKey});
      });
    });
    return rows;
  }

  function dayStats(state,dateKey){
    const rows=allStaff(state).map(person=>({person,shift:getShift(state,person.id,dateKey)}));
    const activeRows=rows.filter(r=>intervalsForShift(r.shift).length);
    const morningRows=activeRows.filter(r=>coverageGroup(r.person)==='morning'),midRows=activeRows.filter(r=>coverageGroup(r.person)==='mid');
    const overlapSegments=crossTeamOverlapSegments(state,dateKey),mergedOverlap=mergeSegments(overlapSegments);
    const visible = new Set(visibleShiftIds(state, dateKey));
    const visibleRows = rows.filter(r => visible.has(operationalShiftId(state, r.person)));
    const shiftStats={}; shiftCatalog(state).filter(def => visible.has(def.id)).forEach(def=>{const all=visibleRows.filter(r=>operationalShiftId(state, r.person)===def.id), active=all.filter(r=>intervalsForShift(r.shift).length); shiftStats[def.id]={def,total:all.length,activeCount:active.length,hours:active.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,unconfigured:all.filter(r=>r.shift?.unconfigured).length};});
    return {rows,activeCount:activeRows.length,morningCount:morningRows.length,midCount:midRows.length,morningHours:morningRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,midHours:midRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,exceptions:rows.filter(r=>rawOverride(state,r.person.id,dateKey)).length,overlapSegments,mergedOverlap,overlapMinutes:mergedOverlap.reduce((s,x)=>s+x.end-x.start,0),shiftStats,totalHours:activeRows.reduce((s,r)=>s+r.shift.durationMinutes,0)/60,unconfiguredCount:rows.filter(r=>r.shift?.unconfigured).length};
  }

  function barPositions(state,shift){
    const intervals=intervalsForShift(shift);if(!intervals.length)return[];
    const t=timelineRules(state),ts=timeToMinutes(t.start),te=timeToMinutes(t.end),span=Math.max(1,te-ts);
    return intervals.map(interval=>{const cs=Math.max(ts,Math.min(te,interval.start)),ce=Math.max(ts,Math.min(te,interval.end));return{leftPct:((cs-ts)/span)*100,widthPct:Math.max(0,((ce-cs)/span)*100),clippedBefore:interval.start<ts,clippedAfter:interval.end>te};}).filter(pos=>pos.widthPct>0);
  }
  function barPosition(state,shift){return barPositions(state,shift)[0]||null;}

  return {clone,allStaff,staffById,shiftCatalog,shiftDefinition,managerShiftId,operationalShiftId,coverageGroup,scheduleRules,timelineRules,isDateKey,timeToMinutes,minutesToTime,formatTime,formatDuration,intervalFromTimes,isoWeekdayForDateKey,defaultShiftForPerson,recurringProfile,recurringShiftForPerson,rawOverride,getShift,setShift,setOff,setCoverageStatus,clearOverride,clearDay,setShiftDefault,clearShiftDefault,setShiftDays,setShiftSchedule,intervalsForShift,intervalsForCoverage,intervalForShift,intervalForCoverage,overlapMinutes,overlapsForPerson,coverageSegments,crossTeamOverlapSegments,mergeSegments,shiftActiveOnDate,visibleShiftIds,isShiftSupervisor,shiftTimeLabel,outToday,outForDates,dayStats,barPositions,barPosition};
});
