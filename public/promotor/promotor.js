let token = localStorage.getItem('promotor_token');
let currentSubmissionId = null;

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderSubmissionCard(s) {
  const hasConsent = s.consent_marketing == 1;
  const hasTime = !!s.lap_time;
  return `
    <div class="submission-card">
      <div class="sub-info">
        <div class="sub-name">${s.ime} ${s.priimek}</div>
        <div class="sub-email">${s.email}</div>
        <div class="sub-meta">Prijava: ${formatDate(s.created_at)}</div>
        ${hasTime ? `<div class="sub-meta" style="color:#4caf50;">Čas simulatorja: ${s.lap_time} · ${formatDate(s.lap_recorded_at)}</div>` : ''}
      </div>
      <div class="sub-badges">
        <span class="badge ${hasConsent ? 'badge-yes' : 'badge-no'}">${hasConsent ? 'Nagrada ✓' : 'Brez soglasja'}</span>
        ${hasConsent ? `<button class="btn-add-time" onclick="openModal(${s.id}, '${s.ime} ${s.priimek}')">+ Čas</button>` : ''}
      </div>
    </div>`;
}

async function loadRecent() {
  try {
    const res = await fetch('/api/submissions/recent', { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    const data = await res.json();
    const el = document.getElementById('recent-list');
    el.innerHTML = data.length ? data.map(renderSubmissionCard).join('') : '<div class="no-results">Ni prijav.</div>';
  } catch {}
}

async function search() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  try {
    const res = await fetch('/api/submissions/search?q=' + encodeURIComponent(q), { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    const data = await res.json();
    const el = document.getElementById('search-results');
    el.innerHTML = data.length ? data.map(renderSubmissionCard).join('') : '<div class="no-results">Ni zadetkov.</div>';
  } catch {}
}

function openModal(submissionId, name) {
  currentSubmissionId = submissionId;
  document.getElementById('modal-person').textContent = name;
  document.getElementById('modal-time').value = '';
  document.getElementById('modal-datetime').value = new Date().toISOString().slice(0, 16);
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('time-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('time-modal').style.display = 'none';
  currentSubmissionId = null;
}

async function saveTime() {
  const lap_time = document.getElementById('modal-time').value.trim();
  const recorded_at = document.getElementById('modal-datetime').value;
  const errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';

  if (!lap_time || !recorded_at) {
    errEl.textContent = 'Izpolnite vsa polja.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/simulator', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ submission_id: currentSubmissionId, lap_time, recorded_at })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Napaka.';
      errEl.style.display = 'block';
      return;
    }
    closeModal();
    loadRecent();
    const q = document.getElementById('search-input').value.trim();
    if (q) search();
  } catch {
    errEl.textContent = 'Napaka pri shranjevanju.';
    errEl.style.display = 'block';
  }
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'Izpolnite vsa polja.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/promotor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Napaka pri prijavi.';
      errEl.style.display = 'block';
      return;
    }
    token = data.token;
    localStorage.setItem('promotor_token', token);
    showDashboard(data.name);
  } catch {
    errEl.textContent = 'Napaka pri povezavi.';
    errEl.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('promotor_token');
  token = null;
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
}

function showDashboard(name) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-screen').style.display = 'block';
  document.getElementById('dash-username').textContent = name || '';
  loadRecent();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('login-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });
  document.getElementById('search-btn').addEventListener('click', search);
  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') search();
  });
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveTime);

  if (token) {
    fetch('/api/submissions/recent', { headers: getAuthHeaders() }).then(r => {
      if (r.ok) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        showDashboard(payload.name);
      } else {
        logout();
      }
    }).catch(logout);
  }
});
