const assert = require('assert');
const seed = require('./data.js');
const L = require('./logic.js');
const S = require('./schedule.js');
const DP = require('./daily-plan.js');

assert.strictEqual(seed.sites.length, 38, 'Expected 38 sites from workbook');
assert.strictEqual(L.totalTickets(seed), 1926, 'Expected 1,926 tickets from workbook');
assert.deepStrictEqual(seed.people.filter(p => p.vacation).map(p => p.name).sort(), ['Bryan', 'David'], 'David and Bryan should start on vacation');
assert.deepStrictEqual(seed.supportAdmins.map(a => a.name).sort(), ['Amin', 'Ola', 'Ryan'], 'Expected three TSAs');
assert.strictEqual(seed.people.find(p => p.name === 'Youssef').role, 'tce');
assert.strictEqual(seed.people.find(p => p.name === 'Carolyn').role, 'tse');
assert.strictEqual(seed.people.find(p => p.name === 'Garett').role, 'tce');

const balanced = L.rebalanceAssignments(seed);
const d = L.diagnostics(balanced);
assert.deepStrictEqual(d.morningMissing, [], 'Balanced schedule should cover every site from 6-12');
assert.deepStrictEqual(d.morningDuplicates, [], 'Balanced schedule should remove morning duplicates');
assert.deepStrictEqual(d.midDuplicates, [], 'Balanced schedule should avoid midday duplicates');
assert.deepStrictEqual(d.effectiveMissing, [], 'Balanced overlap should cover all sites');
assert.strictEqual(d.overlap.midTickets, 770, 'Midday should receive approximately 40% of 1,926 tickets');
assert.strictEqual(d.overlap.morningTickets, 1156, 'Morning should retain approximately 60% of 1,926 tickets');
assert.ok(Math.abs(d.overlap.midPct - 0.40) < 0.001, 'Midday split should be essentially 40%');
assert.ok(balanced.assignments['morning-carolyn'].includes('BRK - 6020'), 'Carolyn must own BRK when active');
assert.strictEqual(L.assignmentOwners(balanced, 'mid', 'BRK - 6020', true).length, 0, 'BRK should not be handed to midday');

const morningOverlapLoads = L.peopleForShift(balanced, 'morning', true).map(p => L.personStats(balanced, p.id, 'midday').ticketLoad);
const midOverlapLoads = L.peopleForShift(balanced, 'mid', true).map(p => L.personStats(balanced, p.id, 'midday').ticketLoad);
assert.ok(Math.max(...morningOverlapLoads) - Math.min(...morningOverlapLoads) <= 10, 'Active morning overlap loads should be tightly balanced');
assert.ok(Math.max(...midOverlapLoads) - Math.min(...midOverlapLoads) <= 10, 'Active midday loads should be tightly balanced');

// TSA layer: every active engineer gets exactly one primary pairing and full real-time coverage.
const td = L.tsaDiagnostics(balanced);
assert.strictEqual(td.activeEngineerCount, 8, 'David and Bryan are out, leaving eight active engineers');
assert.strictEqual(td.coveredPrimaryCount, 8, 'Every active engineer should have primary TSA coverage');
assert.deepStrictEqual(td.missingPrimary, [], 'No active engineer should miss a primary TSA');
assert.deepStrictEqual(td.duplicatePrimary, [], 'Each active engineer should have one primary TSA');
assert.deepStrictEqual(td.uncoveredWindows, [], 'Every active engineer should have TSA coverage throughout their shift');

L.supportAdmins(balanced, true).forEach(admin => {
  const load = td.loads[admin.id];
  assert.ok(load.engineerCount >= 2, `${admin.name} should support multiple engineers`);
  assert.ok(load.morningCount >= 1, `${admin.name} should have at least one morning engineer`);
  assert.ok(load.midCount >= 1, `${admin.name} should have at least one midday engineer`);
});

balanced.people.filter(p => !p.vacation).forEach(engineer => {
  assert.strictEqual(L.tsaOwnersForEngineer(balanced, engineer.id, true).length, 1, `${engineer.name} should have one primary TSA`);
});

