(function(root){
  const STORAGE_KEY='site-coverage-manager-v10';
  const LEGACY_KEYS=['site-coverage-manager-v9'];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function seedState(){
    const seed=clone(root.SITE_ASSIGNMENT_SEED);
    seed.version=10;
    seed.weeklyCoveragePlans=seed.weeklyCoveragePlans||{};
    return root.SiteCoverageLogic?.rebalanceAssignments ? root.SiteCoverageLogic.rebalanceAssignments(seed) : seed;
  }
  function normalize(raw){
    const seed=clone(root.SITE_ASSIGNMENT_SEED);
    const state=raw&&typeof raw==='object'?clone(raw):seedState();
    state.version=10;
    state.weeklyCoveragePlans=state.weeklyCoveragePlans||{};
    state.shiftCatalog=Array.isArray(state.shiftCatalog)&&state.shiftCatalog.length?state.shiftCatalog:seed.shiftCatalog;
    // Fill any newly introduced shift fields from the seed without overwriting supervisor edits.
    const seedById=Object.fromEntries((seed.shiftCatalog||[]).map(x=>[x.id,x]));
    state.shiftCatalog=(state.shiftCatalog||[]).map(def=>({...seedById[def.id],...def,activeDays:Array.isArray(def.activeDays)?def.activeDays:(seedById[def.id]?.activeDays||[])}));
    state.rules=state.rules||seed.rules||{};
    state.scheduleOverrides=state.scheduleOverrides||{};
    state.recurringSchedules=state.recurringSchedules||{};
    state.coveragePlans=state.coveragePlans||{};
    state.dailyPlans=state.dailyPlans||{};
    return root.DailyPlanLogic?.normalizeState ? root.DailyPlanLogic.normalizeState(state) : state;
  }
  function load(){
    try{
      const current=localStorage.getItem(STORAGE_KEY);if(current)return normalize(JSON.parse(current));
      for(const key of LEGACY_KEYS){const raw=localStorage.getItem(key);if(raw){const migrated=normalize(JSON.parse(raw));save(migrated);return migrated;}}
    }catch(e){}
    return normalize(seedState());
  }
  function save(state){const normalized=normalize(state);localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));return normalized;}
  function reset(){const s=normalize(seedState());save(s);return s;}
  function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function fmtDate(key,opts={}){const [y,m,d]=String(key||'').split('-').map(Number);const date=new Date(y,m-1,d,12);return date.toLocaleDateString([],{month:'short',day:'numeric',...opts});}
  function fmtRange(start,end){return start===end?fmtDate(start,{weekday:'short',year:'numeric'}):`${fmtDate(start,{weekday:'short'})} – ${fmtDate(end,{weekday:'short',year:'numeric'})}`;}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function isoToJsDay(value){const day=Number(value);return day===7?0:day;}
  function addDays(key,amount){const [y,m,d]=String(key||'').split('-').map(Number);const date=new Date(y,m-1,d,12);date.setDate(date.getDate()+Number(amount||0));return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function weekDateKeys(dateKey){
    const [y,m,d]=String(dateKey||'').split('-').map(Number),date=new Date(y,m-1,d,12),day=date.getDay(),back=day===0?6:day-1,start=addDays(dateKey,-back);
    return Array.from({length:7},(_,i)=>addDays(start,i));
  }

  async function hydrateScheduleData(state,dateFrom,dateTo){
    let next=clone(state);
    try{
      const response=await fetch('/api/v1/schedules/config',{credentials:'same-origin'});
      if(response.ok){
        const config=await response.json();
        const byId=Object.fromEntries((next.shiftCatalog||[]).map(def=>[def.id,def]));
        (config.shift_defaults||[]).forEach(row=>{
          const current=byId[row.shift_id]||{id:row.shift_id,name:row.name};
          byId[row.shift_id]={
            ...current,
            name:current.name||row.name,
            defaultStart:row.default_start,
            defaultEnd:row.default_end,
            activeDays:(row.active_iso_weekdays||[]).map(isoToJsDay)
          };
        });
        next.shiftCatalog=Object.values(byId);
        next.recurringSchedules={};
        (config.profiles||[]).forEach(profile=>{
          next.recurringSchedules[profile.person_id]={
            personId:profile.person_id,
            fullName:profile.full_name,
            shiftId:profile.shift_id,
            replacesShiftDefault:profile.replaces_shift_default!==false,
            source:profile.source,
            note:profile.note,
            segments:(profile.segments||[]).map(segment=>({
              isoWeekday:Number(segment.iso_weekday),
              segmentOrder:Number(segment.segment_order||0),
              start:segment.start_time,
              end:segment.end_time,
              note:segment.note||null
            }))
          };
        });
      }
    }catch(e){}

    if(dateFrom&&dateTo){
      try{
        const params=new URLSearchParams({date_from:dateFrom,date_to:dateTo});
        const response=await fetch(`/api/v1/schedules/exceptions?${params.toString()}`,{credentials:'same-origin'});
        if(response.ok){
          const rows=await response.json();
          rows.forEach(row=>{
            const key=String(row.date||'');
            if(!next.scheduleOverrides[key])next.scheduleOverrides[key]={};
            const status=row.status||'off';
            next.scheduleOverrides[key][row.person_id]={
              off:status==='vacation'||status==='off',
              coverageStatus:status,
              start:row.start_time||undefined,
              end:row.end_time||undefined,
              note:row.note||undefined,
              source:'database'
            };
          });
        }
      }catch(e){}
    }
    return normalize(next);
  }

  function outBannerHTML(state,dateKey,options={}){
    const S=root.SiteScheduleLogic;
    if(!S)return '';
    const shiftIds=options.shiftIds||[];
    const wanted=new Set(shiftIds);
    const todayRows=(S.outToday?S.outToday(state,dateKey):[]).filter(row=>!wanted.size||wanted.has(row.shiftId));
    const dates=options.dates?.length?options.dates:weekDateKeys(dateKey);
    const weekRows=(S.outForDates?S.outForDates(state,dates,shiftIds):[]).filter(row=>row.dateKey!==dateKey);
    if(!todayRows.length&&!weekRows.length)return '';

    const chip=({person,label,shiftId,status},dateLabel='')=>{
      const shift=S.shiftDefinition(state,shiftId)?.name||'';
      return `<div class="out-person out-${esc(status)}"><div><strong>${esc(person.fullName||person.name)}</strong><small>${esc([dateLabel,shift].filter(Boolean).join(' • '))}</small></div><span>${esc(label)}</span></div>`;
    };
    const todayTitle=dateKey===todayKey()?'Out today':`Out ${fmtDate(dateKey,{weekday:'short'})}`;
    const todaySection=todayRows.length?`<div class="out-banner-section"><div class="out-banner-head"><div><span class="out-kicker">Availability</span><strong>${esc(todayTitle)}</strong></div><span class="out-count">${todayRows.length}</span></div><div class="out-people">${todayRows.map(row=>chip(row)).join('')}</div></div>`:'';
    const weekSection=weekRows.length?`<details class="out-week" open><summary><strong>Out this week</strong><span>${weekRows.length} absence${weekRows.length===1?'':'s'}</span></summary><div class="out-people">${weekRows.map(row=>chip(row,fmtDate(row.dateKey,{weekday:'short'}))).join('')}</div></details>`:'';
    return `<section class="out-banner" role="status" aria-label="Team availability">${todaySection}${weekSection}<p>These team members should not be relied on for normal coverage during the listed periods.</p></section>`;
  }
  root.SiteAppState={STORAGE_KEY,load,save,reset,normalize,todayKey,fmtDate,fmtRange,esc,addDays,weekDateKeys,hydrateScheduleData,outBannerHTML};
})(typeof globalThis!=='undefined'?globalThis:this);
