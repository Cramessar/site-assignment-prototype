const assert = require('assert');
const seed = require('./data.js');
const L = require('./logic.js');
const S = require('./schedule.js');
const DP = require('./daily-plan.js');
const CB = require('./coverage-builder.js');

assert.strictEqual(seed.sites.length, 38, 'Expected 38 sites from workbook');
assert.strictEqual(L.totalTickets(seed), 1926, 'Expected 1,926 tickets from workbook');
assert.deepStrictEqual(seed.people.filter(p => p.vacation).map(p => p.name).sort(), ['Bryan', 'David'], 'David and Bryan should start on vacation');
assert.deepStrictEqual(seed.supportAdmins.map(a => a.name).sort(), ['Amin', 'Ola', 'Ryan'], 'Expected three TSAs');
assert.strictEqual(seed.people.find(p => p.name === 'Youssef').role, 'tce');
assert.strictEqual(seed.people.find(p => p.name === 'Carolyn').role, 'tse');
assert.strictEqual(seed.people.find(p => p.name === 'Garret').role, 'tce');

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

// v9 organization layer: full roster, named shifts, supervisors, and unconfigured-hour safety.
assert.strictEqual(S.allStaff(seed).length, 57, 'Expected 53 supplied roster people plus Youssef, Bryan, Ola, and Christopher retained in the prototype');
assert.strictEqual(seed.rosterMeta.latestRosterCount, 53, 'Expected 53 rows in the supplied roster');
assert.strictEqual(S.shiftDefinition(seed, 'weekday-morning').supervisorName, 'Matthew Weimer');
assert.strictEqual(S.shiftDefinition(seed, 'weekday-mid').supervisorName, 'Chaitanya Jagarapu');
assert.strictEqual(S.shiftDefinition(seed, 'weekday-night').supervisorName, 'Oluwafemi Okediran');
assert.strictEqual(S.shiftDefinition(seed, 'weekend-day').supervisorName, 'Christopher Ramessar');
assert.strictEqual(S.shiftDefinition(seed, 'weekend-mid').supervisorName, 'Stephen Parker');
assert.strictEqual(S.shiftDefinition(seed, 'weekend-night').supervisorName, 'Guillermo Rodriguez');
assert.ok(S.allStaff(seed).some(p => p.fullName === 'Ryan Jackson' && p.role === 'tsa'), 'Weekend Day Ryan should resolve to Ryan Jackson');
assert.ok(S.allStaff(seed).some(p => p.fullName === 'Christopher Ramessar' && S.isShiftSupervisor(seed, p)), 'Christopher should exist as the Weekend Day shift supervisor row');
assert.ok(S.allStaff(seed).some(p => p.fullName === 'Ryan Mine' && p.operationalShiftId === 'weekday-mid'), 'Ryan Mine must remain a separate Weekday Mid employee');
assert.strictEqual(S.getShift(seed, 'roster-matthew-weimer', '2026-08-31').durationMinutes, 600, 'Weekday Morning should default to 6am-4pm');
const withWeekdayHours = S.setShiftDefault(seed, 'weekday-morning', '07:00', '17:00');
assert.strictEqual(S.getShift(withWeekdayHours, 'roster-matthew-weimer', '2026-08-31').durationMinutes, 600, 'Configured shift defaults should immediately schedule that roster');
const withNightHours = S.setShiftDefault(seed, 'weekend-night', '20:00', '06:00');
assert.strictEqual(S.getShift(withNightHours, 'roster-kevin-mitchell', '2026-08-31').durationMinutes, 600, 'Overnight shift defaults should cross midnight correctly');

assert.strictEqual(S.operationalShiftId(seed, S.allStaff(seed).find(p => p.fullName === 'Andrea Capuras')), 'weekend-night', "Andrea should inherit Guillermo's shift for scheduling");
assert.strictEqual(S.getShift(S.setShiftDefault(seed, 'weekend-night', '20:00', '06:00'), 'roster-andrea-capuras', '2026-09-04').durationMinutes, 600, "Andrea should use Guillermo's shift default when weekend-night hours are configured");
assert.deepStrictEqual(S.visibleShiftIds(seed, '2026-09-04').filter(x => x.startsWith('weekday-')).sort(), ['weekday-night'], 'Friday should show weekday night only, not weekday morning or weekday mid');
assert.ok(!S.visibleShiftIds(seed, '2026-09-05').includes('weekday-night'), 'Saturday should not show weekday night');
const customDays = S.setShiftDays(seed, 'weekend-day', [6]);
assert.strictEqual(S.shiftActiveOnDate(customDays, 'weekend-day', '2026-09-04'), false, 'Changing active days should remove Weekend Day from Friday');
assert.strictEqual(S.shiftActiveOnDate(customDays, 'weekend-day', '2026-09-05'), true, 'Changing active days should retain Weekend Day on Saturday');
const customSchedule = S.setShiftSchedule(seed, 'weekday-mid', '13:00', '21:00', [2,3]);
assert.strictEqual(S.getShift(customSchedule, 'roster-divyesh-kabariya', '2026-09-01').start, '13:00', 'Shift schedule editor should change default hours');
assert.strictEqual(S.shiftActiveOnDate(customSchedule, 'weekday-mid', '2026-09-03'), false, 'Shift schedule editor should change active days');
const offDayOverride = S.setShift(customSchedule, 'roster-divyesh-kabariya', '2026-09-03', '12:00', '16:00');
assert.strictEqual(S.getShift(offDayOverride, 'roster-divyesh-kabariya', '2026-09-03').durationMinutes, 240, 'A person-specific exception should be allowed even when the shift is normally inactive');

