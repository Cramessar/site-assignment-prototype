(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SiteScheduleLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function allStaff(state) {
    return [...(state.people || []), ...(state.supportAdmins || [])];
  }

  function staffById(state, personId) {
    return allStaff(state).find(p => p.id === personId) || null;
  }

  function scheduleRules(state) {
    const configured = state?.rules?.scheduleDefaults || {};
    return {
      morning: configured.morning || { start: '06:00', end: '16:00' },
      mid: configured.mid || { start: '12:00', end: '20:00' }
    };
  }

  function timelineRules(state) {
    const configured = state?.rules?.scheduleTimeline || {};
    return {
      start: configured.start || '05:00',
      end: configured.end || '21:00'
    };
  }

  function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function timeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function minutesToTime(value) {
    const minutes = Math.max(0, Math.min(1439, Math.round(Number(value) || 0)));
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function formatTime(value) {
    const minutes = timeToMinutes(value);
    if (minutes == null) return '—';
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    if (!mins) return `${hours}h`;
    if (!hours) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  function defaultShiftForPerson(state, personId) {
    const person = staffById(state, personId);
    if (!person) return null;
    const defaults = scheduleRules(state);
    const base = defaults[person.shift] || defaults.morning;
    return { start: base.start, end: base.end, off: false, coverageStatus: 'working', source: 'default' };
  }

  function rawOverride(state, personId, dateKey) {
    if (!isDateKey(dateKey)) return null;
    return state?.scheduleOverrides?.[dateKey]?.[personId] || null;
  }

  function getShift(state, personId, dateKey) {
    const person = staffById(state, personId);
    if (!person) return null;
    if (person.vacation) {
      return { start: null, end: null, off: true, vacation: true, coverageStatus: 'vacation', source: 'vacation', durationMinutes: 0 };
    }

    const base = defaultShiftForPerson(state, personId);
    const override = rawOverride(state, personId, dateKey);
    const value = override ? { ...base, ...override, source: 'override' } : base;
    if (value.off) return { ...value, start: null, end: null, off: true, vacation: false, coverageStatus: value.coverageStatus || 'off', durationMinutes: 0 };

    const startMinutes = timeToMinutes(value.start);
    const endMinutes = timeToMinutes(value.end);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      return { ...base, source: 'default', invalidOverride: Boolean(override), durationMinutes: timeToMinutes(base.end) - timeToMinutes(base.start) };
    }
    return { ...value, off: false, vacation: false, coverageStatus: value.coverageStatus || 'working', durationMinutes: endMinutes - startMinutes };
  }

  function ensureOverrides(next, dateKey) {
    if (!next.scheduleOverrides || typeof next.scheduleOverrides !== 'object') next.scheduleOverrides = {};
    if (!next.scheduleOverrides[dateKey] || typeof next.scheduleOverrides[dateKey] !== 'object') next.scheduleOverrides[dateKey] = {};
  }

  function setShift(state, personId, dateKey, start, end) {
    const next = clone(state);
    if (!staffById(next, personId) || !isDateKey(dateKey)) return next;
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return next;
    ensureOverrides(next, dateKey);
    const existing = next.scheduleOverrides[dateKey][personId] || {};
    next.scheduleOverrides[dateKey][personId] = { ...existing, start, end, off: false, coverageStatus: existing.coverageStatus || 'working' };
    return next;
  }

  function setOff(state, personId, dateKey, off = true) {
    const next = clone(state);
    if (!staffById(next, personId) || !isDateKey(dateKey)) return next;
    ensureOverrides(next, dateKey);
    if (off) {
      next.scheduleOverrides[dateKey][personId] = { off: true, coverageStatus: 'off' };
    } else {
      const base = defaultShiftForPerson(next, personId);
      next.scheduleOverrides[dateKey][personId] = { start: base.start, end: base.end, off: false, coverageStatus: 'working' };
    }
    return next;
  }


  function setCoverageStatus(state, personId, dateKey, coverageStatus) {
    const allowed = new Set(['working', 'training', 'meeting', 'unavailable']);
    const next = clone(state);
    if (!staffById(next, personId) || !isDateKey(dateKey) || !allowed.has(coverageStatus)) return next;
    ensureOverrides(next, dateKey);
    const existing = next.scheduleOverrides[dateKey][personId] || {};
    const base = defaultShiftForPerson(next, personId);
    next.scheduleOverrides[dateKey][personId] = {
      start: existing.start || base.start,
      end: existing.end || base.end,
      off: false,
      ...existing,
      coverageStatus
    };
    return next;
  }

  function clearOverride(state, personId, dateKey) {
    const next = clone(state);
    if (!next.scheduleOverrides?.[dateKey]) return next;
    delete next.scheduleOverrides[dateKey][personId];
    if (!Object.keys(next.scheduleOverrides[dateKey]).length) delete next.scheduleOverrides[dateKey];
    return next;
  }

  function clearDay(state, dateKey) {
    const next = clone(state);
    if (next.scheduleOverrides?.[dateKey]) delete next.scheduleOverrides[dateKey];
    return next;
  }

  function intervalForShift(shift) {
    if (!shift || shift.off || shift.vacation) return null;
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    if (start == null || end == null || end <= start) return null;
    return { start, end };
  }


  function intervalForCoverage(shift) {
    if (!shift || shift.off || shift.vacation) return null;
    if ((shift.coverageStatus || 'working') !== 'working') return null;
    return intervalForShift(shift);
  }

  function overlapMinutes(a, b) {
    const left = intervalForShift(a);
    const right = intervalForShift(b);
    if (!left || !right) return 0;
    return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
  }

  function overlapsForPerson(state, personId, dateKey) {
    const own = getShift(state, personId, dateKey);
    if (!intervalForShift(own)) return [];
    return allStaff(state)
      .filter(p => p.id !== personId)
      .map(person => {
        const shift = getShift(state, person.id, dateKey);
        return { person, shift, minutes: overlapMinutes(own, shift) };
      })
      .filter(item => item.minutes > 0)
      .sort((a, b) => (b.minutes - a.minutes) || a.person.name.localeCompare(b.person.name));
  }

  function coverageSegments(intervals) {
    const points = [];
    intervals.forEach(interval => {
      if (!interval) return;
      points.push({ at: interval.start, delta: 1 });
      points.push({ at: interval.end, delta: -1 });
    });
    points.sort((a, b) => (a.at - b.at) || (a.delta - b.delta));
    if (!points.length) return [];
    const segments = [];
    let count = 0;
    let last = points[0].at;
    let i = 0;
    while (i < points.length) {
      const at = points[i].at;
      if (at > last && count > 0) segments.push({ start: last, end: at, count });
      while (i < points.length && points[i].at === at) {
        count += points[i].delta;
        i += 1;
      }
      last = at;
    }
    return segments;
  }

  function crossTeamOverlapSegments(state, dateKey) {
    const morningIntervals = allStaff(state)
      .filter(p => p.shift === 'morning')
      .map(p => intervalForShift(getShift(state, p.id, dateKey)))
      .filter(Boolean);
    const midIntervals = allStaff(state)
      .filter(p => p.shift === 'mid')
      .map(p => intervalForShift(getShift(state, p.id, dateKey)))
      .filter(Boolean);

    const morningCoverage = coverageSegments(morningIntervals);
    const midCoverage = coverageSegments(midIntervals);
    const overlaps = [];
    morningCoverage.forEach(m => {
      midCoverage.forEach(d => {
        const start = Math.max(m.start, d.start);
        const end = Math.min(m.end, d.end);
        if (end > start) overlaps.push({ start, end, morningCount: m.count, midCount: d.count });
      });
    });
    return overlaps;
  }

  function mergeSegments(segments) {
    const sorted = segments.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    sorted.forEach(segment => {
      const last = merged[merged.length - 1];
      if (last && segment.start <= last.end) {
        last.end = Math.max(last.end, segment.end);
      } else {
        merged.push({ start: segment.start, end: segment.end });
      }
    });
    return merged;
  }

  function dayStats(state, dateKey) {
    const rows = allStaff(state).map(person => ({ person, shift: getShift(state, person.id, dateKey) }));
    const activeRows = rows.filter(row => intervalForShift(row.shift));
    const morningRows = activeRows.filter(row => row.person.shift === 'morning');
    const midRows = activeRows.filter(row => row.person.shift === 'mid');
    const overlapSegments = crossTeamOverlapSegments(state, dateKey);
    const mergedOverlap = mergeSegments(overlapSegments);
    const overlapMinutesTotal = mergedOverlap.reduce((sum, s) => sum + (s.end - s.start), 0);
    const exceptions = rows.filter(row => rawOverride(state, row.person.id, dateKey)).length;
    const totalHours = list => list.reduce((sum, row) => sum + row.shift.durationMinutes, 0) / 60;
    return {
      rows,
      activeCount: activeRows.length,
      morningCount: morningRows.length,
      midCount: midRows.length,
      morningHours: totalHours(morningRows),
      midHours: totalHours(midRows),
      exceptions,
      overlapSegments,
      mergedOverlap,
      overlapMinutes: overlapMinutesTotal
    };
  }

  function barPosition(state, shift) {
    const interval = intervalForShift(shift);
    if (!interval) return null;
    const timeline = timelineRules(state);
    const timelineStart = timeToMinutes(timeline.start);
    const timelineEnd = timeToMinutes(timeline.end);
    const span = Math.max(1, timelineEnd - timelineStart);
    const clippedStart = Math.max(timelineStart, Math.min(timelineEnd, interval.start));
    const clippedEnd = Math.max(timelineStart, Math.min(timelineEnd, interval.end));
    return {
      leftPct: ((clippedStart - timelineStart) / span) * 100,
      widthPct: Math.max(0, ((clippedEnd - clippedStart) / span) * 100),
      clippedBefore: interval.start < timelineStart,
      clippedAfter: interval.end > timelineEnd
    };
  }

  return {
    clone,
    allStaff,
    staffById,
    scheduleRules,
    timelineRules,
    isDateKey,
    timeToMinutes,
    minutesToTime,
    formatTime,
    formatDuration,
    defaultShiftForPerson,
    rawOverride,
    getShift,
    setShift,
    setOff,
    setCoverageStatus,
    clearOverride,
    clearDay,
    intervalForShift,
    intervalForCoverage,
    overlapMinutes,
    overlapsForPerson,
    coverageSegments,
    crossTeamOverlapSegments,
    mergeSegments,
    dayStats,
    barPosition
  };
});
