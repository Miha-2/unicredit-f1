let token = localStorage.getItem('promotor_token');
let currentSubmissionId = null;

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderSubmissionCard(s) {
  const hasConsent = s.consent_marketing == 1;
  const hasTime = !!s.lap_time;
  return `
    <div class="submission-card">
      <div class="sub-main">
        <div class="sub-name">${s.ime} ${s.priimek}</div>
        <div class="sub-email">${s.email}</div>
        <div class="sub-bottom">
          <div class="sub-meta">Prijava: ${formatDateShort(s.created_at)}</div>
          ${hasTime ? `
            <div class="sub-lap">
              <span class="sub-lap-time">${s.lap_time}</span>
              <span class="sub-lap-date">${formatDateShort(s.lap_recorded_at)}</span>
            </div>` : ''}
        </div>
      </div>
      <div class="sub-actions">
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

let searchTimeout = null;

async function search() {
  const q = document.getElementById('search-input').value.trim();
  const el = document.getElementById('search-results');
  if (!q) { el.innerHTML = ''; return; }
  try {
    const res = await fetch('/api/submissions/search?q=' + encodeURIComponent(q), { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    const data = await res.json();
    el.innerHTML = data.length ? data.map(renderSubmissionCard).join('') : '<div class="no-results">Ni zadetkov.</div>';
  } catch {}
}

function openModal(submissionId, name) {
  currentSubmissionId = submissionId;
  document.getElementById('modal-person').textContent = name;
  document.getElementById('modal-time').value = '';
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('time-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('time-modal').style.display = 'none';
  currentSubmissionId = null;
}

async function saveTime() {
  const lap_time = document.getElementById('modal-time').value.trim();
  const errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';

  if (!lap_time) {
    errEl.textContent = 'Vnesite čas.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/simulator', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ submission_id: currentSubmissionId, lap_time })
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
    localStorage.setItem('promotor_name', data.name);
    showDashboard(data.name);
  } catch {
    errEl.textContent = 'Napaka pri povezavi.';
    errEl.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('promotor_token');
  localStorage.removeItem('promotor_name');
  token = null;
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
}

function showDashboard(name) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-screen').style.display = 'block';
  const u = document.getElementById('dash-username');
  if (u) u.textContent = name || '';
  loadRecent();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('login-username').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });
  document.getElementById('login-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });
  document.getElementById('search-btn').addEventListener('click', search);
  document.getElementById('search-input').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(search, 250);
  });
  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearTimeout(searchTimeout); search(); }
  });
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveTime);

  if (token) {
    fetch('/api/submissions/recent', { headers: getAuthHeaders() }).then(r => {
      if (r.ok) {
        const name = localStorage.getItem('promotor_name') || '';
        showDashboard(name);
      } else {
        logout();
      }
    }).catch(logout);
  }
});