// David returning should get sites and a TSA pairing immediately.
const davidBack = L.setVacation(balanced, 'morning-david', false);
assert.strictEqual(davidBack.people.find(p => p.id === 'morning-david').vacation, false, 'David should be active');
assert.ok(davidBack.assignments['morning-david'].length > 0, 'Returning from vacation should automatically receive sites');
assert.strictEqual(L.tsaOwnersForEngineer(davidBack, 'morning-david', true).length, 1, 'Returning engineer should automatically receive a TSA');
assert.deepStrictEqual(L.getMissingMorning(davidBack), [], 'Returning person rebalance should retain full morning coverage');
assert.ok(davidBack.assignments['morning-carolyn'].includes('BRK - 6020'), 'Carolyn should keep BRK after rebalance');

const bryanBack = L.setVacation(davidBack, 'mid-bryan', false);
assert.ok(bryanBack.assignments['mid-bryan'].length > 0, 'Returning midday person should automatically receive takeover sites');
assert.strictEqual(L.tsaOwnersForEngineer(bryanBack, 'mid-bryan', true).length, 1, 'Returning midday engineer should receive TSA support');
const allActiveMorning = L.peopleForShift(bryanBack, 'morning', true).map(p => L.personStats(bryanBack, p.id, 'midday').ticketLoad);
const allActiveMid = L.peopleForShift(bryanBack, 'mid', true).map(p => L.personStats(bryanBack, p.id, 'midday').ticketLoad);
assert.ok(Math.max(...allActiveMorning) - Math.min(...allActiveMorning) <= 5, 'With all morning staff active, overlap load should be nearly equal per person');
assert.ok(Math.max(...allActiveMid) - Math.min(...allActiveMid) <= 5, 'With all midday staff active, overlap load should be nearly equal per person');
const tdAll = L.tsaDiagnostics(bryanBack);
L.supportAdmins(bryanBack, true).forEach(admin => {
  assert.ok(tdAll.loads[admin.id].morningCount >= 1, `${admin.name} should retain morning variety when all active`);
  assert.ok(tdAll.loads[admin.id].midCount >= 1, `${admin.name} should retain midday variety when all active`);
});

const davidOutAgain = L.setVacation(davidBack, 'morning-david', true);
assert.strictEqual(davidOutAgain.assignments['morning-david'].length, 0, 'Vacation should remove David assignments');
assert.strictEqual(L.tsaOwnersForEngineer(davidOutAgain, 'morning-david', true).length, 0, 'Vacation should remove David TSA pairing');
assert.deepStrictEqual(L.getMissingMorning(davidOutAgain), [], 'Vacation rebalance should immediately redistribute morning sites');

const carolynOut = L.setVacation(balanced, 'morning-carolyn', true);
assert.strictEqual(carolynOut.assignments['morning-carolyn'].length, 0, 'Carolyn vacation should clear her assignments');
assert.strictEqual(L.assignmentOwners(carolynOut, 'morning', 'BRK - 6020', true).length, 1, 'BRK should receive temporary morning coverage while Carolyn is out');
assert.strictEqual(L.assignmentOwners(carolynOut, 'mid', 'BRK - 6020', true).length, 0, 'BRK should remain protected from midday takeover');
const carolynBack = L.setVacation(carolynOut, 'morning-carolyn', false);
assert.ok(carolynBack.assignments['morning-carolyn'].includes('BRK - 6020'), 'BRK should return to Carolyn when she is active again');

const lockedRemoval = L.removeAssignment(balanced, 'morning-carolyn', 'BRK - 6020');
assert.ok(lockedRemoval.assignments['morning-carolyn'].includes('BRK - 6020'), 'Manual removal should not break Carolyn/BRK lock');

// Manual TSA move must transfer, not duplicate, the engineer.
const cameronOwnerBefore = L.tsaOwnersForEngineer(balanced, 'mid-cameron', true)[0];
const targetAdmin = L.supportAdmins(balanced, true).find(a => a.id !== cameronOwnerBefore);
const cameronMoved = L.assignEngineerToTsa(balanced, targetAdmin.id, 'mid-cameron');
assert.deepStrictEqual(L.tsaOwnersForEngineer(cameronMoved, 'mid-cameron', true), [targetAdmin.id], 'Manual TSA move should keep one primary owner');

