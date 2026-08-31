(() => {
  const SEED = SITE_ASSIGNMENT_SEED;
  const L = SiteCoverageLogic;
  const S = SiteScheduleLogic;
  const SV = SiteScheduleView;
  const STORAGE_KEY = 'site-coverage-manager-v3';
  let state = loadState();
  let searchTerm = '';
  let scheduleDateKey = SV.todayKey();

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const personById = id => state.people.find(p => p.id === id);
  const adminById = id => (state.supportAdmins || []).find(a => a.id === id);
  const siteById = id => state.sites.find(s => s.id === id);
  const nameList = ids => ids.map(id => personById(id)?.name || id);
  const pct = value => `${(value * 100).toFixed(1)}%`;
  const roleLabel = role => role === 'tce' ? 'Technical Control Engineer' : role === 'tse' ? 'Technical Support Engineer' : role === 'tsa' ? 'Technical Support Administrator' : role || '';
  const roleShort = role => role === 'tce' ? 'TCE' : role === 'tse' ? 'TSE' : role === 'tsa' ? 'TSA' : String(role || '').toUpperCase();
  const shiftLabel = shift => shift === 'morning' ? 'Morning • 6am–4pm' : 'Midday • 12pm–8pm';

  function freshBalancedState() {
    return L.rebalanceAssignments(L.clone(SEED));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshBalancedState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SEED.version) return freshBalancedState();
      return parsed;
    } catch { return freshBalancedState(); }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setState(next, message) {
    state = next;
    saveState();
    render();
    if (message) toast(message);
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function summaryCard(label, value, sub, tone = '') {
    return `<div class="summary-card ${tone}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
  }

  function renderSummary() {
    const d = L.diagnostics(state);
    const duplicateCount = d.morningDuplicates.length + d.midDuplicates.length;
    const allVacation = state.people.filter(p => p.vacation).map(p => p.name)
      .concat((state.supportAdmins || []).filter(a => a.vacation).map(a => a.name));
    const tsaTone = d.tsa.uncoveredWindows.length || d.tsa.missingPrimary.length ? 'bad' : 'good';
    $('summary').innerHTML = [
      summaryCard('Total sites', d.totalSites, `${d.totalTickets.toLocaleString()} tickets / 30d`),
      summaryCard('6–12 morning coverage', `${d.morningCovered}/${d.totalSites}`, d.morningMissing.length ? `${d.morningMissing.length} need coverage` : 'Full coverage', d.morningMissing.length ? 'bad' : 'good'),
      summaryCard('12–4 morning workload', pct(d.overlap.morningPct), `${d.overlap.morningTickets.toLocaleString()} tickets • target ${Math.round(d.targetMorningPct * 100)}%`, Math.abs(d.overlap.morningPct - d.targetMorningPct) <= .02 ? 'good' : 'warn'),
      summaryCard('12–4 midday workload', pct(d.overlap.midPct), `${d.overlap.midTickets.toLocaleString()} tickets • target ${Math.round(d.targetMidPct * 100)}%`, Math.abs(d.overlap.midPct - d.targetMidPct) <= .02 ? 'good' : 'warn'),
      summaryCard('TSA coverage', `${d.tsa.coveredPrimaryCount}/${d.tsa.activeEngineerCount}`, d.tsa.uncoveredWindows.length ? `${d.tsa.uncoveredWindows.length} time-window gap${d.tsa.uncoveredWindows.length === 1 ? '' : 's'}` : 'All active engineers covered', tsaTone),
      summaryCard('Duplicate assignments', duplicateCount, duplicateCount ? 'Review highlighted sites' : 'No conflicts', duplicateCount ? 'bad' : 'good'),
      summaryCard('On vacation', allVacation.length, allVacation.join(', ') || 'Nobody', allVacation.length ? 'warn' : '')
    ].join('');
  }

  function renderDiagnostics() {
    const d = L.diagnostics(state);
    const morningDupes = d.morningDuplicates.map(x => `${x.siteId} (${nameList(x.owners).join(' + ')})`);
    const midDupes = d.midDuplicates.map(x => `${x.siteId} (${nameList(x.owners).join(' + ')})`);
    const effectiveIssues = [...d.effectiveMissing.map(x => `${x} missing`), ...d.effectiveDuplicates.map(x => `${x.siteId} duplicated`)];
    const handoffPool = d.middayPool;
    const splitOff = Math.abs(d.overlap.midPct - d.targetMidPct) > .02;

    const box = (title, items, okText, warnOnly = false) => {
      const cls = items.length ? (warnOnly ? 'warn' : 'bad') : 'good';
      return `<div class="diagnostic ${cls}"><h3>${esc(title)}</h3><p>${items.length ? esc(items.join(', ')) : esc(okText)}</p></div>`;
    };
    const splitBox = `<div class="diagnostic ${splitOff ? 'warn' : 'good'}"><h3>12–4 workload target</h3><p>${pct(d.overlap.morningPct)} morning / ${pct(d.overlap.midPct)} midday. Target is ${Math.round(d.targetMorningPct*100)}/${Math.round(d.targetMidPct*100)} by ticket volume.</p></div>`;

    const tsaIssues = [
      ...d.tsa.missingPrimary.map(id => `${personById(id)?.name || id} missing primary TSA`),
      ...d.tsa.duplicatePrimary.map(x => `${personById(x.engineerId)?.name || x.engineerId} has duplicate TSA owners`),
      ...d.tsa.uncoveredWindows.map(x => `${personById(x.engineerId)?.name || x.engineerId} uncovered ${x.window}`)
    ];

    $('diagnostics').innerHTML = [
      box('Morning missing coverage', d.morningMissing, 'All 38 sites have morning coverage.'),
      box('Morning duplicate assignments', morningDupes, 'No morning duplicate assignments.'),
      box('Midday duplicate assignments', midDupes, 'No midday duplicate assignments.'),
      box('TSA support coverage', tsaIssues, 'Every active engineer has a complete TSA coverage path.'),
      box('Midday reassignment pool', handoffPool, 'No takeover sites are waiting for reassignment.', true),
      box('Effective midday coverage', effectiveIssues, 'Every site has one effective coverage path after takeovers.'),
      splitBox
    ].join('');
  }

  function siteChip(siteId, personId, duplicate) {
    const site = siteById(siteId);
    const person = personById(personId);
    const midOwners = person?.shift === 'morning' ? L.assignmentOwners(state, 'mid', siteId, true) : [];
    const handoff = midOwners.length > 0;
    const locked = person && !person.vacation && L.isLockedMorningAssignment(state, personId, siteId);
    const detail = site ? `${site.customer} • ${site.tickets30} tickets in last 30 days` : '';
    const handoffDetail = handoff ? ` • hands off at 12pm to ${nameList(midOwners).join(', ')}` : '';
    const lockedDetail = locked ? ' • locked assignment' : '';
    const classes = ['site-chip', duplicate ? 'duplicate' : '', handoff ? 'handoff' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
    const action = locked
      ? '<span class="lock-mark" aria-label="Locked assignment" title="Carolyn retains BRK">LOCK</span>'
      : `<button type="button" aria-label="Remove ${esc(siteId)}" data-remove-person="${esc(personId)}" data-remove-site="${esc(siteId)}">×</button>`;
    return `<span class="${classes}" title="${esc(detail + handoffDetail + lockedDetail)}">${esc(siteId)}${action}</span>`;
  }

  function availableSitesForPerson(person) {
    const r = L.rules(state);
    return state.sites.filter(site => {
      if (person.shift === 'mid' && (r.protectedOverlapSites || []).includes(site.id)) return false;
      const lock = (r.lockedMorningAssignments || []).find(x => x.siteId === site.id);
      if (person.shift === 'morning' && lock) {
        const lockedPerson = personById(lock.personId);
        if (lockedPerson && !lockedPerson.vacation && lock.personId !== person.id) return false;
      }
      return true;
    });
  }

  function renderPersonCard(person, phase) {
    const fullStats = L.personStats(state, person.id, 'morning');
    const overlapStats = L.personStats(state, person.id, 'midday');
    const rawSites = state.assignments[person.id] || [];
    const duplicates = new Set(L.getDuplicates(state, person.shift).map(x => x.siteId));
    const options = availableSitesForPerson(person).map(site => `<option value="${esc(site.id)}">${esc(site.id)} — ${esc(site.customer)} (${site.tickets30})</option>`).join('');
    const metrics = person.shift === 'morning'
      ? `<span><strong>6–12:</strong> ${fullStats.siteCount} sites • ${fullStats.ticketLoad} tickets</span><span><strong>12–4 retained:</strong> ${overlapStats.siteCount} sites • ${overlapStats.ticketLoad} tickets</span>`
      : `<span><strong>12–4 takeover:</strong> ${overlapStats.siteCount} sites • ${overlapStats.ticketLoad} tickets</span>`;

    return `<article class="person-card ${person.vacation ? 'vacation' : ''}">
      <div class="person-top">
        <div><div class="person-name-row"><div class="person-name">${esc(person.name)}</div><span class="role-badge" title="${esc(roleLabel(person.role))}">${esc(roleShort(person.role))}</span></div><div class="person-metrics">${metrics}</div></div>
        <button class="vacation-toggle ${person.vacation ? 'on' : ''}" data-vacation-person="${esc(person.id)}">${person.vacation ? 'Vacation' : 'Active'}</button>
      </div>
      <div class="sites">${rawSites.length ? rawSites.map(id => siteChip(id, person.id, duplicates.has(id))).join('') : '<div class="empty-sites">No sites assigned</div>'}</div>
      <div class="assignment-controls">
        <select id="select-${esc(person.id)}" ${person.vacation ? 'disabled' : ''}><option value="">Add a site…</option>${options}</select>
        <button class="button primary small" data-add-person="${esc(person.id)}" ${person.vacation ? 'disabled' : ''}>Add</button>
      </div>
    </article>`;
  }

  function renderPools() {
    const d = L.diagnostics(state);
    const morningItems = d.morningMissing;
    $('morningPool').className = `coverage-pool ${morningItems.length ? '' : 'empty'}`;
    $('morningPool').innerHTML = `<div class="pool-title"><strong>Morning coverage pool</strong><span>${morningItems.length ? `${morningItems.length} site${morningItems.length === 1 ? '' : 's'} need an owner` : 'Nothing waiting — full coverage'}</span></div><div class="pool-items">${morningItems.map(id => `<span class="site-chip pool">${esc(id)}</span>`).join('')}</div>`;

    const midItems = d.middayPool;
    $('middayPool').className = `coverage-pool ${midItems.length ? '' : 'empty'}`;
    $('middayPool').innerHTML = `<div class="pool-title"><strong>Midday reassignment pool</strong><span>${midItems.length ? 'Manually removed takeover sites waiting for reassignment' : 'No takeover sites waiting'}</span></div><div class="pool-items">${midItems.map(id => `<span class="site-chip pool">${esc(id)}</span>`).join('')}</div>`;
  }

  function renderTeams() {
    const d = L.diagnostics(state);
    $('morningBadge').innerHTML = d.morningMissing.length
      ? `<span class="badge danger">${d.morningMissing.length} uncovered</span>`
      : `<span class="badge success">38/38 covered</span>`;
    $('midBadge').innerHTML = d.midDuplicates.length
      ? `<span class="badge danger">${d.midDuplicates.length} duplicate${d.midDuplicates.length === 1 ? '' : 's'}</span>`
      : `<span class="badge neutral">${d.middayTakeovers} takeovers • ${pct(d.overlap.midPct)} load</span>`;
    $('morningTeam').innerHTML = L.peopleForShift(state, 'morning').map(p => renderPersonCard(p, 'morning')).join('');
    $('midTeam').innerHTML = L.peopleForShift(state, 'mid').map(p => renderPersonCard(p, 'midday')).join('');
  }

  function adminPill(ids, fallback = false) {
    if (!ids || !ids.length) return '<span class="coverage-na">—</span>';
    return ids.map(id => `<span class="tsa-owner-pill ${fallback ? 'fallback' : ''}">${esc(adminById(id)?.name || id)}</span>`).join('');
  }

  function renderTsaSupport() {
    const td = L.tsaDiagnostics(state);
    const hasGap = td.missingPrimary.length || td.duplicatePrimary.length || td.uncoveredWindows.length;
    $('tsaBadge').innerHTML = hasGap
      ? `<span class="badge danger">${td.uncoveredWindows.length || td.missingPrimary.length} coverage issue${(td.uncoveredWindows.length || td.missingPrimary.length) === 1 ? '' : 's'}</span>`
      : `<span class="badge success">${td.coveredPrimaryCount}/${td.activeEngineerCount} supported</span>`;

    const activeEngineerOptions = state.people.filter(p => !p.vacation)
      .map(p => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(roleShort(p.role))} / ${p.shift === 'morning' ? 'Morning' : 'Midday'}</option>`).join('');

    $('tsaTeam').innerHTML = (state.supportAdmins || []).map(admin => {
      const assigned = ((state.tsaAssignments || {})[admin.id] || []).filter(id => !personById(id)?.vacation);
      const load = td.loads[admin.id] || { engineerCount: 0, supportLoad: 0, morningCount: 0, midCount: 0 };
      const chips = assigned.length ? assigned.map(engineerId => {
        const engineer = personById(engineerId);
        return `<span class="engineer-chip ${engineer?.shift === 'mid' ? 'mid' : ''}" title="${esc(roleLabel(engineer?.role))}">
          <span>${esc(engineer?.name || engineerId)}</span><small>${esc(roleShort(engineer?.role))} • ${engineer?.shift === 'morning' ? 'AM' : 'MID'}</small>
          <button type="button" data-tsa-remove="${esc(admin.id)}" data-engineer-id="${esc(engineerId)}" aria-label="Remove ${esc(engineer?.name || engineerId)} from ${esc(admin.name)}">×</button>
        </span>`;
      }).join('') : '<div class="empty-sites">No engineers assigned</div>';

      return `<article class="tsa-card ${admin.vacation ? 'vacation' : ''}">
        <div class="person-top">
          <div>
            <div class="person-name-row"><div class="person-name">${esc(admin.name)}</div><span class="role-badge tsa">TSA</span></div>
            <div class="person-metrics"><span>${esc(shiftLabel(admin.shift))}</span><span><strong>${load.engineerCount}</strong> engineers • weighted load ${load.supportLoad}</span><span>${load.morningCount} morning • ${load.midCount} midday</span></div>
          </div>
          <button class="vacation-toggle ${admin.vacation ? 'on' : ''}" data-tsa-vacation="${esc(admin.id)}">${admin.vacation ? 'Vacation' : 'Active'}</button>
        </div>
        <div class="engineer-list">${chips}</div>
        <div class="assignment-controls">
          <select id="tsa-select-${esc(admin.id)}" ${admin.vacation ? 'disabled' : ''}><option value="">Assign / move engineer…</option>${activeEngineerOptions}</select>
          <button class="button primary small" data-tsa-add="${esc(admin.id)}" ${admin.vacation ? 'disabled' : ''}>Assign</button>
        </div>
      </article>`;
    }).join('');

    $('tsaMatrix').innerHTML = state.people.map(engineer => {
      if (engineer.vacation) {
        return `<tr class="vacation-row"><td><strong>${esc(engineer.name)}</strong></td><td><span class="role-badge">${esc(roleShort(engineer.role))}</span></td><td>${engineer.shift === 'morning' ? '6am–4pm' : '12pm–8pm'}</td><td colspan="3"><span class="badge warning">Vacation</span></td></tr>`;
      }
      const c = L.tsaCoverageForEngineer(state, engineer.id);
      const primary = c.primary[0];
      const earlyFallback = engineer.shift === 'morning' && c.early[0] && c.early[0] !== primary;
      const lateFallback = engineer.shift === 'mid' && c.late[0] && c.late[0] !== primary;
      const early = engineer.shift === 'morning' ? adminPill(c.early, earlyFallback) : '<span class="coverage-na">Not on shift</span>';
      const late = engineer.shift === 'mid' ? adminPill(c.late, lateFallback) : '<span class="coverage-na">Shift ended</span>';
      const overlap = c.overlap.length ? adminPill(c.overlap) : '<span class="badge danger">Uncovered</span>';
      return `<tr>
        <td><strong>${esc(engineer.name)}</strong></td>
        <td><span class="role-badge">${esc(roleShort(engineer.role))}</span></td>
        <td>${engineer.shift === 'morning' ? 'Morning • 6am–4pm' : 'Midday • 12pm–8pm'}</td>
        <td>${early}</td><td>${overlap}</td><td>${late}</td>
      </tr>`;
    }).join('');
  }

  function renderWorkload() {
    const people = state.people.filter(p => !p.vacation);
    const rows = people.map(p => ({ p, s: L.personStats(state, p.id, 'midday') }));
    const maxTickets = Math.max(1, ...rows.map(x => x.s.ticketLoad));
    $('workload').innerHTML = rows.map(({p,s}) => `<div class="workload-card">
      <div class="shift">${p.shift === 'morning' ? 'Morning retained • 12–4' : 'Midday takeover • 12–4'}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="load-number"><div><strong>${s.siteCount}</strong><span>sites</span></div><div><strong>${s.ticketLoad}</strong><span>tickets / 30d</span></div></div>
      <div class="load-bar" title="Relative ticket load"><i style="width:${Math.max(3, Math.round(s.ticketLoad/maxTickets*100))}%"></i></div>
    </div>`).join('');
  }

  function ownerPills(ids, kind = '') {
    if (!ids.length) return '<span class="empty-sites">—</span>';
    const bad = ids.length > 1;
    return `<div class="owner-list">${ids.map(id => `<span class="owner-pill ${kind} ${bad ? 'bad' : ''}">${esc(personById(id)?.name || id)}</span>`).join('')}</div>`;
  }

  function siteStatus(siteId) {
    const morning = L.assignmentOwners(state, 'morning', siteId, true);
    const mid = L.assignmentOwners(state, 'mid', siteId, true);
    const effective = L.effectiveOwners(state, siteId);
    if (effective.length === 0) return '<span class="badge danger">Uncovered</span>';
    if (morning.length > 1 || mid.length > 1 || effective.length > 1) return '<span class="badge danger">Duplicate</span>';
    return '<span class="badge success">Covered</span>';
  }

  function renderTable() {
    const q = searchTerm.trim().toLowerCase();
    const sites = state.sites.filter(s => !q || s.id.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q));
    $('siteTable').innerHTML = sites.map(site => {
      const morning = L.assignmentOwners(state, 'morning', site.id, true);
      const mid = L.assignmentOwners(state, 'mid', site.id, true);
      const effective = L.effectiveOwners(state, site.id);
      return `<tr><td><strong>${esc(site.id)}</strong></td><td>${esc(site.customer)}</td><td>${site.tickets30}</td><td>${ownerPills(morning)}</td><td>${ownerPills(mid, 'mid')}</td><td>${ownerPills(effective, mid.length ? 'mid' : '')}</td><td>${siteStatus(site.id)}</td></tr>`;
    }).join('');
  }

  function renderSchedule() {
    $('scheduleDate').value = scheduleDateKey;
    $('scheduleDayLabel').textContent = SV.formatDateLabel(scheduleDateKey);
    $('scheduleSummary').innerHTML = SV.summaryHTML(state, scheduleDateKey);
    $('scheduleBoard').innerHTML = SV.boardHTML(state, scheduleDateKey, { editable: true });
  }

  function render() {
    renderSummary();
    renderSchedule();
    renderDiagnostics();
    renderPools();
    renderTeams();
    renderTsaSupport();
    renderWorkload();
    renderTable();
    wireDynamicEvents();
  }

  function wireScheduleEvents() {
document.querySelectorAll('[data-schedule-start], [data-schedule-end]').forEach(input => input.addEventListener('change', () => {
  const personId = input.dataset.scheduleStart || input.dataset.scheduleEnd;
  const editor = document.querySelector(`[data-schedule-editor="${personId}"]`);
  const start = editor?.querySelector('[data-schedule-start]')?.value;
  const end = editor?.querySelector('[data-schedule-end]')?.value;
  if (!start || !end || S.timeToMinutes(end) <= S.timeToMinutes(start)) {
    toast('End time must be later than start time');
    return;
  }
  const person = S.staffById(state, personId);
  setState(S.setShift(state, personId, scheduleDateKey, start, end), `${person.name} • ${SV.formatDateLabel(scheduleDateKey)} updated to ${S.formatTime(start)}–${S.formatTime(end)}`);
}));

document.querySelectorAll('[data-schedule-off]').forEach(btn => btn.addEventListener('click', () => {
  const personId = btn.dataset.scheduleOff;
  const person = S.staffById(state, personId);
  const current = S.getShift(state, personId, scheduleDateKey);
  setState(S.setOff(state, personId, scheduleDateKey, !current.off), current.off ? `${person.name} restored to default shift` : `${person.name} marked off for ${SV.formatDateLabel(scheduleDateKey)}`);
}));

document.querySelectorAll('[data-schedule-reset]').forEach(btn => btn.addEventListener('click', () => {
  const personId = btn.dataset.scheduleReset;
  const person = S.staffById(state, personId);
  setState(S.clearOverride(state, personId, scheduleDateKey), `${person.name}'s shift reset to default for ${SV.formatDateLabel(scheduleDateKey)}`);
}));
  }

  function wireDynamicEvents() {
    document.querySelectorAll('[data-add-person]').forEach(btn => btn.addEventListener('click', () => {
      const personId = btn.dataset.addPerson;
      const select = document.getElementById(`select-${personId}`);
      if (!select.value) return;
      const person = personById(personId);
      const next = L.addAssignment(state, personId, select.value);
      if (JSON.stringify(next.assignments) === JSON.stringify(state.assignments)) {
        toast(`${select.value} is protected by an assignment rule`);
        return;
      }
      setState(next, `${select.value} assigned to ${person.name}`);
    }));

    document.querySelectorAll('[data-remove-person]').forEach(btn => btn.addEventListener('click', () => {
      const person = personById(btn.dataset.removePerson);
      const next = L.removeAssignment(state, btn.dataset.removePerson, btn.dataset.removeSite);
      if (JSON.stringify(next.assignments) === JSON.stringify(state.assignments)) {
        toast(`${btn.dataset.removeSite} is a locked assignment`);
        return;
      }
      setState(next, `${btn.dataset.removeSite} removed from ${person.name}`);
    }));

    document.querySelectorAll('[data-vacation-person]').forEach(btn => btn.addEventListener('click', () => {
      const person = personById(btn.dataset.vacationPerson);
      const nextVacation = !person.vacation;
      if (nextVacation) {
        const ok = confirm(`Mark ${person.name} on vacation? All 38 sites will be rebalanced automatically using ticket workload, and ${person.name}'s current assignments will be redistributed.`);
        if (!ok) return;
      }
      const next = L.setVacation(state, person.id, nextVacation);
      setState(next, nextVacation ? `${person.name} on vacation • schedule rebalanced` : `${person.name} active • schedule rebalanced`);
    }));


    document.querySelectorAll('[data-tsa-vacation]').forEach(btn => btn.addEventListener('click', () => {
      const admin = adminById(btn.dataset.tsaVacation);
      const nextVacation = !admin.vacation;
      if (nextVacation) {
        const ok = confirm(`Mark ${admin.name} on vacation? TSA pairings will rebalance across the remaining admins. Site assignments will not change.`);
        if (!ok) return;
      }
      setState(L.setTsaVacation(state, admin.id, nextVacation), nextVacation ? `${admin.name} on vacation • TSA support rebalanced` : `${admin.name} active • TSA support rebalanced`);
    }));

    document.querySelectorAll('[data-tsa-add]').forEach(btn => btn.addEventListener('click', () => {
      const adminId = btn.dataset.tsaAdd;
      const admin = adminById(adminId);
      const select = document.getElementById(`tsa-select-${adminId}`);
      if (!select || !select.value) return;
      const engineer = personById(select.value);
      setState(L.assignEngineerToTsa(state, adminId, select.value), `${engineer.name} assigned to ${admin.name} for primary TSA support`);
    }));

    document.querySelectorAll('[data-tsa-remove]').forEach(btn => btn.addEventListener('click', () => {
      const admin = adminById(btn.dataset.tsaRemove);
      const engineer = personById(btn.dataset.engineerId);
      setState(L.removeEngineerFromTsa(state, admin.id, engineer.id), `${engineer.name} removed from ${admin.name} • TSA coverage needs review`);
    }));

    wireScheduleEvents();
  }

  $('scheduleDate').addEventListener('change', e => {
    if (!S.isDateKey(e.target.value)) return;
    scheduleDateKey = e.target.value;
    renderSchedule();
    wireScheduleEvents();
  });
  $('schedulePrevDay').addEventListener('click', () => {
    scheduleDateKey = SV.addDays(scheduleDateKey, -1);
    renderSchedule();
    wireScheduleEvents();
  });
  $('scheduleNextDay').addEventListener('click', () => {
    scheduleDateKey = SV.addDays(scheduleDateKey, 1);
    renderSchedule();
    wireScheduleEvents();
  });
  $('scheduleToday').addEventListener('click', () => {
    scheduleDateKey = SV.todayKey();
    renderSchedule();
    wireScheduleEvents();
  });
  $('scheduleResetDay').addEventListener('click', () => {
    const stats = S.dayStats(state, scheduleDateKey);
    if (!stats.exceptions) { toast('This day is already using the default shifts'); return; }
    if (!confirm(`Reset all ${stats.exceptions} schedule exception${stats.exceptions === 1 ? '' : 's'} for ${SV.formatDateLabel(scheduleDateKey)}?`)) return;
    setState(S.clearDay(state, scheduleDateKey), `Schedule reset to defaults for ${SV.formatDateLabel(scheduleDateKey)}`);
  });

  $('rebalanceBtn').addEventListener('click', () => {
    setState(L.rebalanceAssignments(state), 'Site workload and TSA support rebalanced');
  });

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset the roster, TSA support, and vacation status to the workbook defaults, then rebuild the balanced schedule?')) return;
    state = freshBalancedState();
    saveState();
    render();
    toast('Reset to defaults • sites and TSA support rebalanced');
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-coverage-snapshot-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('siteSearch').addEventListener('input', e => { searchTerm = e.target.value; renderTable(); });
  render();
})();