// v9 multi-shift Coverage Builder: any selected operational shifts can own the 38 sites.
const weekendPlan = CB.generatePlan(seed, '2026-09-05', ['weekend-day','weekend-mid']);
assert.deepStrictEqual(weekendPlan.windows.map(w=>[w.start,w.end]), [[360,720],[720,960],[960,1200]], 'Weekend Day + Mid should generate familiar 6-12, 12-4, 4-8 windows');
assert.ok(CB.health(seed, weekendPlan).ok, 'Weekend multi-shift plan should fully cover all sites');
assert.ok(weekendPlan.windows.every(w=>!w.activeEngineers.some(id=>['tss','supervisor','manager'].includes(S.staffById(seed,id)?.role))), 'Supervisors and managers must never receive site assignments');
const weekendOverlap = weekendPlan.windows.find(w=>w.start===720);
const weekendLoads = CB.shiftLoadSummary(seed, weekendOverlap);
const weekendMidLoad = weekendLoads.find(x=>x.shiftId==='weekend-mid');
assert.ok(Math.abs(weekendMidLoad.pct-.40)<.02, 'Weekend Day/Mid generic builder should retain the 60/40 workload rule');

const weekdayPlan = CB.generatePlan(seed, '2026-09-01', ['weekday-morning','weekday-mid']);
assert.deepStrictEqual(weekdayPlan.windows.map(w=>[w.start,w.end]), [[360,720],[720,960],[960,1200]], 'Weekday Morning + Mid should use configured shift times');
assert.ok(CB.health(seed, weekdayPlan).ok, 'Weekday supervisors should be able to generate complete site coverage');
assert.ok(weekdayPlan.windows.some(w=>w.activeEngineers.includes('roster-divyesh-kabariya')), 'Weekday Mid engineers should receive site assignments');
assert.ok(weekdayPlan.windows.some(w=>w.activeAdmins.includes('roster-luis-arteaga')), 'Weekday Mid TSA should participate in TSA support');

const midNightPlan = CB.generatePlan(seed, '2026-09-04', ['weekend-mid','weekend-night']);
assert.deepStrictEqual(midNightPlan.windows.map(w=>[w.start,w.end]), [[720,1200],[1200,1800]], 'Mid + Night should create an 8pm site handoff and support overnight coverage');
assert.ok(CB.handoffs(seed, midNightPlan).some(h=>h.at===1200), 'Mid/Night plan should expose the 8pm handoff');
assert.ok(midNightPlan.windows[1].activeAdmins.includes('roster-andrea-capuras'), 'Andrea should participate as Weekend Night TSA through supervisor-inherited shift');
const publishedMulti = CB.publishPlan(seed, '2026-09-01', weekdayPlan);
assert.strictEqual(CB.publishedPlan(publishedMulti, '2026-09-01').type, 'multi-shift', 'Published multi-shift plans should persist by date');
assert.strictEqual(CB.isPlanStale(publishedMulti, '2026-09-01', CB.publishedPlan(publishedMulti, '2026-09-01')), false, 'Freshly published multi-shift plan should not be stale');

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
const nextDate = '2026-09-06';
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

console.log('All prototype v10 roster, configurable shift, multi-shift coverage, assignment, TSA, schedule, and Daily Plan tests passed.');

