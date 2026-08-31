(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  root.SITE_ASSIGNMENT_SEED = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    version: 3,
    sourceDate: '2026-08-30',
    rules: {
      overlapMorningTarget: 0.60,
      overlapMidTarget: 0.40,
      lockedMorningAssignments: [{ personId: 'morning-carolyn', siteId: 'BRK - 6020' }],
      assignmentLocks: [{ id: 'lock-brk-carolyn', personId: 'morning-carolyn', siteId: 'BRK - 6020' }],
      protectedOverlapSites: ['BRK - 6020'],
      scheduleDefaults: {
        morning: { start: '06:00', end: '16:00' },
        mid: { start: '12:00', end: '20:00' }
      },
      scheduleTimeline: { start: '05:00', end: '21:00' }
    },
    sites: [
      { id: 'BRK - 6020', customer: 'WLM', tickets30: 160 },
      { id: 'DOUG-6010', customer: 'WLM', tickets30: 136 },
      { id: 'RMNH-6030', customer: 'WLM', tickets30: 121 },
      { id: 'STL-6023', customer: 'WLM', tickets30: 103 },
      { id: 'PLV-6012', customer: 'WLM', tickets30: 101 },
      { id: 'CLM-6006', customer: 'WLM', tickets30: 97 },
      { id: 'SYM-6017', customer: 'WLM', tickets30: 95 },
      { id: 'MNM-6025', customer: 'WLM', tickets30: 93 },
      { id: 'MRC-6038', customer: 'WLM', tickets30: 86 },
      { id: 'SRC-6018', customer: 'WLM', tickets30: 85 },
      { id: 'MID-6039', customer: 'WLM', tickets30: 75 },
      { id: 'GRC-6024', customer: 'WLM', tickets30: 68 },
      { id: 'HERM-6037', customer: 'WLM', tickets30: 68 },
      { id: 'RBL-6026', customer: 'WLM', tickets30: 64 },
      { id: 'WDL-6027', customer: 'WLM', tickets30: 59 },
      { id: 'BRH-6011', customer: 'WLM', tickets30: 51 },
      { id: 'PAL-6036', customer: 'WLM', tickets30: 51 },
      { id: 'NBF-6016', customer: 'WLM', tickets30: 50 },
      { id: 'BCK-6031', customer: 'WLM', tickets30: 42 },
      { id: 'HMNC-6040', customer: 'WLM', tickets30: 40 },
      { id: 'OTW-6035', customer: 'WLM', tickets30: 39 },
      { id: 'ALB-IRV', customer: 'ALB', tickets30: 36 },
      { id: 'LVL-6019', customer: 'WLM', tickets30: 33 },
      { id: 'BETH', customer: 'C&C', tickets30: 25 },
      { id: 'PRT-6021', customer: 'WLM', tickets30: 23 },
      { id: 'UNFI-JOL', customer: 'UNFI', tickets30: 21 },
      { id: 'GT', customer: 'GT', tickets30: 17 },
      { id: 'ALB-MP', customer: 'ALB', tickets30: 17 },
      { id: 'AFS-FRW', customer: 'AFS', tickets30: 13 },
      { id: 'SGL-LVG', customer: 'SG', tickets30: 13 },
      { id: 'ALB-TOL', customer: 'ALB', tickets30: 10 },
      { id: 'CS-WNL', customer: 'C&C', tickets30: 9 },
      { id: 'EXOL-LTH', customer: 'C&C', tickets30: 8 },
      { id: 'UNFI-MNC', customer: 'UNFI', tickets30: 8 },
      { id: 'TGT-WOOD', customer: 'TG', tickets30: 5 },
      { id: 'UNFI-CEN', customer: 'UNFI', tickets30: 4 },
      { id: 'EXOL-JCK', customer: 'EXOL', tickets30: 0 },
      { id: 'WIL-ITC', customer: 'SYM', tickets30: 0 }
    ],
    people: [
      { id: 'morning-chad', name: 'Chad', shift: 'morning', role: 'tce', vacation: false },
      { id: 'morning-bronson', name: 'Bronson', shift: 'morning', role: 'tse', vacation: false },
      { id: 'morning-carolyn', name: 'Carolyn', shift: 'morning', role: 'tse', vacation: false },
      { id: 'morning-david', name: 'David', shift: 'morning', role: 'tce', vacation: true },
      { id: 'morning-youseff', name: 'Youssef', shift: 'morning', role: 'tce', vacation: false },
      { id: 'morning-josh', name: 'Joshua', shift: 'morning', role: 'tse', vacation: false },
      { id: 'mid-bryan', name: 'Bryan', shift: 'mid', role: 'tse', vacation: true },
      { id: 'mid-cameron', name: 'Cameron', shift: 'mid', role: 'tse', vacation: false },
      { id: 'mid-garett', name: 'Garett', shift: 'mid', role: 'tce', vacation: false },
      { id: 'mid-krysztof', name: 'Krysztof', shift: 'mid', role: 'tse', vacation: false }
    ],
    supportAdmins: [
      { id: 'tsa-ryan', name: 'Ryan', shift: 'morning', role: 'tsa', vacation: false },
      { id: 'tsa-amin', name: 'Amin', shift: 'morning', role: 'tsa', vacation: false },
      { id: 'tsa-ola', name: 'Ola', shift: 'mid', role: 'tsa', vacation: false }
    ],
    tsaAssignments: {
      'tsa-ryan': [],
      'tsa-amin': [],
      'tsa-ola': []
    },
    assignments: {
      'morning-chad': ['DOUG-6010', 'STL-6023', 'UNFI-CEN', 'ALB-IRV', 'SRC-6018', 'WDL-6027', 'ALB-MP', 'MRC-6038'],
      'morning-bronson': ['UNFI-JOL', 'UNFI-MNC', 'GT', 'SGL-LVG', 'CS-WNL', 'BCK-6031', 'PAL-6036', 'PLV-6012', 'HERM-6037'],
      'morning-carolyn': ['BRK - 6020', 'ALB-TOL', 'RBL-6026', 'PRT-6021', 'EXOL-LTH', 'CS-WNL', 'GRC-6024', 'OTW-6035', 'BETH'],
      'morning-david': [],
      'morning-youseff': ['CLM-6006', 'AFS-FRW', 'EXOL-JCK', 'NBF-6016', 'SYM-6017', 'TGT-WOOD', 'EXOL-LTH'],
      'morning-josh': ['BRH-6011', 'RMNH-6030', 'LVL-6019', 'MNM-6025', 'HMNC-6040', 'WIL-ITC', 'MID-6039'],
      'mid-bryan': [],
      'mid-cameron': ['BCK-6031', 'SYM-6017', 'PAL-6036', 'OTW-6035', 'HMNC-6040'],
      'mid-garett': ['MRC-6038', 'MID-6039', 'ALB-MP', 'PLV-6012'],
      'mid-krysztof': ['TGT-WOOD', 'GRC-6024', 'BETH', 'HERM-6037']
    },
    middayPool: [],
    scheduleOverrides: {},
    dailyPlans: {},
    dailyNotes: {},
    fairnessHistory: {},
    changeHistory: []
  };
});