// TSA vacation behavior: support rebalances, site assignments do not.
const siteSnapshot = JSON.stringify(balanced.assignments);
const ryanOut = L.setTsaVacation(balanced, 'tsa-ryan', true);
assert.strictEqual(JSON.stringify(ryanOut.assignments), siteSnapshot, 'TSA vacation should not change site assignments');
assert.deepStrictEqual(L.tsaDiagnostics(ryanOut).missingPrimary, [], 'Remaining TSAs should absorb primary pairings');
assert.deepStrictEqual(L.tsaDiagnostics(ryanOut).uncoveredWindows, [], 'Amin + Ola should still provide full time-window coverage');

const olaOut = L.setTsaVacation(balanced, 'tsa-ola', true);
const olaOutDiag = L.tsaDiagnostics(olaOut);
assert.deepStrictEqual(olaOutDiag.missingPrimary, [], 'Morning TSAs can absorb 12-4 primary pairings if Ola is out');
assert.ok(olaOutDiag.uncoveredWindows.some(x => x.window === '4pm-8pm'), 'Without Ola, late midday TSA coverage should be flagged');

// Daily staffing calendar: defaults, exceptions, duration, overlap, and date isolation.
const scheduleDate = '2026-08-31';
const nextDate = '2026-09-01';
const chadDefault = S.getShift(balanced, 'morning-chad', scheduleDate);
assert.strictEqual(chadDefault.start, '06:00', 'Morning default should start at 6am');
assert.strictEqual(chadDefault.end, '16:00', 'Morning default should end at 4pm');
assert.strictEqual(chadDefault.durationMinutes, 600, 'Morning default should be a 10-hour shift');
const cameronDefault = S.getShift(balanced, 'mid-cameron', scheduleDate);
assert.strictEqual(cameronDefault.start, '12:00', 'Midday default should start at noon');
assert.strictEqual(cameronDefault.end, '20:00', 'Midday default should end at 8pm');
assert.strictEqual(S.overlapMinutes(chadDefault, cameronDefault), 240, 'Default cross-shift overlap should be four hours');

const chadTwelve = S.setShift(balanced, 'morning-chad', scheduleDate, '06:00', '18:00');
assert.strictEqual(S.getShift(chadTwelve, 'morning-chad', scheduleDate).durationMinutes, 720, '6am-6pm should show as a 12-hour day');
assert.strictEqual(S.overlapMinutes(S.getShift(chadTwelve, 'morning-chad', scheduleDate), cameronDefault), 360, 'Extended morning day should overlap midday for six hours');
assert.strictEqual(S.getShift(chadTwelve, 'morning-chad', nextDate).end, '16:00', 'Schedule exception must be date-specific');

const joshHalf = S.setShift(balanced, 'morning-josh', scheduleDate, '06:00', '11:00');
assert.strictEqual(S.getShift(joshHalf, 'morning-josh', scheduleDate).durationMinutes, 300, 'Half-day example should be five hours');
assert.strictEqual(S.overlapMinutes(S.getShift(joshHalf, 'morning-josh', scheduleDate), cameronDefault), 0, 'A morning half day ending at 11 should not overlap midday');

const garettOff = S.setOff(balanced, 'mid-garett', scheduleDate, true);
assert.strictEqual(S.getShift(garettOff, 'mid-garett', scheduleDate).off, true, 'Daily Off should remove the shift bar for that date');
assert.strictEqual(S.getShift(garettOff, 'mid-garett', nextDate).off, false, 'Daily Off should not affect the next day');
const garettReset = S.clearOverride(garettOff, 'mid-garett', scheduleDate);
assert.strictEqual(S.getShift(garettReset, 'mid-garett', scheduleDate).start, '12:00', 'Reset should restore the default midday shift');

const dayStats = S.dayStats(balanced, scheduleDate);
assert.strictEqual(dayStats.overlapMinutes, 240, 'Normal day should show a four-hour team overlap');
assert.ok(dayStats.morningHours > dayStats.midHours, 'Current staffing should produce more total morning scheduled hours');
assert.strictEqual(dayStats.exceptions, 0, 'Default schedule should not count as an exception');
const exceptionStats = S.dayStats(chadTwelve, scheduleDate);
assert.strictEqual(exceptionStats.exceptions, 1, 'A custom 12-hour day should count as one daily exception');

assert.strictEqual(S.getShift(balanced, 'morning-david', scheduleDate).vacation, true, 'Vacation staff should appear as vacation on the calendar');
assert.strictEqual(S.getShift(balanced, 'mid-bryan', scheduleDate).durationMinutes, 0, 'Vacation staff should have no scheduled hours');