// v10 weekly persistence and page-separation model.
const weekendWeek = CB.operationalPeriod(seed, '2026-08-30', ['weekend-day','weekend-mid']);
assert.strictEqual(weekendWeek.startDate, '2026-08-28', 'Weekend operational week should start Friday');
assert.strictEqual(weekendWeek.endDate, '2026-08-31', 'Weekend operational week should end Monday');
const weekdayWeek = CB.operationalPeriod(seed, '2026-09-02', ['weekday-morning','weekday-mid']);
assert.strictEqual(weekdayWeek.startDate, '2026-08-31', 'Weekday Morning/Mid operational week should start Monday');
assert.strictEqual(weekdayWeek.endDate, '2026-09-03', 'Weekday Morning/Mid operational week should end Thursday');
const weekly = CB.generateWeeklyPlan(seed, '2026-08-30', ['weekend-day','weekend-mid']);
assert.strictEqual(weekly.type, 'weekly-multi-shift');
assert.strictEqual(weekly.periodStart, '2026-08-28');
assert.strictEqual(weekly.periodEnd, '2026-08-31');
assert.ok(CB.health(seed, weekly).ok, 'Weekly Weekend plan should cover all sites');
const publishedWeeklyState = CB.publishWeeklyPlan(seed, weekly);
assert.strictEqual(CB.weeklyPlansForDate(publishedWeeklyState, '2026-08-28').length, 1, 'Published weekly plan should be visible Friday');
assert.strictEqual(CB.weeklyPlansForDate(publishedWeeklyState, '2026-08-31').length, 1, 'Published weekly plan should remain visible Monday');
const weeklyWithHalfDay = S.setShift(publishedWeeklyState, 'morning-chad', '2026-08-30', '06:00', '11:00');
assert.strictEqual(CB.weeklyPlanStale(weeklyWithHalfDay, weekly), false, 'A date-specific half-day should not rewrite or stale the weekly base assignment');
const changedWeekendDefault = S.setShiftSchedule(publishedWeeklyState, 'weekend-day', '07:00', '17:00', [5,6,0,1]);
assert.strictEqual(CB.weeklyPlanStale(changedWeekendDefault, weekly), true, 'Changing the normal shift schedule should mark the weekly assignment stale');

console.log('All prototype v10 weekly persistence tests passed.');


// v10.2 daily non-working statuses redistribute coverage without rewriting the stored weekly base plan.
const sunday = '2026-08-30';
const basePublished = CB.publishWeeklyPlan(seed, CB.generateWeeklyPlan(seed, sunday, ['weekend-day','weekend-mid']));
const storedBase = CB.publishedWeeklyPlan(basePublished, sunday, ['weekend-day','weekend-mid']);
const baseSignature = CB.planWindowSignature(storedBase);

function assertPersonRedistributedForStatus(status) {
  const changed = status === 'off'
    ? S.setOff(basePublished, 'morning-chad', sunday, true)
    : S.setCoverageStatus(basePublished, 'morning-chad', sunday, status);
  const effective = CB.effectiveWeeklyPlan(changed, storedBase, sunday);
  assert.ok(effective.dailyAdjusted, `${status} should create a date-specific adjusted coverage plan`);
  assert.ok(effective.windows.every(w => !(w.activeEngineers || []).includes('morning-chad')), `${status} should remove Chad from active site coverage`);
  assert.ok(effective.windows.every(w => Object.keys(w.siteOwners || {}).length === 38), `${status} should redistribute all 38 sites`);
  assert.ok(effective.windows.every(w => !Object.values(w.siteOwners || {}).includes('morning-chad')), `${status} should move Chad's sites to working engineers`);
  assert.strictEqual(CB.planWindowSignature(CB.publishedWeeklyPlan(changed, sunday, ['weekend-day','weekend-mid'])), baseSignature, `${status} must not mutate the stored weekly base assignment`);
}
['off','training','meeting','unavailable'].forEach(assertPersonRedistributedForStatus);

const aminUnavailable = S.setCoverageStatus(basePublished, 'tsa-amin', sunday, 'unavailable');
const tsaEffective = CB.effectiveWeeklyPlan(aminUnavailable, storedBase, sunday);
assert.ok(tsaEffective.windows.every(w => !(w.activeAdmins || []).includes('tsa-amin')), 'Unavailable TSA should be removed from active TSA coverage');
assert.ok(tsaEffective.windows.every(w => !Object.values(w.tsaByEngineer || {}).includes('tsa-amin')), 'Unavailable TSA responsibilities should be redistributed to working TSAs');

console.log('All prototype v10.2 daily status redistribution tests passed.');


// Daily public availability banner data should include explicit absences only.
const outState = S.setCoverageStatus(
  S.setOff(
    S.setCoverageStatus(seed, 'morning-chad', '2026-09-05', 'training'),
    'mid-cameron',
    '2026-09-05',
    true
  ),
  'mid-garett',
  '2026-09-05',
  'unavailable'
);
const outRows = S.outToday(outState, '2026-09-05');
assert.ok(outRows.some(x => x.person.id === 'morning-david' && x.status === 'vacation'), 'Vacation should appear in out-today data');
assert.ok(outRows.some(x => x.person.id === 'morning-chad' && x.status === 'training'), 'Training should appear in out-today data');
assert.ok(outRows.some(x => x.person.id === 'mid-cameron' && x.status === 'off'), 'Explicit Off should appear in out-today data');
assert.ok(outRows.some(x => x.person.id === 'mid-garett' && x.status === 'unavailable'), 'Unavailable should appear in out-today data');
assert.ok(!outRows.some(x => x.person.id === 'roster-matthew-weimer'), 'Normal inactive shifts must not be mislabeled as out today');
