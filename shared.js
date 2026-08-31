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
  root.SiteAppState={STORAGE_KEY,load,save,reset,normalize,todayKey,fmtDate,fmtRange,esc};
})(typeof globalThis!=='undefined'?globalThis:this);
