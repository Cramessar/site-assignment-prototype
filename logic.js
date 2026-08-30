(function (root, factory) {
  const logic = factory();
  if (typeof module === 'object' && module.exports) module.exports = logic;
  root.SiteCoverageLogic = logic;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function peopleForShift(state, shift, activeOnly = false) {
    return state.people.filter(p => p.shift === shift && (!activeOnly || !p.vacation));
  }

  function assignmentOwners(state, shift, siteId, activeOnly = true) {
    return peopleForShift(state, shift, activeOnly)
      .filter(p => (state.assignments[p.id] || []).includes(siteId))
      .map(p => p.id);
  }

  function getDuplicates(state, shift) {
    return state.sites
      .map(site => ({ siteId: site.id, owners: assignmentOwners(state, shift, site.id, true) }))
      .filter(x => x.owners.length > 1);
  }

  function getMissingMorning(state) {
    return state.sites
      .filter(site => assignmentOwners(state, 'morning', site.id, true).length === 0)
      .map(site => site.id);
  }

  function getMorningCoveredCount(state) {
    return state.sites.length - getMissingMorning(state).length;
  }

  function ticketMap(state) {
    return Object.fromEntries(state.sites.map(s => [s.id, Number(s.tickets30) || 0]));
  }

  function totalTickets(state) {
    return state.sites.reduce((sum, site) => sum + (Number(site.tickets30) || 0), 0);
  }

  function activeAssignmentsForPerson(state, personId, phase = 'morning') {
    const person = state.people.find(p => p.id === personId);
    if (!person || person.vacation) return [];
    const assigned = state.assignments[personId] || [];
    if (phase === 'morning' || person.shift === 'mid') return assigned.slice();
    const midTaken = new Set(
      peopleForShift(state, 'mid', true).flatMap(p => state.assignments[p.id] || [])
    );
    return assigned.filter(siteId => !midTaken.has(siteId));
  }

  function effectiveOwners(state, siteId) {
    const midOwners = assignmentOwners(state, 'mid', siteId, true);
    if (midOwners.length) return midOwners;
    return assignmentOwners(state, 'morning', siteId, true);
  }

  function getEffectiveCoverage(state) {
    return state.sites.map(site => ({ siteId: site.id, owners: effectiveOwners(state, site.id) }));
  }

  function getEffectiveMissing(state) {
    return getEffectiveCoverage(state).filter(x => x.owners.length === 0).map(x => x.siteId);
  }

  function getEffectiveDuplicates(state) {
    return getEffectiveCoverage(state).filter(x => x.owners.length > 1);
  }

  function personStats(state, personId, phase = 'morning') {
    const sites = activeAssignmentsForPerson(state, personId, phase);
    const tickets = ticketMap(state);
    return {
      siteCount: sites.length,
      ticketLoad: sites.reduce((sum, id) => sum + (tickets[id] || 0), 0),
      sites
    };
  }


  function supportAdmins(state, activeOnly = false) {
    return (state.supportAdmins || []).filter(a => !activeOnly || !a.vacation);
  }

  function supportAdminById(state, adminId) {
    return (state.supportAdmins || []).find(a => a.id === adminId) || null;
  }

  function tsaOwnersForEngineer(state, engineerId, activeOnly = true) {
    return supportAdmins(state, activeOnly)
      .filter(a => ((state.tsaAssignments || {})[a.id] || []).includes(engineerId))
      .map(a => a.id);
  }

  function engineerSupportWeight(state, engineerId) {
    // Primary TSA pairings matter most during the 12-4 overlap, so use the
    // engineer's effective overlap ticket load as the support-weight signal.
    return Math.max(1, personStats(state, engineerId, 'midday').ticketLoad);
  }

  function rebalanceTsaAssignments(state) {
    const next = clone(state);
    const allAdmins = supportAdmins(next, false);
    const activeAdmins = supportAdmins(next, true);
    next.tsaAssignments = Object.fromEntries(allAdmins.map(a => [a.id, []]));
    if (!activeAdmins.length) return next;

    const loads = Object.fromEntries(activeAdmins.map(a => [a.id, 0]));
    const counts = Object.fromEntries(activeAdmins.map(a => [a.id, 0]));
    const shiftCounts = Object.fromEntries(activeAdmins.map(a => [a.id, { morning: 0, mid: 0 }]));

    // Spread each engineer shift across every available TSA before giving the
    // same TSA a second engineer from that shift. This creates the requested
    // mix/variety, then ticket load breaks ties for fairness.
    ['morning', 'mid'].forEach(shift => {
      const engineers = next.people
        .filter(p => !p.vacation && p.shift === shift)
        .sort((a, b) => (engineerSupportWeight(next, b.id) - engineerSupportWeight(next, a.id)) || a.name.localeCompare(b.name));

      engineers.forEach(engineer => {
        const admin = activeAdmins.slice().sort((a, b) =>
          (shiftCounts[a.id][shift] - shiftCounts[b.id][shift]) ||
          (loads[a.id] - loads[b.id]) ||
          (counts[a.id] - counts[b.id]) ||
          a.name.localeCompare(b.name)
        )[0];
        next.tsaAssignments[admin.id].push(engineer.id);
        shiftCounts[admin.id][shift] += 1;
        counts[admin.id] += 1;
        loads[admin.id] += engineerSupportWeight(next, engineer.id);
      });
    });

    return next;
  }

  function assignEngineerToTsa(state, adminId, engineerId) {
    const next = clone(state);
    const admin = supportAdminById(next, adminId);
    const engineer = next.people.find(p => p.id === engineerId);
    if (!admin || admin.vacation || !engineer || engineer.vacation) return next;
    next.tsaAssignments = next.tsaAssignments || {};
    supportAdmins(next, false).forEach(a => {
      next.tsaAssignments[a.id] = (next.tsaAssignments[a.id] || []).filter(id => id !== engineerId);
    });
    next.tsaAssignments[adminId] = next.tsaAssignments[adminId] || [];
    next.tsaAssignments[adminId].push(engineerId);
    return next;
  }

  function removeEngineerFromTsa(state, adminId, engineerId) {
    const next = clone(state);
    next.tsaAssignments = next.tsaAssignments || {};
    next.tsaAssignments[adminId] = (next.tsaAssignments[adminId] || []).filter(id => id !== engineerId);
    return next;
  }

  function chooseFallbackTsa(state, candidateIds, engineerShift) {
    if (!candidateIds.length) return [];
    const ranked = candidateIds.slice().sort((a, b) => {
      const aCount = ((state.tsaAssignments || {})[a] || []).filter(id => state.people.find(p => p.id === id)?.shift === engineerShift).length;
      const bCount = ((state.tsaAssignments || {})[b] || []).filter(id => state.people.find(p => p.id === id)?.shift === engineerShift).length;
      return (aCount - bCount) || String(a).localeCompare(String(b));
    });
    return [ranked[0]];
  }

  function tsaCoverageForEngineer(state, engineerId) {
    const engineer = state.people.find(p => p.id === engineerId);
    if (!engineer || engineer.vacation) return { primary: [], early: [], overlap: [], late: [] };
    const primary = tsaOwnersForEngineer(state, engineerId, true);
    const morningAdmins = supportAdmins(state, true).filter(a => a.shift === 'morning').map(a => a.id);
    const midAdmins = supportAdmins(state, true).filter(a => a.shift === 'mid').map(a => a.id);

    let early = [];
    let late = [];
    if (engineer.shift === 'morning') {
      early = primary.filter(id => morningAdmins.includes(id));
      if (!early.length) early = chooseFallbackTsa(state, morningAdmins, 'morning');
    } else {
      late = primary.filter(id => midAdmins.includes(id));
      if (!late.length) late = chooseFallbackTsa(state, midAdmins, 'mid');
    }

    return { primary, early, overlap: primary.slice(), late };
  }

  function tsaDiagnostics(state) {
    const activeEngineers = state.people.filter(p => !p.vacation);
    const duplicatePrimary = activeEngineers
      .map(p => ({ engineerId: p.id, owners: tsaOwnersForEngineer(state, p.id, true) }))
      .filter(x => x.owners.length > 1);
    const missingPrimary = activeEngineers
      .filter(p => tsaOwnersForEngineer(state, p.id, true).length === 0)
      .map(p => p.id);
    const uncoveredWindows = [];
    activeEngineers.forEach(p => {
      const c = tsaCoverageForEngineer(state, p.id);
      if (p.shift === 'morning' && !c.early.length) uncoveredWindows.push({ engineerId: p.id, window: '6am-12pm' });
      if (!c.overlap.length) uncoveredWindows.push({ engineerId: p.id, window: '12pm-4pm' });
      if (p.shift === 'mid' && !c.late.length) uncoveredWindows.push({ engineerId: p.id, window: '4pm-8pm' });
    });
    const loads = Object.fromEntries(supportAdmins(state, false).map(a => {
      const engineers = ((state.tsaAssignments || {})[a.id] || []).filter(id => !state.people.find(p => p.id === id)?.vacation);
      return [a.id, {
        engineerCount: engineers.length,
        supportLoad: engineers.reduce((sum, id) => sum + engineerSupportWeight(state, id), 0),
        morningCount: engineers.filter(id => state.people.find(p => p.id === id)?.shift === 'morning').length,
        midCount: engineers.filter(id => state.people.find(p => p.id === id)?.shift === 'mid').length
      }];
    }));
    return {
      activeEngineerCount: activeEngineers.length,
      coveredPrimaryCount: activeEngineers.length - missingPrimary.length,
      missingPrimary,
      duplicatePrimary,
      uncoveredWindows,
      loads
    };
  }

  function setTsaVacation(state, adminId, vacation) {
    const next = clone(state);
    const admin = supportAdminById(next, adminId);
    if (!admin) return next;
    admin.vacation = vacation;
    return rebalanceTsaAssignments(next);
  }

  function shiftStats(state, shift) {
    const active = peopleForShift(state, shift, true);
    const vacation = peopleForShift(state, shift, false).filter(p => p.vacation);
    const duplicates = getDuplicates(state, shift);
    return { activeCount: active.length, vacationCount: vacation.length, duplicateCount: duplicates.length };
  }

  function overlapStats(state) {
    let morningTickets = 0;
    let midTickets = 0;
    let uncoveredTickets = 0;
    let morningSites = 0;
    let midSites = 0;
    let uncoveredSites = 0;

    state.sites.forEach(site => {
      const tickets = Number(site.tickets30) || 0;
      const mid = assignmentOwners(state, 'mid', site.id, true);
      const morning = assignmentOwners(state, 'morning', site.id, true);
      if (mid.length) {
        midTickets += tickets;
        midSites += 1;
      } else if (morning.length) {
        morningTickets += tickets;
        morningSites += 1;
      } else {
        uncoveredTickets += tickets;
        uncoveredSites += 1;
      }
    });

    const total = totalTickets(state);
    return {
      totalTickets: total,
      morningTickets,
      midTickets,
      uncoveredTickets,
      morningSites,
      midSites,
      uncoveredSites,
      morningPct: total ? morningTickets / total : 0,
      midPct: total ? midTickets / total : 0
    };
  }

  function rules(state) {
    return Object.assign({
      overlapMorningTarget: 0.60,
      overlapMidTarget: 0.40,
      lockedMorningAssignments: [{ personId: 'morning-carolyn', siteId: 'BRK - 6020' }],
      protectedOverlapSites: ['BRK - 6020']
    }, state.rules || {});
  }

  function isLockedMorningAssignment(state, personId, siteId) {
    return rules(state).lockedMorningAssignments.some(x => x.personId === personId && x.siteId === siteId);
  }

  function lockedOwnerForSite(state, siteId) {
    const lock = rules(state).lockedMorningAssignments.find(x => x.siteId === siteId);
    if (!lock) return null;
    const person = state.people.find(p => p.id === lock.personId);
    return person && !person.vacation ? person.id : null;
  }

  function addAssignment(state, personId, siteId) {
    const next = clone(state);
    const person = next.people.find(p => p.id === personId);
    if (!person || person.vacation || !next.sites.some(s => s.id === siteId)) return next;

    const lockedOwner = lockedOwnerForSite(next, siteId);
    if (lockedOwner && person.shift === 'morning' && lockedOwner !== personId) return next;
    if (rules(next).protectedOverlapSites.includes(siteId) && person.shift === 'mid') return next;

    next.assignments[personId] = next.assignments[personId] || [];
    if (!next.assignments[personId].includes(siteId)) next.assignments[personId].push(siteId);
    if (person.shift === 'mid') next.middayPool = (next.middayPool || []).filter(x => x !== siteId);
    return rebalanceTsaAssignments(next);
  }

  function removeAssignment(state, personId, siteId) {
    const next = clone(state);
    const person = next.people.find(p => p.id === personId);
    if (person && !person.vacation && isLockedMorningAssignment(next, personId, siteId)) return next;

    next.assignments[personId] = (next.assignments[personId] || []).filter(x => x !== siteId);
    if (person && person.shift === 'mid' && !next.middayPool.includes(siteId)) next.middayPool.push(siteId);
    return rebalanceTsaAssignments(next);
  }

  function scoreLoads(loads, ids) {
    if (!ids.length) return [0, 0, 0];
    const values = ids.map(id => loads[id] || 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDeviation = Math.max(...values.map(v => Math.abs(v - avg)));
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0);
    const spread = Math.max(...values) - Math.min(...values);
    return [maxDeviation, variance, spread];
  }

  function scoreLess(a, b) {
    for (let i = 0; i < a.length; i += 1) {
      if (Math.abs(a[i] - b[i]) < 1e-9) continue;
      return a[i] < b[i];
    }
    return false;
  }

  function balanceItems(items, peopleIds, baseLoads = {}) {
    const bins = Object.fromEntries(peopleIds.map(id => [id, []]));
    const loads = Object.fromEntries(peopleIds.map(id => [id, Number(baseLoads[id]) || 0]));
    if (!peopleIds.length) return { bins, loads };

    const sorted = items.slice().sort((a, b) => (b.tickets30 - a.tickets30) || a.id.localeCompare(b.id));
    sorted.forEach(item => {
      const personId = peopleIds.slice().sort((a, b) =>
        (loads[a] - loads[b]) || (bins[a].length - bins[b].length) || a.localeCompare(b)
      )[0];
      bins[personId].push(item);
      loads[personId] += Number(item.tickets30) || 0;
    });

    // Small local-search pass. With 38 sites this is cheap, and it materially
    // improves fairness when there are 3-4 people sharing an irregular site mix.
    let changed = true;
    let passes = 0;
    while (changed && passes < 100) {
      changed = false;
      passes += 1;
      let bestScore = scoreLoads(loads, peopleIds);
      let bestMove = null;

      peopleIds.forEach(from => {
        bins[from].forEach((item, itemIndex) => {
          peopleIds.forEach(to => {
            if (from === to) return;
            const w = Number(item.tickets30) || 0;
            const candidateLoads = Object.assign({}, loads, {
              [from]: loads[from] - w,
              [to]: loads[to] + w
            });
            const candidateScore = scoreLoads(candidateLoads, peopleIds);
            if (scoreLess(candidateScore, bestScore)) {
              bestScore = candidateScore;
              bestMove = { type: 'move', from, to, itemIndex };
            }
          });
        });
      });

      for (let i = 0; i < peopleIds.length; i += 1) {
        for (let j = i + 1; j < peopleIds.length; j += 1) {
          const left = peopleIds[i];
          const right = peopleIds[j];
          bins[left].forEach((a, ai) => {
            bins[right].forEach((b, bi) => {
              const aw = Number(a.tickets30) || 0;
              const bw = Number(b.tickets30) || 0;
              const candidateLoads = Object.assign({}, loads, {
                [left]: loads[left] - aw + bw,
                [right]: loads[right] - bw + aw
              });
              const candidateScore = scoreLoads(candidateLoads, peopleIds);
              if (scoreLess(candidateScore, bestScore)) {
                bestScore = candidateScore;
                bestMove = { type: 'swap', left, right, ai, bi };
              }
            });
          });
        }
      }

      if (bestMove) {
        changed = true;
        if (bestMove.type === 'move') {
          const item = bins[bestMove.from].splice(bestMove.itemIndex, 1)[0];
          const w = Number(item.tickets30) || 0;
          bins[bestMove.to].push(item);
          loads[bestMove.from] -= w;
          loads[bestMove.to] += w;
        } else {
          const a = bins[bestMove.left][bestMove.ai];
          const b = bins[bestMove.right][bestMove.bi];
          const aw = Number(a.tickets30) || 0;
          const bw = Number(b.tickets30) || 0;
          bins[bestMove.left][bestMove.ai] = b;
          bins[bestMove.right][bestMove.bi] = a;
          loads[bestMove.left] = loads[bestMove.left] - aw + bw;
          loads[bestMove.right] = loads[bestMove.right] - bw + aw;
        }
      }
    }

    return { bins, loads };
  }

  function chooseMiddaySites(state) {
    const r = rules(state);
    const total = totalTickets(state);
    const target = total * r.overlapMidTarget;
    const targetCount = Math.round(state.sites.length * r.overlapMidTarget);
    const protectedSites = new Set(r.protectedOverlapSites || []);
    const eligible = state.sites.filter(site => !protectedSites.has(site.id));

    // Subset-sum over integer ticket counts. We first optimize for workload target,
    // then prefer a site count close to the same 40% proportion.
    let dp = new Map([[0, []]]);
    eligible.forEach((site, index) => {
      const snapshot = Array.from(dp.entries());
      snapshot.forEach(([sum, subset]) => {
        const nextSum = sum + (Number(site.tickets30) || 0);
        const candidate = subset.concat(index);
        const existing = dp.get(nextSum);
        if (!existing || Math.abs(candidate.length - targetCount) < Math.abs(existing.length - targetCount)) {
          dp.set(nextSum, candidate);
        }
      });
    });

    let best = { sum: 0, subset: [], score: [Infinity, Infinity] };
    dp.forEach((subset, sum) => {
      const candidateScore = [Math.abs(sum - target), Math.abs(subset.length - targetCount)];
      if (scoreLess(candidateScore, best.score)) best = { sum, subset, score: candidateScore };
    });
    return best.subset.map(i => eligible[i].id);
  }

  function rebalanceAssignments(state) {
    const next = clone(state);
    const activeMorning = peopleForShift(next, 'morning', true).map(p => p.id);
    const activeMid = peopleForShift(next, 'mid', true).map(p => p.id);
    const ticketById = ticketMap(next);

    next.people.forEach(p => { next.assignments[p.id] = []; });
    next.middayPool = [];

    if (!activeMorning.length) return rebalanceTsaAssignments(next);

    const middaySiteIds = activeMid.length ? chooseMiddaySites(next) : [];
    const middaySet = new Set(middaySiteIds);
    const retainedItems = next.sites.filter(site => !middaySet.has(site.id));
    const takeoverItems = next.sites.filter(site => middaySet.has(site.id));

    const retainedBaseLoads = Object.fromEntries(activeMorning.map(id => [id, 0]));
    const retainedBaseBins = Object.fromEntries(activeMorning.map(id => [id, []]));
    const remainingRetained = [];

    retainedItems.forEach(site => {
      const lockedOwner = lockedOwnerForSite(next, site.id);
      if (lockedOwner && activeMorning.includes(lockedOwner)) {
        retainedBaseBins[lockedOwner].push(site);
        retainedBaseLoads[lockedOwner] += ticketById[site.id] || 0;
      } else {
        remainingRetained.push(site);
      }
    });

    const retainedBalanced = balanceItems(remainingRetained, activeMorning, retainedBaseLoads);
    activeMorning.forEach(personId => {
      const retained = retainedBaseBins[personId].concat(retainedBalanced.bins[personId] || []);
      next.assignments[personId] = retained.map(site => site.id);
    });

    const takeoverForMorning = balanceItems(takeoverItems, activeMorning, retainedBalanced.loads);
    activeMorning.forEach(personId => {
      next.assignments[personId].push(...(takeoverForMorning.bins[personId] || []).map(site => site.id));
    });

    if (activeMid.length) {
      const takeoverForMid = balanceItems(takeoverItems, activeMid);
      activeMid.forEach(personId => {
        next.assignments[personId] = (takeoverForMid.bins[personId] || []).map(site => site.id);
      });
    }

    return rebalanceTsaAssignments(next);
  }

  function setVacation(state, personId, vacation) {
    const next = clone(state);
    const person = next.people.find(p => p.id === personId);
    if (!person) return next;
    person.vacation = vacation;
    return rebalanceAssignments(next);
  }

  function diagnostics(state) {
    const overlap = overlapStats(state);
    const r = rules(state);
    return {
      totalSites: state.sites.length,
      totalTickets: totalTickets(state),
      morningCovered: getMorningCoveredCount(state),
      morningMissing: getMissingMorning(state),
      morningDuplicates: getDuplicates(state, 'morning'),
      midDuplicates: getDuplicates(state, 'mid'),
      effectiveMissing: getEffectiveMissing(state),
      effectiveDuplicates: getEffectiveDuplicates(state),
      middayTakeovers: new Set(peopleForShift(state, 'mid', true).flatMap(p => state.assignments[p.id] || [])).size,
      vacationCount: state.people.filter(p => p.vacation).length,
      middayPool: (state.middayPool || []).slice(),
      overlap,
      targetMorningPct: r.overlapMorningTarget,
      targetMidPct: r.overlapMidTarget,
      targetMorningTickets: Math.round(overlap.totalTickets * r.overlapMorningTarget),
      targetMidTickets: Math.round(overlap.totalTickets * r.overlapMidTarget),
      tsa: tsaDiagnostics(state)
    };
  }

  return {
    clone,
    peopleForShift,
    assignmentOwners,
    getDuplicates,
    getMissingMorning,
    getMorningCoveredCount,
    totalTickets,
    activeAssignmentsForPerson,
    effectiveOwners,
    getEffectiveCoverage,
    getEffectiveMissing,
    getEffectiveDuplicates,
    personStats,
    supportAdmins,
    supportAdminById,
    tsaOwnersForEngineer,
    engineerSupportWeight,
    rebalanceTsaAssignments,
    assignEngineerToTsa,
    removeEngineerFromTsa,
    tsaCoverageForEngineer,
    tsaDiagnostics,
    setTsaVacation,
    shiftStats,
    overlapStats,
    rules,
    isLockedMorningAssignment,
    addAssignment,
    removeAssignment,
    balanceItems,
    chooseMiddaySites,
    rebalanceAssignments,
    setVacation,
    diagnostics
  };
});
