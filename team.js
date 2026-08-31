(() => {
  const SEED = SITE_ASSIGNMENT_SEED;
  const L = SiteCoverageLogic;
  const S = SiteScheduleLogic;
  const SV = SiteScheduleView;
  const DP = DailyPlanLogic;
  const STORAGE_KEY = 'site-coverage-manager-v7';
  const PERSON_KEY = 'site-coverage-team-person';
  let state = DP.normalizeState(loadState());
  let scheduleDateKey = SV.todayKey();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const personById = id => state.people.find(p => p.id === id);
  const adminById = id => (state.supportAdmins || []).find(a => a.id === id);
  const siteById = id => state.sites.find(s => s.id === id);
  const roleShort = (role, title) => title || (role === 'tce' ? 'TCE' : role === 'tse' ? 'TSE' : role === 'tsa' ? 'TSA' : role === 'tss' ? 'TSS' : String(role || '').toUpperCase());
  const roleLabel = (role, title) => title || (role === 'tce' ? 'Technical Control Engineer' : role === 'tse' ? 'Technical Support Engineer' : role === 'tsa' ? 'Technical Support Administrator' : role === 'tss' ? 'Technical Support Supervisor' : role || '');
  const coverageShiftLabel = shift => shift === 'morning' ? 'Weekend Day • 6am–4pm' : 'Weekend Mid • 12pm–8pm';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return L.rebalanceAssignments(L.clone(SEED));
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SEED.version) return L.rebalanceAssignments(L.clone(SEED));
      return DP.normalizeState(parsed);
    } catch {
      return L.rebalanceAssignments(L.clone(SEED));
    }
  }

  function allPeople() {
    return S.allStaff(state);
  }

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }

  function formatNames(ids, type = 'admin') {
    if (!ids || !ids.length) return 'No coverage assigned';
    return ids.map(id => type === 'admin' ? (adminById(id)?.fullName || adminById(id)?.name || id) : (personById(id)?.fullName || personById(id)?.name || id)).join(', ');
  }

  function renderPicker() {
    const groups = S.shiftCatalog(state).map(def => ({
      label: `${def.name} • Supervisor ${def.supervisorName || 'TBD'}`,
      people: allPeople().filter(p => S.operationalShiftId(p) === def.id).sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name))
    })).filter(group => group.people.length);
    $('personSelect').innerHTML = '<option value="">Choose your name…</option>' + groups.map(group =>
      `<optgroup label="${esc(group.label)}">${group.people.map(p => `<option value="${esc(p.id)}">${esc(p.fullName || p.name)}${p.vacation ? ' — Vacation' : ''}</option>`).join('')}</optgroup>`
    ).join('');
  }

  function profileHeader(person) {
    const dailyShift = S.getShift(state, person.id, scheduleDateKey);
    const nonWorking = dailyShift.coverageStatus && dailyShift.coverageStatus !== 'working';
    const statusClass = person.vacation || dailyShift.off || nonWorking ? 'vacation' : '';
    const statusText = person.vacation ? 'On vacation' : dailyShift.off ? 'Not scheduled' : dailyShift.unconfigured ? 'Hours TBD' : nonWorking ? dailyShift.coverageStatus[0].toUpperCase()+dailyShift.coverageStatus.slice(1) : 'Scheduled';
    const def = S.shiftDefinition(state, S.operationalShiftId(person));
    const shiftHours = def?.defaultStart && def?.defaultEnd ? `${S.formatTime(def.defaultStart)}–${S.formatTime(def.defaultEnd)}` : 'default hours TBD';
    const managerText = person.manager ? ` • Manager ${person.manager}` : '';
    return `<div class="profile-banner">
      <div>
        <div class="profile-name-row"><h2>${esc(person.fullName || person.name)}</h2><span class="role-badge ${person.role === 'tsa' ? 'tsa' : ''}">${esc(roleShort(person.role, person.title))}</span></div>
        <div class="profile-meta">${esc(roleLabel(person.role, person.title))} • ${esc(def?.name || 'Unassigned')} • ${esc(shiftHours)}${esc(managerText)}</div>
        <div class="profile-meta"><strong>Shift supervisor:</strong> ${esc(def?.supervisorName || 'Not assigned')}</div>
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
      ${primary ? `<div class="tsa-primary"><div class="tsa-avatar">${esc(initials(primary.name))}</div><div><strong>${esc(primary.fullName || primary.name)}</strong><small>${esc(coverageShiftLabel(primary.shift))} • Primary TSA</small></div></div>` : '<div class="no-sites">No primary TSA is assigned. Please contact a supervisor.</div>'}
      <div class="coverage-path">
        <div class="coverage-path-row"><span>6am–12pm</span><strong class="${early.includes('Not') ? 'none' : ''}">${esc(early)}</strong></div>
        <div class="coverage-path-row"><span>12pm–4pm</span><strong>${esc(overlap)}</strong></div>
        <div class="coverage-path-row"><span>4pm–8pm</span><strong class="${late.includes('ended') ? 'none' : ''}">${esc(late)}</strong></div>
      </div>
    </article>`;
  }

  function planForSelectedDate() {
    const applied = DP.appliedPlan(state, scheduleDateKey);
    return { plan: applied || DP.generatePlan(state, scheduleDateKey), published: Boolean(applied), stale: applied ? DP.isPlanStale(state, scheduleDateKey, applied) : false };
  }

  function dailyPlanCard(person) {
    const planInfo = planForSelectedDate();
    const plan = planInfo.plan;
    const notes = DP.notesForDate(state, scheduleDateKey);
    const personNote = notes.people?.[person.id] || '';
    if (person.role === 'tsa') {
      const windows = (plan.windows || []).map(w => {
        const engineers = Object.entries(w.tsaByEngineer || {}).filter(([,adminId])=>adminId===person.id).map(([id])=>personById(id)?.name||id);
        if (!engineers.length) return '';
        return `<div class="coverage-path-row"><span>${esc(S.formatTime(S.minutesToTime(w.start)))}–${esc(S.formatTime(S.minutesToTime(w.end)))}</span><strong>${esc(engineers.join(', '))}</strong></div>`;
      }).filter(Boolean).join('');
      return `<article class="team-card full daily-live-plan"><div class="card-kicker">${planInfo.published ? 'Published daily plan' : 'Generated daily plan'}</div><h3>Your date-aware TSA coverage</h3><p class="card-copy">This view follows the actual staffing windows for ${esc(SV.formatDateLabel(scheduleDateKey))}.${planInfo.stale ? ' A supervisor has staffing changes pending re-apply.' : ''}</p>${windows || '<div class="no-sites">No TSA coverage windows assigned to you for this date.</div>'}${personNote?`<div class="team-note"><strong>Supervisor note</strong><p>${esc(personNote)}</p></div>`:''}</article>`;
    }
    const windows = (plan.windows || []).filter(w => w.activeEngineers.includes(person.id)).map(w => {
      const sites = w.personSites?.[person.id] || [];
      const adminId = w.tsaByEngineer?.[person.id];
      const load = sites.reduce((sum,id)=>sum+(siteById(id)?.tickets30||0),0);
      return `<div class="daily-window-row"><div><strong>${esc(S.formatTime(S.minutesToTime(w.start)))}–${esc(S.formatTime(S.minutesToTime(w.end)))}</strong><small>${sites.length} sites • ${load.toLocaleString()} ticket weight • TSA ${esc(adminById(adminId)?.fullName || adminById(adminId)?.name || 'Uncovered')}</small></div><div class="daily-window-sites">${sites.map(id=>`<span>${esc(id)}</span>`).join('')}</div></div>`;
    }).join('');
    return `<article class="team-card full daily-live-plan"><div class="card-kicker">${planInfo.published ? 'Published daily plan' : 'Generated daily plan'}</div><h3>Your coverage by time</h3><p class="card-copy">Actual site ownership changes automatically at staffing boundaries.${planInfo.stale ? ' Staffing changed after this plan was published; a supervisor has a re-apply pending.' : ''}</p>${windows || '<div class="no-sites">You have no active coverage window for this date.</div>'}${personNote?`<div class="team-note"><strong>Supervisor note</strong><p>${esc(personNote)}</p></div>`:''}</article>`;
  }

  function teamNoteCard() {
    const note = DP.notesForDate(state, scheduleDateKey).general || '';
    return note ? `<article class="team-card full team-note"><div class="card-kicker">Daily note</div><h3>Supervisor note</h3><p>${esc(note)}</p></article>` : '';
  }

  function engineerView(person) {
    const dailyShift = S.getShift(state, person.id, scheduleDateKey);
    if (person.vacation || dailyShift.off || (dailyShift.coverageStatus || 'working') !== 'working') {
      const reason = person.vacation ? 'vacation' : dailyShift.off ? 'off' : dailyShift.coverageStatus;
      return profileHeader(person) + `<div class="assignment-grid">${dailyPlanCard(person)}${teamNoteCard()}<article class="team-card full"><div class="card-kicker">Daily availability</div><h3>No active site coverage while ${esc(reason)}.</h3><p class="card-copy">The published Daily Plan redistributes coverage to people who are available during this window.</p></article></div>`;
    }
    return profileHeader(person) + `<div class="assignment-grid">${dailyPlanCard(person)}${teamNoteCard()}</div>`;
  }

  function tsaView(admin) {
    const dailyShift = S.getShift(state, admin.id, scheduleDateKey);
    if (admin.vacation || dailyShift.off || (dailyShift.coverageStatus || 'working') !== 'working') {
      const reason = admin.vacation ? 'vacation' : dailyShift.off ? 'off' : dailyShift.coverageStatus;
      return profileHeader(admin) + `<div class="assignment-grid">${dailyPlanCard(admin)}${teamNoteCard()}<article class="team-card full"><div class="card-kicker">Daily availability</div><h3>No TSA coverage while ${esc(reason)}.</h3><p class="card-copy">The Daily Plan moves active engineer support to another available TSA where possible.</p></article></div>`;
    }
    return profileHeader(admin) + `<div class="assignment-grid">${dailyPlanCard(admin)}${teamNoteCard()}</div>`;
  }

  function directoryOnlyView(person) {
    const def = S.shiftDefinition(state, S.operationalShiftId(person));
    const manager = person.manager || 'Not listed';
    return profileHeader(person) + `<div class="assignment-grid">${teamNoteCard()}<article class="team-card full"><div class="card-kicker">Roster assignment</div><h3>${esc(def?.name || 'Unassigned')} team member</h3><p class="card-copy">Manager: <strong>${esc(manager)}</strong> • Shift supervisor: <strong>${esc(def?.supervisorName || 'Not assigned')}</strong>.</p><p class="card-copy">Site and TSA workload assignments are not configured for this shift yet. The schedule calendar and supervisor relationship are active now, so this person can receive default hours and date-specific schedule exceptions.</p>${person.rosterNote?`<div class="team-note"><strong>Roster note</strong><p>${esc(person.rosterNote)}</p></div>`:''}</article></div>`;
  }

  function renderSelected(id) {
    const person = S.staffById(state, id);
    if (!person) {
      $('assignmentView').hidden = true;
      $('emptyState').hidden = false;
      return;
    }
    $('emptyState').hidden = true;
    $('assignmentView').hidden = false;
    const coverageEngineer = state.people.some(p => p.id === person.id);
    const coverageAdmin = (state.supportAdmins || []).some(p => p.id === person.id);
    $('assignmentView').innerHTML = coverageAdmin ? tsaView(person) : coverageEngineer ? engineerView(person) : directoryOnlyView(person);
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
    const order = Object.fromEntries(S.shiftCatalog(state).map((def,i)=>[def.id,i]));
    const ordered = allPeople().slice().sort((a,b)=>(order[S.operationalShiftId(a)]??99)-(order[S.operationalShiftId(b)]??99)||(a.fullName||a.name).localeCompare(b.fullName||b.name));
    $('teamDirectory').innerHTML = ordered.map(p => {
      const def=S.shiftDefinition(state,S.operationalShiftId(p));
      return `<button class="directory-card ${p.vacation ? 'vacation' : ''}" data-person="${esc(p.id)}"><div class="top"><strong>${esc(p.fullName || p.name)}</strong><span class="mini-role">${esc(roleShort(p.role,p.title))}</span></div><small>${p.vacation ? 'On vacation' : esc(def?.name || 'Unassigned')} • ${esc(def?.supervisorName || 'No supervisor')}</small></button>`;
    }).join('');
    const d = L.diagnostics(state);
    const healthy = !d.morningMissing.length && !d.effectiveMissing.length && !d.tsa.uncoveredWindows.length;
    $('coverageStatus').textContent = healthy ? '✓ Current Weekend coverage checks clear' : '⚠ Current Weekend coverage issue — see supervisor';
  }

  function renderShiftLeads() {
    $('shiftLeads').innerHTML = S.shiftCatalog(state).filter(def=>def.id!=='unassigned').map(def=>{
      const hours=def.defaultStart&&def.defaultEnd?`${S.formatTime(def.defaultStart)}–${S.formatTime(def.defaultEnd)}`:'Hours TBD';
      const count=allPeople().filter(p=>S.operationalShiftId(p)===def.id).length;
      return `<div class="shift-lead-card"><span>${esc(def.name)}</span><strong>${esc(def.supervisorName || 'Not assigned')}</strong><small>${esc(def.supervisorTitle || 'Supervisor')} • ${count} people • ${esc(hours)}</small></div>`;
    }).join('');
  }

  function renderFooter() {
    $('lastUpdated').textContent = `Loaded ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function refreshFromStorage() {
    const selected = $('personSelect').value;
    state = DP.normalizeState(loadState());
    renderPicker();
    renderTeamSchedule();
    renderShiftLeads();
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
  renderShiftLeads();
  renderDirectory();
  renderFooter();

  const params = new URLSearchParams(window.location.search);
  const initial = params.get('person') || localStorage.getItem(PERSON_KEY) || '';
  if (initial && allPeople().some(p => p.id === initial)) {
    $('personSelect').value = initial;
    renderSelected(initial);
  }
})();