// v6 Daily Plan: schedule-aware windows, locks, handoffs, health, history, and status.
let v6 = DP.normalizeState(balanced);
const daily = DP.generatePlan(v6, scheduleDate);
assert.deepStrictEqual(daily.windows.map(w => [w.start,w.end]), [[360,720],[720,960],[960,1200]], 'Normal day should generate 6-12, 12-4, and 4-8 windows');
assert.ok(DP.coverageHealth(v6, daily).ok, 'Normal generated daily plan should have complete site coverage');
const overlapWindow = daily.windows.find(w => w.start === 720 && w.end === 960);
const split = DP.windowSplit(v6, overlapWindow);
assert.ok(Math.abs(split.midPct - 0.40) < .01, 'Dynamic overlap window should stay near 40% midday workload');
assert.strictEqual(overlapWindow.siteOwners['BRK - 6020'], 'morning-carolyn', 'BRK lock should be honored while Carolyn is working');
const lateWindow = daily.windows.find(w => w.start === 960 && w.end === 1200);
assert.ok(lateWindow.siteOwners['BRK - 6020'].startsWith('mid-'), 'BRK should hand off after Carolyn leaves instead of becoming uncovered');
assert.ok(DP.handoffs(v6, daily).some(h => h.at === 960), 'Daily plan should expose the 4pm handoff');

const carolynHalf = S.setShift(v6, 'morning-carolyn', scheduleDate, '06:00', '14:00');
const halfPlan = DP.generatePlan(carolynHalf, scheduleDate);
const afterCarolyn = halfPlan.windows.find(w => w.start === 840 && w.end === 960);
assert.ok(afterCarolyn, 'Carolyn half day should create a 2-4pm coverage window');
assert.notStrictEqual(afterCarolyn.siteOwners['BRK - 6020'], 'morning-carolyn', 'BRK should hand off when Carolyn is no longer working');
assert.ok(DP.handoffs(carolynHalf, halfPlan).some(h => h.at === 840), 'Carolyn early departure should create a 2pm handoff');

const chadTraining = S.setCoverageStatus(v6, 'morning-chad', scheduleDate, 'training');
const trainingPlan = DP.generatePlan(chadTraining, scheduleDate);
assert.ok(trainingPlan.windows.filter(w=>w.start<960).every(w => !w.activeEngineers.includes('morning-chad')), 'Training status should remove Chad from generated site coverage');
assert.strictEqual(S.getShift(chadTraining, 'morning-chad', scheduleDate).coverageStatus, 'training');

const applied = DP.withAppliedPlan(v6, scheduleDate, daily);
assert.ok(DP.appliedPlan(applied, scheduleDate), 'Applying a Daily Plan should persist it by date');
assert.strictEqual(DP.isPlanStale(applied, scheduleDate, DP.appliedPlan(applied, scheduleDate)), false, 'Newly applied plan should be current');
assert.strictEqual(DP.isPlanStale(S.setShift(applied, 'morning-chad', scheduleDate, '06:00','18:00'), scheduleDate, DP.appliedPlan(applied, scheduleDate)), true, 'Schedule change should mark applied plan stale');
const fairness = DP.fairnessSummary(applied, scheduleDate, 7);
assert.ok(fairness['morning-chad'].weightedHours > 0, 'Applied plan should create fairness workload history');

const noteState = DP.setPersonNote(DP.setDailyNote(v6, scheduleDate, 'Maintenance at 3pm'), scheduleDate, 'morning-chad', 'Client call');
assert.strictEqual(DP.notesForDate(noteState, scheduleDate).general, 'Maintenance at 3pm');
assert.strictEqual(DP.notesForDate(noteState, scheduleDate).people['morning-chad'], 'Client call');

const extraLock = DP.addLock(v6, 'morning-chad', 'DOUG-6010');
assert.ok(DP.assignmentLocks(extraLock).some(x => x.personId === 'morning-chad' && x.siteId === 'DOUG-6010'), 'Supervisor should be able to add a configurable assignment lock');
const extraLockPlan = DP.generatePlan(extraLock, scheduleDate);
assert.ok(extraLockPlan.windows.filter(w=>w.activeEngineers.includes('morning-chad')).every(w=>w.siteOwners['DOUG-6010']==='morning-chad'), 'Configurable lock should hold while owner is available');

console.log('All prototype v6 assignment, TSA, schedule, and Daily Plan tests passed.');
