let token = localStorage.getItem('promotor_token');
let currentSubmissionId = null;
let currentPrizeSubmissionId = null;

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

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderSubmissionCard(s) {
  const hasConsent = s.consent_marketing == 1;
  const hasTime = !!s.lap_time;
  const hasPrize1 = s.prize_1_received == 1;
  const hasPrize2 = s.prize_2_received == 1;
  const hasFooter = hasTime || hasConsent;
  const personName = `${s.ime} ${s.priimek}`;
  return `
    <div class="submission-card">
      <div class="sub-body">
        <div class="sub-left">
          <div class="sub-top">
            <div class="sub-name">${s.ime} ${s.priimek}</div>
            <div class="sub-email">${s.email}</div>
            ${s.telefon ? `<div class="sub-email">${s.telefon}</div>` : ''}
          </div>
          <div class="sub-bottom">
            <span class="badge ${hasConsent ? 'badge-yes' : 'badge-no'}">${hasConsent ? 'Nagrada' : 'Brez soglasja'}</span>
            ${hasPrize1 ? '<span class="badge badge-prize">1. nagrada</span>' : ''}
            ${hasPrize2 ? '<span class="badge badge-prize">2. nagrada</span>' : ''}
          </div>
        </div>
        <div class="sub-right">
          <span class="sub-date">${formatDateShort(s.created_at)}</span>
        </div>
      </div>
      ${hasFooter ? `<div class="sub-footer">
        <div class="sub-footer-left">
          ${hasTime ? `<div class="sub-lap"><span class="sub-lap-time">${s.lap_time}</span></div>` : ''}
        </div>
        <div class="sub-footer-right">
          ${hasConsent ? `<button class="btn-add-time" onclick="openModal(${s.id}, '${escapeAttr(personName)}')">
            <svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Čas
          </button>
          <button class="btn-add-time btn-prizes" onclick="openPrizeModal(${s.id}, '${escapeAttr(personName)}', ${hasPrize1 ? 1 : 0}, ${hasPrize2 ? 1 : 0})">
            <svg viewBox="0 0 24 24"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg>
            Nagrade
          </button>` : ''}
        </div>
      </div>` : ''}
    </div>`;
}

// ── Tab switching ─────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tab-prijave').style.display = tab === 'prijave' ? 'block' : 'none';
  document.getElementById('tab-lestvice').style.display = tab === 'lestvice' ? 'block' : 'none';
  document.getElementById('ftab-prijave').classList.toggle('active', tab === 'prijave');
  document.getElementById('ftab-lestvice').classList.toggle('active', tab === 'lestvice');
  if (tab === 'lestvice') lbLoad(getAuthHeaders()).catch(() => {});
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
  document.getElementById('time-mm').value = '';
  document.getElementById('time-ss').value = '';
  document.getElementById('time-ms').value = '';
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('time-modal').style.display = 'flex';
  document.getElementById('time-mm').focus();
}

function closeModal() {
  document.getElementById('time-modal').style.display = 'none';
  currentSubmissionId = null;
}

function openPrizeModal(submissionId, name, prize1, prize2) {
  currentPrizeSubmissionId = submissionId;
  document.getElementById('prize-modal-person').textContent = name;
  document.getElementById('prize-1').checked = !!prize1;
  document.getElementById('prize-2').checked = !!prize2;
  document.getElementById('prize-modal-error').style.display = 'none';
  document.getElementById('prize-modal').style.display = 'flex';
}

function closePrizeModal() {
  document.getElementById('prize-modal').style.display = 'none';
  currentPrizeSubmissionId = null;
}

async function savePrizes() {
  const errEl = document.getElementById('prize-modal-error');
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/submissions/' + currentPrizeSubmissionId + '/prizes', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prize_1_received: document.getElementById('prize-1').checked,
        prize_2_received: document.getElementById('prize-2').checked
      })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Napaka.';
      errEl.style.display = 'block';
      return;
    }
    closePrizeModal();
    loadRecent();
    const q = document.getElementById('search-input').value.trim();
    if (q) search();
  } catch {
    errEl.textContent = 'Napaka pri shranjevanju.';
    errEl.style.display = 'block';
  }
}

async function saveTime() {
  const mm = document.getElementById('time-mm').value.trim();
  const ss = document.getElementById('time-ss').value.trim();
  const ms = document.getElementById('time-ms').value.trim();
  const errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';

  if (mm === '' || ss === '' || ms === '') {
    errEl.textContent = 'Izpolnite vse segmente časa.';
    errEl.style.display = 'block';
    return;
  }

  const ssNum = parseInt(ss);
  const msNum = parseInt(ms);
  if (ssNum > 59) {
    errEl.textContent = 'Sekunde morajo biti med 0 in 59.';
    errEl.style.display = 'block';
    return;
  }

  const lap_time = `${String(mm).padStart(2,'0')}:${String(ssNum).padStart(2,'0')}.${String(msNum).padStart(3,'0')}`;

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

function openChangePwModal() {
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-error').style.display = 'none';
  document.getElementById('change-pw-modal').style.display = 'flex';
}

function closeChangePwModal() {
  document.getElementById('change-pw-modal').style.display = 'none';
}

async function saveChangedPassword() {
  const current_password = document.getElementById('pw-current').value;
  const new_password = document.getElementById('pw-new').value;
  const errEl = document.getElementById('pw-error');
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/auth/promotor/password', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password, new_password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Napaka.'; errEl.style.display = 'block'; return; }
    closeChangePwModal();
  } catch { errEl.textContent = 'Napaka pri shranjevanju.'; errEl.style.display = 'block'; }
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
  setInterval(() => {
    if (document.getElementById('tab-prijave').style.display !== 'none') loadRecent();
    if (document.getElementById('tab-lestvice').style.display !== 'none') lbLoad(getAuthHeaders()).catch(() => {});
  }, 10000);
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
  document.getElementById('change-pw-btn').addEventListener('click', openChangePwModal);
  document.getElementById('pw-cancel').addEventListener('click', closeChangePwModal);
  document.getElementById('pw-save').addEventListener('click', saveChangedPassword);
  document.getElementById('prize-modal-cancel').addEventListener('click', closePrizeModal);
  document.getElementById('prize-modal-save').addEventListener('click', savePrizes);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveTime);

  // Auto-advance between time segments
  document.getElementById('time-mm').addEventListener('input', function() {
    if (this.value.length > 2) this.value = this.value.slice(0, 2);
    if (this.value.length >= 2) document.getElementById('time-ss').focus();
  });
  document.getElementById('time-ss').addEventListener('input', function() {
    if (this.value.length > 2) this.value = this.value.slice(0, 2);
    if (this.value.length >= 2) document.getElementById('time-ms').focus();
  });
  document.getElementById('time-ms').addEventListener('input', function() {
    if (this.value.length > 3) this.value = this.value.slice(0, 3);
  });
  document.getElementById('time-ms').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') saveTime();
  });

  lbInitEvents(getAuthHeaders());

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
