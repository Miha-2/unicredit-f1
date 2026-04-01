// ── Shared leaderboard module ─────────────────────────────
// Requires: getAuthHeaders(), logout() in the host page's scope

function lbRankClass(i) {
  if (i === 0) return 'lb-rank gold';
  if (i === 1) return 'lb-rank silver';
  if (i === 2) return 'lb-rank bronze';
  return 'lb-rank';
}

function lbRenderTable(rows, emptyMsg) {
  if (!rows.length) return `<div class="lb-empty">${emptyMsg}</div>`;
  return `<table class="lb-table"><tbody>${rows.map((r, i) => `
    <tr>
      <td class="${lbRankClass(i)}">${i + 1}</td>
      <td class="lb-name">${r.ime} ${r.priimek}</td>
      <td class="lb-time">${r.lap_time}</td>
    </tr>`).join('')}</tbody></table>`;
}

async function lbLoad(authHeaders) {
  const res = await fetch('/api/leaderboard', { headers: authHeaders });
  if (res.status === 401) return logout();
  const d = await res.json();
  document.getElementById('lb-day-list').innerHTML = lbRenderTable(d.topDay, 'Danes še ni vpisanih časov.');
  document.getElementById('lb-all-list').innerHTML = lbRenderTable(d.topAll, 'Ni vpisanih časov.');
}

async function lbSearchByName(authHeaders) {
  const q = document.getElementById('lb-search-input').value.trim();
  const el = document.getElementById('lb-search-results');
  if (!q) { el.innerHTML = ''; return; }
  const res = await fetch('/api/submissions/search-time?q=' + encodeURIComponent(q), { headers: authHeaders });
  if (res.status === 401) return logout();
  const data = await res.json();
  if (!data.length) {
    el.innerHTML = '<div class="no-results">Ni zadetkov z vpisanim časom.</div>';
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = data.map(r => {
    const isToday = r.best_recorded_at && r.best_recorded_at.slice(0, 10) === today;
    const dayLabel = isToday ? 'Danes' : (r.best_recorded_at
      ? new Date(r.best_recorded_at).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })
      : null);
    return `
    <div class="time-result-card">
      <div class="time-result-name">${r.ime} ${r.priimek}</div>
      <div class="time-result-time">${r.best_time}</div>
      <div class="time-result-ranks">
        ${r.rank_on_recorded_day ? `<div class="rank-pill">${dayLabel}: <span>#${r.rank_on_recorded_day}</span></div>` : ''}
        ${r.rank_all ? `<div class="rank-pill">Skupaj: <span>#${r.rank_all}</span></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function lbInitEvents(authHeaders) {
  let searchTimeout = null;
  document.getElementById('lb-search-btn').addEventListener('click', () => lbSearchByName(authHeaders));
  document.getElementById('lb-search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => lbSearchByName(authHeaders), 250);
  });
  document.getElementById('lb-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(searchTimeout); lbSearchByName(authHeaders); }
  });
}
