(function (root, factory) {
  const api = factory(root.SiteScheduleLogic || (typeof require === 'function' ? require('./schedule.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SiteScheduleView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateFromKey(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function addDays(dateKey, amount) {
    const d = dateFromKey(dateKey);
    d.setDate(d.getDate() + Number(amount || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDateLabel(dateKey) {
    return dateFromKey(dateKey).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function roleShort(role) {
    return role === 'tce' ? 'TCE' : role === 'tse' ? 'TSE' : role === 'tsa' ? 'TSA' : String(role || '').toUpperCase();
  }

  function shiftName(shift) {
    return shift === 'morning' ? 'Morning' : 'Midday';
  }

  function axisMarks(state) {
    const timeline = S.timelineRules(state);
    const start = S.timeToMinutes(timeline.start);
    const end = S.timeToMinutes(timeline.end);
    const span = Math.max(1, end - start);
    const marks = [];
    for (let minute = start; minute <= end; minute += 120) {
      const left = ((minute - start) / span) * 100;
      marks.push(`<i class="schedule-hour" style="left:${left.toFixed(4)}%"><span>${esc(S.formatTime(S.minutesToTime(Math.min(minute, 1439))))}</span></i>`);
    }
    return marks.join('');
  }

  function overlapZones(state, stats) {
    const timeline = S.timelineRules(state);
    const start = S.timeToMinutes(timeline.start);
    const end = S.timeToMinutes(timeline.end);
    const span = Math.max(1, end - start);
    return stats.mergedOverlap.map(segment => {
      const left = ((Math.max(start, segment.start) - start) / span) * 100;
      const width = ((Math.min(end, segment.end) - Math.max(start, segment.start)) / span) * 100;
      if (width <= 0) return '';
      return `<i class="schedule-overlap-zone" style="left:${left.toFixed(4)}%;width:${width.toFixed(4)}%" title="Cross-team overlap"></i>`;
    }).join('');
  }

  function overlapLabel(stats) {
    if (!stats.mergedOverlap.length) return { value: 'None', sub: 'No cross-team overlap', tone: 'warn' };
    const windows = stats.mergedOverlap.map(s => `${S.formatTime(S.minutesToTime(s.start))}–${S.formatTime(S.minutesToTime(s.end))}`);
    return { value: windows.join(', '), sub: `${S.formatDuration(stats.overlapMinutes)} total overlap`, tone: 'good' };
  }

  function summaryHTML(state, dateKey) {
    const stats = S.dayStats(state, dateKey);
    const overlap = overlapLabel(stats);
    const card = (label, value, sub, tone = '') => `<div class="schedule-summary-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`;
    return [
      card('Cross-team overlap', overlap.value, overlap.sub, overlap.tone),
      card('Morning scheduled', `${stats.morningHours.toFixed(stats.morningHours % 1 ? 1 : 0)}h`, `${stats.morningCount} people scheduled`),
      card('Midday scheduled', `${stats.midHours.toFixed(stats.midHours % 1 ? 1 : 0)}h`, `${stats.midCount} people scheduled`),
      card('Daily exceptions', String(stats.exceptions), stats.exceptions ? 'Custom shift or day off' : 'Everyone on default shift', stats.exceptions ? 'warn' : '')
    ].join('');
  }

  function editorHTML(person, shift, vacation) {
    if (vacation) return `<div class="schedule-duration"><strong class="schedule-vacation">Vacation</strong><small>Assignments redistributed</small></div>`;
    const disabled = shift.off ? 'disabled' : '';
    const start = shift.off ? '' : shift.start;
    const end = shift.off ? '' : shift.end;
    const status = shift.coverageStatus || 'working';
    return `<div class="schedule-inline-editor" data-schedule-editor="${esc(person.id)}">
      <label><span>Start</span><input type="time" value="${esc(start)}" data-schedule-start="${esc(person.id)}" ${disabled}></label>
      <label><span>End</span><input type="time" value="${esc(end)}" data-schedule-end="${esc(person.id)}" ${disabled}></label>
      <label class="schedule-status-control"><span>Status</span><select data-schedule-status="${esc(person.id)}" ${disabled}><option value="working" ${status==='working'?'selected':''}>Working</option><option value="training" ${status==='training'?'selected':''}>Training</option><option value="meeting" ${status==='meeting'?'selected':''}>Meeting</option><option value="unavailable" ${status==='unavailable'?'selected':''}>Unavailable</option></select></label>
      <button type="button" data-schedule-off="${esc(person.id)}" class="${shift.off ? 'active' : ''}">${shift.off ? 'Restore' : 'Off'}</button>
      <button type="button" data-schedule-reset="${esc(person.id)}">Reset</button>
    </div>`;
  }

  function publicDurationHTML(state, person, shift, dateKey) {
    if (shift.vacation) return `<div class="schedule-duration"><strong class="schedule-vacation">Vacation</strong><small>Not scheduled</small></div>`;
    if (shift.off) return `<div class="schedule-duration"><strong>Off</strong><small>Not scheduled</small>${S.rawOverride(state, person.id, dateKey) ? '<span class="schedule-exception">Exception</span>' : ''}</div>`;
    const status = shift.coverageStatus || 'working';
    const statusLabel = status === 'working' ? '' : `<span class="schedule-exception">${esc(status[0].toUpperCase()+status.slice(1))}</span>`;
    return `<div class="schedule-duration"><strong>${esc(S.formatDuration(shift.durationMinutes))}</strong><small>${esc(S.formatTime(shift.start))}–${esc(S.formatTime(shift.end))}</small>${statusLabel || (S.rawOverride(state, person.id, dateKey) ? '<span class="schedule-exception">Exception</span>' : '')}</div>`;
  }

  function rowHTML(state, person, dateKey, stats, options) {
    const shift = S.getShift(state, person.id, dateKey);
    const pos = S.barPosition(state, shift);
    const selected = options.selectedPersonId === person.id ? 'selected' : '';
    const tsaClass = person.role === 'tsa' ? 'tsa' : '';
    let trackContent = overlapZones(state, stats);
    if (pos) {
      const label = `${S.formatTime(shift.start)}–${S.formatTime(shift.end)}`;
      const statusClass = shift.coverageStatus && shift.coverageStatus !== 'working' ? 'noncoverage' : '';
      const statusText = shift.coverageStatus && shift.coverageStatus !== 'working' ? ` • ${shift.coverageStatus}` : '';
      trackContent += `<div class="schedule-bar ${person.shift === 'mid' ? 'mid' : 'morning'} ${tsaClass} ${statusClass}" style="left:${pos.leftPct.toFixed(4)}%;width:${pos.widthPct.toFixed(4)}%" title="${esc(person.name)} • ${esc(label + statusText)}">${esc(label)}${statusText ? ` • ${esc(shift.coverageStatus)}` : ''}</div>`;
    } else {
      trackContent += `<div class="schedule-off-bar">${shift.vacation ? 'Vacation' : 'Off'}</div>`;
    }

    const right = options.editable ? editorHTML(person, shift, person.vacation) : publicDurationHTML(state, person, shift, dateKey);
    return `<div class="schedule-row ${selected}" data-schedule-person="${esc(person.id)}">
      <div class="schedule-person"><strong>${esc(person.name)}</strong><small>${esc(roleShort(person.role))} • ${esc(shiftName(person.shift))}${person.role === 'tsa' ? ' support' : ' team'}</small></div>
      <div class="schedule-track">${trackContent}</div>
      ${right}
    </div>`;
  }

  function groupPeople(state, shift) {
    return S.allStaff(state)
      .filter(p => p.shift === shift)
      .sort((a, b) => (a.role === 'tsa' ? 1 : 0) - (b.role === 'tsa' ? 1 : 0) || a.name.localeCompare(b.name));
  }

  function boardHTML(state, dateKey, options = {}) {
    const stats = S.dayStats(state, dateKey);
    const axisRight = options.editable ? 'Shift controls' : 'Duration';
    const axis = `<div class="schedule-axis"><div class="schedule-axis-label">Team member</div><div class="schedule-axis-track">${axisMarks(state)}</div><div class="schedule-axis-label" style="text-align:right">${esc(axisRight)}</div></div>`;
    const groups = ['morning', 'mid'].map(shift => {
      const people = groupPeople(state, shift);
      const base = S.scheduleRules(state)[shift];
      return `<div class="schedule-group"><strong>${shift === 'morning' ? 'Morning team' : 'Midday team'}</strong><span>Default ${esc(S.formatTime(base.start))}–${esc(S.formatTime(base.end))}</span></div>${people.map(p => rowHTML(state, p, dateKey, stats, options)).join('')}`;
    }).join('');
    return `<div class="schedule-board-scroll"><div class="schedule-board-inner ${options.editable ? 'editable' : ''}">${axis}${groups}</div></div>`;
  }

  function personScheduleHTML(state, personId, dateKey) {
    const person = S.staffById(state, personId);
    if (!person) return '';
    const shift = S.getShift(state, personId, dateKey);
    if (shift.vacation) return `<div class="schedule-person-mini"><strong>Vacation</strong><span>${esc(formatDateLabel(dateKey))}</span></div>`;
    if (shift.off) return `<div class="schedule-person-mini"><strong>Not scheduled</strong><span>${esc(formatDateLabel(dateKey))}</span></div>`;
    const overlaps = S.overlapsForPerson(state, personId, dateKey);
    const cross = overlaps.filter(x => x.person.shift !== person.shift);
    const pills = cross.slice(0, 8).map(x => `<span class="schedule-overlap-pill">${esc(x.person.name)} • ${esc(S.formatDuration(x.minutes))}</span>`).join('');
    return `<div class="schedule-person-mini"><strong>${esc(S.formatTime(shift.start))}–${esc(S.formatTime(shift.end))} • ${esc(S.formatDuration(shift.durationMinutes))}</strong><span>${esc(formatDateLabel(dateKey))}${S.rawOverride(state, personId, dateKey) ? ' • adjusted shift' : ''}</span></div>${pills ? `<div class="schedule-overlap-list">${pills}</div>` : ''}`;
  }

  return { todayKey, addDays, formatDateLabel, roleShort, summaryHTML, boardHTML, personScheduleHTML };
});
