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
  function outBannerHTML(state,dateKey){
    const S=root.SiteScheduleLogic;
    const rows=S?.outToday ? S.outToday(state,dateKey) : [];
    if(!rows.length)return '';
    const today=dateKey===todayKey();
    const title=today?'Out today':`Out ${fmtDate(dateKey,{weekday:'short'})}`;
    const chips=rows.map(({person,label,shiftId,status})=>{
      const shift=S.shiftDefinition(state,shiftId)?.name||'';
      return `<div class="out-person out-${esc(status)}"><div><strong>${esc(person.fullName||person.name)}</strong><small>${esc(shift)}</small></div><span>${esc(label)}</span></div>`;
    }).join('');
    return `<section class="out-banner" role="status" aria-label="${esc(title)}"><div class="out-banner-head"><div><span class="out-kicker">Availability</span><strong>${esc(title)}</strong></div><span class="out-count">${rows.length}</span></div><div class="out-people">${chips}</div><p>These team members are not available for normal coverage on the selected day.</p></section>`;
  }
  root.SiteAppState={STORAGE_KEY,load,save,reset,normalize,todayKey,fmtDate,fmtRange,esc,outBannerHTML};
})(typeof globalThis!=='undefined'?globalThis:this);
