let token = localStorage.getItem('admin_token');

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    const d = await res.json();

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card"><div class="stat-label">Skupaj prijav</div><div class="stat-value">${d.total}</div></div>
      <div class="stat-card"><div class="stat-label">S soglasjem</div><div class="stat-value">${d.withConsent}</div></div>
      <div class="stat-card"><div class="stat-label">Vpisani časi</div><div class="stat-value">${d.totalTimes}</div></div>
    `;

    if (d.top5.length) {
      document.getElementById('top5-list').innerHTML = `
        <table class="admin-table">
          <thead><tr><th>#</th><th>Čas</th><th>Voznik</th><th>Promotor</th><th>Datum</th></tr></thead>
          <tbody>${d.top5.map((r, i) => `
            <tr>
              <td class="rank">${i + 1}</td>
              <td class="lap">${r.lap_time}</td>
              <td>${r.ime} ${r.priimek}</td>
              <td>${r.promotor_name}</td>
              <td>${formatDate(r.recorded_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } else {
      document.getElementById('top5-list').innerHTML = '<div class="no-results" style="font-size:13px;color:rgba(255,255,255,0.18);font-style:italic;padding:12px 0;">Ni vpisanih časov.</div>';
    }

    if (d.byPromotor.length) {
      window._byPromotor = d.byPromotor;
      renderPromotorTable();
    }
  } catch {}
}

async function loadPromotors() {
  try {
    const res = await fetch('/api/admin/promotors', { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    window._promotors = await res.json();
    renderPromotorTable();
  } catch {}
}

function renderPromotorTable() {
  const promotors = window._promotors || [];
  const byPromotor = window._byPromotor || [];
  const el = document.getElementById('promotors-list');

  if (!promotors.length) {
    el.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.18);font-style:italic;padding:12px 0;">Ni promotorjev.</div>';
    return;
  }

  const countMap = {};
  byPromotor.forEach(p => { countMap[p.username] = p.count; });

  el.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Ime</th><th>Username</th><th>Vpisani časi</th><th></th></tr></thead>
      <tbody>${promotors.map(p => `
        <tr>
          <td>${p.name}</td>
          <td style="color:var(--text-muted);">${p.username}</td>
          <td class="lap">${countMap[p.username] || 0}</td>
          <td><button class="btn-delete" onclick="deletePromotor(${p.id})">Izbriši</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function deletePromotor(id) {
  if (!confirm('Res želite izbrisati tega promotorja?')) return;
  try {
    await fetch('/api/admin/promotors/' + id, { method: 'DELETE', headers: getAuthHeaders() });
    loadPromotors();
    loadStats();
  } catch {}
}

function openAddModal() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('add-error').style.display = 'none';
  document.getElementById('add-modal').style.display = 'flex';
}

function closeAddModal() {
  document.getElementById('add-modal').style.display = 'none';
}

async function addPromotor() {
  const name = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const errEl = document.getElementById('add-error');
  errEl.style.display = 'none';

  if (!name || !username || !password) {
    errEl.textContent = 'Izpolnite vsa polja.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/admin/promotors', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Napaka.';
      errEl.style.display = 'block';
      return;
    }
    closeAddModal();
    loadPromotors();
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
    const res = await fetch('/api/auth/admin', {
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
    localStorage.setItem('admin_token', token);
    showDashboard();
  } catch {
    errEl.textContent = 'Napaka pri povezavi.';
    errEl.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('admin_token');
  token = null;
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-screen').style.display = 'block';
  loadStats();
  loadPromotors();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('login-username').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });
  document.getElementById('login-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('add-promotor-btn').addEventListener('click', openAddModal);
  document.getElementById('add-cancel').addEventListener('click', closeAddModal);
  document.getElementById('add-save').addEventListener('click', addPromotor);

  if (token) {
    fetch('/api/admin/stats', { headers: getAuthHeaders() }).then(r => {
      if (r.ok) showDashboard();
      else logout();
    }).catch(logout);
  }
});
