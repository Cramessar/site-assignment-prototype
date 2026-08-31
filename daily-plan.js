(function (root, factory) {
  const api = factory(
    root.SiteCoverageLogic || (typeof require === 'function' ? require('./logic.js') : null),
    root.SiteScheduleLogic || (typeof require === 'function' ? require('./schedule.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DailyPlanLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, S) {
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function siteById(state, id) { return (state.sites || []).find(s => s.id === id) || null; }
  function personById(state, id) { return (state.people || []).find(p => p.id === id) || null; }
  function adminById(state, id) { return (state.supportAdmins || []).find(p => p.id === id) || null; }
  function tickets(state, siteId) { return Number(siteById(state, siteId)?.tickets30) || 0; }

  function assignmentLocks(state) {
    const configured = state?.rules?.assignmentLocks;
    const fallback = state?.rules?.lockedMorningAssignments || [];
    const raw = Array.isArray(configured) && configured.length ? configured : fallback;
    return raw.map((x, i) => ({ id: x.id || `lock-${i}-${x.personId}-${x.siteId}`, personId: x.personId, siteId: x.siteId }));
  }

  function operationalRange(state) {
    const defaults = S.scheduleRules(state);
    const starts = Object.values(defaults).map(x => S.timeToMinutes(x.start)).filter(Number.isFinite);
    const ends = Object.values(defaults).map(x => S.timeToMinutes(x.end)).filter(Number.isFinite);
    return { start: Math.min(...starts), end: Math.max(...ends) };
  }

  function activeEngineerIds(state, dateKey, start, end) {
    return (state.people || []).filter(person => {
      const interval = S.intervalForCoverage(S.getShift(state, person.id, dateKey));
      return interval && interval.start <= start && interval.end >= end;
    }).map(p => p.id);
  }

  function activeAdminIds(state, dateKey, start, end) {
    return (state.supportAdmins || []).filter(admin => {
      const interval = S.intervalForCoverage(S.getShift(state, admin.id, dateKey));
      return interval && interval.start <= start && interval.end >= end;
    }).map(a => a.id);
  }

  function scheduleFingerprint(state, dateKey) {
    const rows = [...(state.people || []), ...(state.supportAdmins || [])].map(p => {
      const shift = S.getShift(state, p.id, dateKey);
      return [p.id, shift.start, shift.end, shift.off, shift.vacation, shift.coverageStatus || 'working'].join(':');
    });
    const locks = assignmentLocks(state).map(x => `${x.personId}:${x.siteId}`).sort();
    return JSON.stringify({ rows, locks, target: L.rules(state).overlapMidTarget });
  }

  function windowsForDate(state, dateKey) {
    const range = operationalRange(state);
    const boundaries = new Set([range.start, range.end]);
    (state.people || []).forEach(person => {
      const interval = S.intervalForShift(S.getShift(state, person.id, dateKey));
      if (!interval) return;
      if (interval.end <= range.start || interval.start >= range.end) return;
      boundaries.add(Math.max(range.start, interval.start));
      boundaries.add(Math.min(range.end, interval.end));
    });
    const points = Array.from(boundaries).sort((a, b) => a - b);
    const windows = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      if (points[i + 1] <= points[i]) continue;
      windows.push({ start: points[i], end: points[i + 1] });
    }
    return windows;
  }

  function distributeItems(state, items, peopleIds, activeIds, lockedSiteIds = new Set()) {
    const bins = Object.fromEntries(peopleIds.map(id => [id, []]));
    const baseLoads = Object.fromEntries(peopleIds.map(id => [id, 0]));
    const free = [];
    const locks = assignmentLocks(state);
    items.forEach(site => {
      const lock = locks.find(x => x.siteId === site.id && activeIds.includes(x.personId) && peopleIds.includes(x.personId));
      if (lock) {
        bins[lock.personId].push(site);
        baseLoads[lock.personId] += Number(site.tickets30) || 0;
        lockedSiteIds.add(site.id);
      } else free.push(site);
    });
    const balanced = L.balanceItems(free, peopleIds, baseLoads);
    peopleIds.forEach(id => bins[id].push(...(balanced.bins[id] || [])));
    return bins;
  }

  function splitForOverlap(state, activeMorning, activeMid) {
    const protectedSites = new Set();
    assignmentLocks(state).forEach(lock => {
      if (activeMorning.includes(lock.personId)) protectedSites.add(lock.siteId);
    });
    const temp = clone(state);
    temp.rules = Object.assign({}, temp.rules || {}, {
      protectedOverlapSites: Array.from(new Set([...(L.rules(state).protectedOverlapSites || []), ...protectedSites]))
    });
    return new Set(L.chooseMiddaySites(temp));
  }

  function siteAssignmentsForWindow(state, activeIds) {
    const activeMorning = activeIds.filter(id => personById(state, id)?.shift === 'morning');
    const activeMid = activeIds.filter(id => personById(state, id)?.shift === 'mid');
    const siteOwners = {};
    const personSites = Object.fromEntries(activeIds.map(id => [id, []]));
    const locked = new Set();
    if (!activeIds.length) return { siteOwners, personSites, activeMorning, activeMid, lockedSites: [] };

    if (activeMorning.length && activeMid.length) {
      const midSet = splitForOverlap(state, activeMorning, activeMid);
      const morningItems = state.sites.filter(site => !midSet.has(site.id));
      const midItems = state.sites.filter(site => midSet.has(site.id));
      const morningBins = distributeItems(state, morningItems, activeMorning, activeIds, locked);
      const midBins = distributeItems(state, midItems, activeMid, activeIds, locked);
      activeMorning.forEach(id => { personSites[id] = morningBins[id].map(s => s.id); });
      activeMid.forEach(id => { personSites[id] = midBins[id].map(s => s.id); });
    } else {
      const ids = activeMorning.length ? activeMorning : activeMid;
      const bins = distributeItems(state, state.sites, ids, activeIds, locked);
      ids.forEach(id => { personSites[id] = bins[id].map(s => s.id); });
    }

    Object.entries(personSites).forEach(([personId, siteIds]) => siteIds.forEach(siteId => { siteOwners[siteId] = personId; }));
    return { siteOwners, personSites, activeMorning, activeMid, lockedSites: Array.from(locked) };
  }

  function tsaAssignmentsForWindow(state, activeEngineerIdsList, activeAdminIdsList) {
    const tsaByEngineer = {};
    const loads = Object.fromEntries(activeAdminIdsList.map(id => [id, { count: 0, weight: 0 }]));
    activeEngineerIdsList.slice().sort((a, b) => L.engineerSupportWeight(state, b) - L.engineerSupportWeight(state, a)).forEach(engineerId => {
      if (!activeAdminIdsList.length) { tsaByEngineer[engineerId] = null; return; }
      const primary = L.tsaOwnersForEngineer(state, engineerId, false)[0];
      let choices = activeAdminIdsList.slice();
      if (primary && choices.includes(primary)) {
        const primaryLoad = loads[primary];
        const minCount = Math.min(...choices.map(id => loads[id].count));
        if (primaryLoad.count <= minCount + 1) choices = [primary];
      }
      const selected = choices.sort((a, b) => (loads[a].count - loads[b].count) || (loads[a].weight - loads[b].weight) || a.localeCompare(b))[0];
      tsaByEngineer[engineerId] = selected;
      loads[selected].count += 1;
      loads[selected].weight += L.engineerSupportWeight(state, engineerId);
    });
    return { tsaByEngineer, loads };
  }

  function generatePlan(state, dateKey) {
    const windows = windowsForDate(state, dateKey).map((raw, index) => {
      const activeEngineers = activeEngineerIds(state, dateKey, raw.start, raw.end);
      const activeAdmins = activeAdminIds(state, dateKey, raw.start, raw.end);
      const sites = siteAssignmentsForWindow(state, activeEngineers);
      const tsa = tsaAssignmentsForWindow(state, activeEngineers, activeAdmins);
      return {
        id: `w${index}-${raw.start}-${raw.end}`,
        start: raw.start,
        end: raw.end,
        activeEngineers,
        activeAdmins,
        siteOwners: sites.siteOwners,
        personSites: sites.personSites,
        activeMorning: sites.activeMorning,
        activeMid: sites.activeMid,
        lockedSites: sites.lockedSites,
        tsaByEngineer: tsa.tsaByEngineer
      };
    });
    return {
      dateKey,
      generatedAt: new Date().toISOString(),
      scheduleFingerprint: scheduleFingerprint(state, dateKey),
      windows
    };
  }

  function appliedPlan(state, dateKey) { return state?.dailyPlans?.[dateKey] || null; }
  function effectivePlan(state, dateKey) { return appliedPlan(state, dateKey) || generatePlan(state, dateKey); }
  function isPlanStale(state, dateKey, plan) { return !plan || plan.scheduleFingerprint !== scheduleFingerprint(state, dateKey); }

  function windowSplit(state, window) {
    let morningTickets = 0, midTickets = 0;
    Object.entries(window.siteOwners || {}).forEach(([siteId, ownerId]) => {
      const owner = personById(state, ownerId);
      if (owner?.shift === 'morning') morningTickets += tickets(state, siteId);
      if (owner?.shift === 'mid') midTickets += tickets(state, siteId);
    });
    const total = morningTickets + midTickets;
    return { morningTickets, midTickets, morningPct: total ? morningTickets / total : 0, midPct: total ? midTickets / total : 0 };
  }

  function coverageHealth(state, plan) {
    const issues = [];
    const warnings = [];
    const totalSites = (state.sites || []).length;
    const target = L.rules(state).overlapMidTarget;
    (plan?.windows || []).forEach(window => {
      const label = `${S.formatTime(S.minutesToTime(window.start))}–${S.formatTime(S.minutesToTime(window.end))}`;
      const covered = Object.keys(window.siteOwners || {}).length;
      if (!window.activeEngineers.length) issues.push(`${label}: no engineers scheduled`);
      else if (covered !== totalSites) issues.push(`${label}: ${totalSites - covered} site${totalSites-covered===1?'':'s'} uncovered`);
      window.activeEngineers.forEach(engineerId => {
        if (!window.tsaByEngineer?.[engineerId]) issues.push(`${label}: ${personById(state, engineerId)?.name || engineerId} has no TSA`);
      });
      assignmentLocks(state).forEach(lock => {
        if (window.activeEngineers.includes(lock.personId) && window.siteOwners?.[lock.siteId] !== lock.personId) {
          issues.push(`${label}: lock ${lock.siteId} → ${personById(state, lock.personId)?.name || lock.personId} not honored`);
        }
      });
      if (window.activeMorning.length && window.activeMid.length) {
        const split = windowSplit(state, window);
        if (Math.abs(split.midPct - target) > .03) warnings.push(`${label}: workload split is ${Math.round(split.morningPct*100)}/${Math.round(split.midPct*100)}`);
      }
    });
    return { ok: !issues.length, issues, warnings, status: issues.length ? 'red' : warnings.length ? 'yellow' : 'green' };
  }

  function handoffs(state, plan) {
    const out = [];
    const windows = plan?.windows || [];
    for (let i = 1; i < windows.length; i += 1) {
      const prev = windows[i - 1], next = windows[i];
      const siteGroups = new Map();
      (state.sites || []).forEach(site => {
        const from = prev.siteOwners?.[site.id] || null;
        const to = next.siteOwners?.[site.id] || null;
        if (from === to) return;
        const key = `${from || 'uncovered'}>${to || 'uncovered'}`;
        if (!siteGroups.has(key)) siteGroups.set(key, { from, to, sites: [] });
        siteGroups.get(key).sites.push(site.id);
      });
      const tsaChanges = [];
      const engineerIds = new Set([...Object.keys(prev.tsaByEngineer || {}), ...Object.keys(next.tsaByEngineer || {})]);
      engineerIds.forEach(engineerId => {
        const from = prev.tsaByEngineer?.[engineerId] || null;
        const to = next.tsaByEngineer?.[engineerId] || null;
        if (from !== to) tsaChanges.push({ engineerId, from, to });
      });
      if (siteGroups.size || tsaChanges.length) out.push({ at: next.start, siteGroups: Array.from(siteGroups.values()), tsaChanges });
    }
    return out;
  }

  function planDiff(state, fromPlan, toPlan) {
    if (!fromPlan) return { firstPlan: true, siteChanges: (toPlan?.windows || []).reduce((sum,w)=>sum+Object.keys(w.siteOwners||{}).length,0), tsaChanges: 0, windowChanges: toPlan?.windows?.length || 0, details: [] };
    const fromWindows = fromPlan.windows || [], toWindows = toPlan.windows || [];
    const boundaries = new Set([...fromWindows.flatMap(w => [w.start,w.end]), ...toWindows.flatMap(w => [w.start,w.end])]);
    const points = Array.from(boundaries).sort((a,b)=>a-b);
    const ownerAt = (plan, minute, siteId) => (plan.windows || []).find(w => w.start <= minute && w.end > minute)?.siteOwners?.[siteId] || null;
    const tsaAt = (plan, minute, engineerId) => (plan.windows || []).find(w => w.start <= minute && w.end > minute)?.tsaByEngineer?.[engineerId] || null;
    let siteChanges = 0, tsaChanges = 0;
    const details = [];
    for (let i=0;i<points.length-1;i+=1) {
      if (points[i+1] <= points[i]) continue;
      const minute = points[i];
      const changedSites = (state.sites || []).filter(site => ownerAt(fromPlan,minute,site.id) !== ownerAt(toPlan,minute,site.id));
      const changedTsa = (state.people || []).filter(p => tsaAt(fromPlan,minute,p.id) !== tsaAt(toPlan,minute,p.id));
      siteChanges += changedSites.length;
      tsaChanges += changedTsa.length;
      if ((changedSites.length || changedTsa.length) && details.length < 8) details.push({ start: points[i], end: points[i+1], sites: changedSites.length, tsa: changedTsa.length });
    }
    return { firstPlan: false, siteChanges, tsaChanges, windowChanges: Math.abs(fromWindows.length-toWindows.length), details };
  }

  function fairnessRecord(state, plan) {
    const record = {};
    (state.people || []).forEach(p => { record[p.id] = { weightedHours: 0, siteHours: 0 }; });
    (plan?.windows || []).forEach(window => {
      const hours = (window.end - window.start) / 60;
      Object.entries(window.personSites || {}).forEach(([personId, siteIds]) => {
        const load = siteIds.reduce((sum, siteId) => sum + tickets(state, siteId), 0);
        if (!record[personId]) record[personId] = { weightedHours: 0, siteHours: 0 };
        record[personId].weightedHours += load * hours;
        record[personId].siteHours += siteIds.length * hours;
      });
    });
    return record;
  }

  function withAppliedPlan(state, dateKey, plan) {
    const next = clone(state);
    if (!next.dailyPlans) next.dailyPlans = {};
    if (!next.fairnessHistory) next.fairnessHistory = {};
    next.dailyPlans[dateKey] = clone(plan);
    next.dailyPlans[dateKey].appliedAt = new Date().toISOString();
    next.fairnessHistory[dateKey] = fairnessRecord(next, plan);
    return next;
  }

  function dateDistance(a, b) {
    const pa = String(a).split('-').map(Number), pb = String(b).split('-').map(Number);
    return Math.round((Date.UTC(pb[0],pb[1]-1,pb[2]) - Date.UTC(pa[0],pa[1]-1,pa[2])) / 86400000);
  }

  function fairnessSummary(state, endDateKey, days) {
    const totals = Object.fromEntries((state.people || []).map(p => [p.id, { weightedHours: 0, siteHours: 0, days: 0 }]));
    Object.entries(state.fairnessHistory || {}).forEach(([dateKey, record]) => {
      const delta = dateDistance(dateKey, endDateKey);
      if (delta < 0 || delta >= days) return;
      Object.entries(record || {}).forEach(([personId, values]) => {
        if (!totals[personId]) return;
        totals[personId].weightedHours += Number(values.weightedHours) || 0;
        totals[personId].siteHours += Number(values.siteHours) || 0;
        totals[personId].days += 1;
      });
    });
    return totals;
  }

  function normalizeState(state) {
    const next = clone(state);
    next.dailyPlans = next.dailyPlans || {};
    next.dailyNotes = next.dailyNotes || {};
    next.fairnessHistory = next.fairnessHistory || {};
    next.changeHistory = next.changeHistory || [];
    next.rules = next.rules || {};
    if (!Array.isArray(next.rules.assignmentLocks) || !next.rules.assignmentLocks.length) {
      next.rules.assignmentLocks = assignmentLocks(next);
    }
    return next;
  }

  function addLock(state, personId, siteId) {
    const next = normalizeState(state);
    if (!personById(next, personId) || !siteById(next, siteId)) return next;
    next.rules.assignmentLocks = next.rules.assignmentLocks.filter(x => x.siteId !== siteId);
    next.rules.assignmentLocks.push({ id: `lock-${Date.now()}-${siteId.replace(/[^a-z0-9]/gi,'').toLowerCase()}`, personId, siteId });
    next.rules.lockedMorningAssignments = next.rules.assignmentLocks.map(x => ({ personId: x.personId, siteId: x.siteId }));
    return L.rebalanceAssignments(next);
  }

  function removeLock(state, lockId) {
    const next = normalizeState(state);
    next.rules.assignmentLocks = next.rules.assignmentLocks.filter(x => x.id !== lockId);
    next.rules.lockedMorningAssignments = next.rules.assignmentLocks.map(x => ({ personId: x.personId, siteId: x.siteId }));
    return L.rebalanceAssignments(next);
  }

  function setDailyNote(state, dateKey, note) {
    const next = normalizeState(state);
    next.dailyNotes[dateKey] = next.dailyNotes[dateKey] || { general: '', people: {} };
    next.dailyNotes[dateKey].general = String(note || '');
    return next;
  }

  function setPersonNote(state, dateKey, personId, note) {
    const next = normalizeState(state);
    next.dailyNotes[dateKey] = next.dailyNotes[dateKey] || { general: '', people: {} };
    next.dailyNotes[dateKey].people = next.dailyNotes[dateKey].people || {};
    if (String(note || '').trim()) next.dailyNotes[dateKey].people[personId] = String(note).trim();
    else delete next.dailyNotes[dateKey].people[personId];
    return next;
  }

  function notesForDate(state, dateKey) {
    return state?.dailyNotes?.[dateKey] || { general: '', people: {} };
  }

  return {
    clone, assignmentLocks, operationalRange, windowsForDate, scheduleFingerprint, generatePlan,
    appliedPlan, effectivePlan, isPlanStale, windowSplit, coverageHealth, handoffs, planDiff,
    fairnessRecord, withAppliedPlan, fairnessSummary, normalizeState, addLock, removeLock,
    setDailyNote, setPersonNote, notesForDate, personById, adminById
  };
});
