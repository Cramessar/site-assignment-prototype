(() => {
  const SEED = SITE_ASSIGNMENT_SEED;
  const L = SiteCoverageLogic;
  const S = SiteScheduleLogic;
  const SV = SiteScheduleView;
  const STORAGE_KEY = 'site-coverage-manager-v3';
  const PERSON_KEY = 'site-coverage-team-person';
  let state = loadState();
  let scheduleDateKey = SV.todayKey();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const personById = id => state.people.find(p => p.id === id);
  const adminById = id => (state.supportAdmins || []).find(a => a.id === id);
  const siteById = id => state.sites.find(s => s.id === id);
  const roleShort = role => role === 'tce' ? 'TCE' : role === 'tse' ? 'TSE' : role === 'tsa' ? 'TSA' : String(role || '').toUpperCase();
  const roleLabel = role => role === 'tce' ? 'Technical Control Engineer' : role === 'tse' ? 'Technical Support Engineer' : role === 'tsa' ? 'Technical Support Administrator' : role || '';
  const shiftLabel = shift => shift === 'morning' ? 'Morning • 6am–4pm' : 'Midday • 12pm–8pm';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return L.rebalanceAssignments(L.clone(SEED));
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SEED.version) return L.rebalanceAssignments(L.clone(SEED));
      return parsed;
    } catch {
      return L.rebalanceAssignments(L.clone(SEED));
    }
  }

  function allPeople() {
    return [...state.people, ...(state.supportAdmins || [])];
  }

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }

  function formatNames(ids, type = 'admin') {
    if (!ids || !ids.length) return 'No coverage assigned';
    return ids.map(id => type === 'admin' ? (adminById(id)?.name || id) : (personById(id)?.name || id)).join(', ');
  }

  function renderPicker() {
    const groups = [
      { label: 'Morning engineers • 6am–4pm', people: state.people.filter(p => p.shift === 'morning') },
      { label: 'Midday engineers • 12pm–8pm', people: state.people.filter(p => p.shift === 'mid') },
      { label: 'Technical Support Administrators', people: state.supportAdmins || [] }
    ];
    $('personSelect').innerHTML = '<option value="">Choose your name…</option>' + groups.map(group =>
      `<optgroup label="${esc(group.label)}">${group.people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.vacation ? ' — Vacation' : ''}</option>`).join('')}</optgroup>`
    ).join('');
  }

  function profileHeader(person) {
    const dailyShift = S.getShift(state, person.id, scheduleDateKey);
    const statusClass = person.vacation || dailyShift.off ? 'vacation' : '';
    const statusText = person.vacation ? 'On vacation' : dailyShift.off ? 'Not scheduled' : 'Scheduled';
    return `<div class="profile-banner">
      <div>
        <div class="profile-name-row">
          <h2>${esc(person.name)}</h2>
          <span class="role-badge ${person.role === 'tsa' ? 'tsa' : ''}">${esc(roleShort(person.role))}</span>
        </div>
        <div class="profile-meta">${esc(roleLabel(person.role))} • ${esc(shiftLabel(person.shift))}</div>
        ${SV.personScheduleHTML(state, person.id, scheduleDateKey)}
      </div>
      <div class="profile-status ${statusClass}"><i></i>${esc(statusText)}</div>
    </div>`;
  }

  function siteRows(siteIds, mode = 'normal') {
    if (!siteIds.length) return '<div class="no-sites">No sites assigned in this window.</div>';
    return `<div class="site-list-clean">${siteIds.map(id => {
      const site = siteById(id);
      const extra = mode === 'handoff' ? `Hands off at 12pm` : `${Number(site?.tickets30 || 0).toLocaleString()} tickets / 30d`;
      return `<div class="site-row-clean ${mode === 'handoff' ? 'handoff' : ''}"><strong>${esc(id)}</strong><span>${esc(extra)}</span></div>`;
    }).join('')}</div>`;
  }

  function tsaCard(person) {
    const coverage = L.tsaCoverageForEngineer(state, person.id);
    const primary = coverage.primary[0] ? adminById(coverage.primary[0]) : null;
    const early = person.shift === 'morning' ? formatNames(coverage.early) : 'Not on shift';
    const overlap = formatNames(coverage.overlap);
    const late = person.shift === 'mid' ? formatNames(coverage.late) : 'Shift ended';
    return `<article class="team-card">
      <div class="card-kicker">TSA support</div>
      <h3>Your support administrator</h3>
      <p class="card-copy">Primary pairing during the 12–4 overlap, with shift fallback when needed.</p>
      ${primary ? `<div class="tsa-primary"><div class="tsa-avatar">${esc(initials(primary.name))}</div><div><strong>${esc(primary.name)}</strong><small>${esc(shiftLabel(primary.shift))} • Primary TSA</small></div></div>` : '<div class="no-sites">No primary TSA is assigned. Please contact a supervisor.</div>'}
      <div class="coverage-path">
        <div class="coverage-path-row"><span>6am–12pm</span><strong class="${early.includes('Not') ? 'none' : ''}">${esc(early)}</strong></div>
        <div class="coverage-path-row"><span>12pm–4pm</span><strong>${esc(overlap)}</strong></div>
        <div class="coverage-path-row"><span>4pm–8pm</span><strong class="${late.includes('ended') ? 'none' : ''}">${esc(late)}</strong></div>
      </div>
    </article>`;
  }

  function engineerView(person) {
    if (person.vacation) {
      return profileHeader(person) + `<div class="assignment-grid"><article class="team-card full"><div class="card-kicker">Today's status</div><h3>You're marked on vacation.</h3><p class="card-copy">Your site and TSA assignments have been redistributed for coverage. When a supervisor marks you active again, the schedule will rebalance automatically.</p></article></div>`;
    }

    const morningSites = person.shift === 'morning' ? L.activeAssignmentsForPerson(state, person.id, 'morning') : [];
    const overlapSites = L.activeAssignmentsForPerson(state, person.id, 'midday');
    const overlapSet = new Set(overlapSites);
    const handedOff = person.shift === 'morning' ? morningSites.filter(id => !overlapSet.has(id)) : [];
    const morningLoad = L.personStats(state, person.id, 'morning');
    const overlapLoad = L.personStats(state, person.id, 'midday');

    let sitesCard = '';
    if (person.shift === 'morning') {
      sitesCard = `<article class="team-card">
        <div class="card-kicker">6am–12pm</div>
        <h3>Your morning sites</h3>
        <p class="card-copy">You own these sites until the noon handoff.</p>
        ${siteRows(morningSites)}
        <div class="handoff-summary">
          <div class="metric-mini"><strong>${morningLoad.siteCount}</strong><span>sites before noon</span></div>
          <div class="metric-mini"><strong>${morningLoad.ticketLoad.toLocaleString()}</strong><span>30-day ticket weight</span></div>
          <div class="metric-mini"><strong>${handedOff.length}</strong><span>hand off at noon</span></div>
        </div>
      </article>`;
    } else {
      sitesCard = `<article class="team-card">
        <div class="card-kicker">12pm–8pm</div>
        <h3>Your takeover sites</h3>
        <p class="card-copy">These are the sites assigned to you when midday comes online.</p>
        ${siteRows(overlapSites)}
        <div class="handoff-summary">
          <div class="metric-mini"><strong>${overlapLoad.siteCount}</strong><span>assigned sites</span></div>
          <div class="metric-mini"><strong>${overlapLoad.ticketLoad.toLocaleString()}</strong><span>30-day ticket weight</span></div>
          <div class="metric-mini"><strong>12pm</strong><span>coverage begins</span></div>
        </div>
      </article>`;
    }

    let secondSitesCard = '';
    if (person.shift === 'morning') {
      secondSitesCard = `<article class="team-card full">
        <div class="card-kicker">12pm–4pm overlap</div>
        <h3>Noon handoff</h3>
        <p class="card-copy">You retain ${overlapSites.length} site${overlapSites.length === 1 ? '' : 's'}. The sites below move to midday at noon.</p>
        ${handedOff.length ? siteRows(handedOff, 'handoff') : '<div class="no-sites">No sites hand off from you today.</div>'}
      </article>`;
    }

    return profileHeader(person) + `<div class="assignment-grid">${sitesCard}${tsaCard(person)}${secondSitesCard}</div>`;
  }

  function tsaView(admin) {
    if (admin.vacation) {
      return profileHeader(admin) + `<div class="assignment-grid"><article class="team-card full"><div class="card-kicker">Today's status</div><h3>You're marked on vacation.</h3><p class="card-copy">Your engineer pairings have been redistributed to the other TSAs for the day.</p></article></div>`;
    }
    const engineers = ((state.tsaAssignments || {})[admin.id] || []).map(personById).filter(Boolean).filter(p => !p.vacation);
    const rows = engineers.length ? `<div class="engineer-support-list">${engineers.map(p => {
      const load = L.personStats(state, p.id, 'midday');
      return `<div class="engineer-support-row"><div><strong>${esc(p.name)} <span class="role-badge">${esc(roleShort(p.role))}</span></strong><small>${esc(shiftLabel(p.shift))} • ${load.siteCount} active sites • ${load.ticketLoad.toLocaleString()} ticket weight</small></div><span class="shift-pill ${p.shift === 'mid' ? 'mid' : ''}">${p.shift === 'morning' ? 'Morning' : 'Midday'}</span></div>`;
    }).join('')}</div>` : '<div class="no-sites">No engineers are currently paired to you.</div>';
    const diag = L.tsaDiagnostics(state).loads[admin.id] || { engineerCount: 0, morningCount: 0, midCount: 0, supportLoad: 0 };

    return profileHeader(admin) + `<div class="assignment-grid">
      <article class="team-card full">
        <div class="card-kicker">Primary pairings</div>
        <h3>Engineers you support</h3>
        <p class="card-copy">These are your primary 12–4 pairings. Shift fallback still applies outside the overlap.</p>
        ${rows}
        <div class="handoff-summary">
          <div class="metric-mini"><strong>${diag.engineerCount}</strong><span>engineers</span></div>
          <div class="metric-mini"><strong>${diag.morningCount}/${diag.midCount}</strong><span>morning / midday mix</span></div>
          <div class="metric-mini"><strong>${diag.supportLoad.toLocaleString()}</strong><span>support workload weight</span></div>
        </div>
      </article>
    </div>`;
  }

  function renderSelected(id) {
    const person = state.people.find(p => p.id === id) || (state.supportAdmins || []).find(p => p.id === id);
    if (!person) {
      $('assignmentView').hidden = true;
      $('emptyState').hidden = false;
      return;
    }
    $('emptyState').hidden = true;
    $('assignmentView').hidden = false;
    $('assignmentView').innerHTML = person.role === 'tsa' ? tsaView(person) : engineerView(person);
    localStorage.setItem(PERSON_KEY, person.id);
    const url = new URL(window.location.href);
    url.searchParams.set('person', person.id);
    history.replaceState(null, '', url);
    renderTeamSchedule();
  }

  function renderTeamSchedule() {
    const selected = $('personSelect').value || '';
    $('scheduleDate').value = scheduleDateKey;
    $('scheduleSummary').innerHTML = SV.summaryHTML(state, scheduleDateKey);
    $('scheduleBoard').innerHTML = SV.boardHTML(state, scheduleDateKey, { editable: false, selectedPersonId: selected });
  }

  function renderDirectory() {
    const ordered = allPeople().slice().sort((a, b) => {
      const roleOrder = a.role === 'tsa' ? 2 : a.shift === 'morning' ? 0 : 1;
      const roleOrderB = b.role === 'tsa' ? 2 : b.shift === 'morning' ? 0 : 1;
      return roleOrder - roleOrderB || a.name.localeCompare(b.name);
    });
    $('teamDirectory').innerHTML = ordered.map(p => `<button class="directory-card ${p.vacation ? 'vacation' : ''}" data-person="${esc(p.id)}">
      <div class="top"><strong>${esc(p.name)}</strong><span class="mini-role">${esc(roleShort(p.role))}</span></div>
      <small>${p.vacation ? 'On vacation' : esc(shiftLabel(p.shift))}</small>
    </button>`).join('');

    const d = L.diagnostics(state);
    const healthy = !d.morningMissing.length && !d.effectiveMissing.length && !d.tsa.uncoveredWindows.length;
    $('coverageStatus').textContent = healthy ? '✓ Coverage checks clear' : '⚠ Coverage issue — see supervisor';
  }

  function renderFooter() {
    $('lastUpdated').textContent = `Loaded ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function refreshFromStorage() {
    const selected = $('personSelect').value;
    state = loadState();
    renderPicker();
    renderTeamSchedule();
    renderDirectory();
    renderFooter();
    if (selected && allPeople().some(p => p.id === selected)) {
      $('personSelect').value = selected;
      renderSelected(selected);
    }
  }

  $('scheduleDate').addEventListener('change', e => {
    if (!S.isDateKey(e.target.value)) return;
    scheduleDateKey = e.target.value;
    renderTeamSchedule();
    const selected = $('personSelect').value;
    if (selected) renderSelected(selected);
  });
  $('schedulePrevDay').addEventListener('click', () => {
    scheduleDateKey = SV.addDays(scheduleDateKey, -1);
    renderTeamSchedule();
    const selected = $('personSelect').value;
    if (selected) renderSelected(selected);
  });
  $('scheduleNextDay').addEventListener('click', () => {
    scheduleDateKey = SV.addDays(scheduleDateKey, 1);
    renderTeamSchedule();
    const selected = $('personSelect').value;
    if (selected) renderSelected(selected);
  });
  $('scheduleToday').addEventListener('click', () => {
    scheduleDateKey = SV.todayKey();
    renderTeamSchedule();
    const selected = $('personSelect').value;
    if (selected) renderSelected(selected);
  });

  $('personSelect').addEventListener('change', e => renderSelected(e.target.value));
  $('teamDirectory').addEventListener('click', e => {
    const card = e.target.closest('[data-person]');
    if (!card) return;
    $('personSelect').value = card.dataset.person;
    renderSelected(card.dataset.person);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) refreshFromStorage();
  });
  window.addEventListener('focus', refreshFromStorage);

  renderPicker();
  renderTeamSchedule();
  renderDirectory();
  renderFooter();

  const params = new URLSearchParams(window.location.search);
  const initial = params.get('person') || localStorage.getItem(PERSON_KEY) || '';
  if (initial && allPeople().some(p => p.id === initial)) {
    $('personSelect').value = initial;
    renderSelected(initial);
  }
})();
