const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { getDb, query, run } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'f1teden-unicredit-secret-2025';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/promotor', (req, res) => res.sendFile(path.join(__dirname, 'public/promotor/promotor.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/admin.html')));

// ── Auth middleware ──────────────────────────────────────
function authPromotor(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Ni avtorizacije.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'promotor' && decoded.role !== 'admin') return res.status(403).json({ error: 'Dostop zavrnjen.' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Neveljaven žeton.' });
  }
}

function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Ni avtorizacije.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Dostop zavrnjen.' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Neveljaven žeton.' });
  }
}

// ── Public: Registration ─────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { ime, priimek, email, consent_rules, consent_marketing } = req.body;
  if (!ime || !priimek || !email || !consent_rules) {
    return res.status(400).json({ error: 'Manjkajoči podatki.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Neveljaven e-poštni naslov.' });
  }
  try {
    const existing = query('SELECT id, consent_marketing FROM submissions WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) {
      const had_consent = !!existing[0].consent_marketing;
      const wants_consent = !!consent_marketing;
      if (had_consent) {
        // Already has consent
        return res.status(409).json({ duplicate: true, scenario: 'has_consent' });
      } else if (wants_consent) {
        // Didn't have consent, now explicitly requests it — update
        run('UPDATE submissions SET consent_marketing = 1 WHERE id = ?', [existing[0].id]);
        return res.json({ success: true, upgraded: true });
      } else {
        // Didn't have consent, still doesn't want it — just say already registered
        return res.status(409).json({ duplicate: true, scenario: 'no_consent' });
      }
    }
    run(
      'INSERT INTO submissions (ime, priimek, email, consent_rules, consent_marketing) VALUES (?, ?, ?, ?, ?)',
      [ime.trim(), priimek.trim(), email.trim().toLowerCase(), consent_rules ? 1 : 0, consent_marketing ? 1 : 0]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Napaka pri shranjevanju.' });
  }
});

// ── Auth: Promotor login ─────────────────────────────────
app.post('/api/auth/promotor', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Vnesite podatke.' });
  const rows = query('SELECT * FROM promotors WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ error: 'Napačno uporabniško ime ali geslo.' });
  const promotor = rows[0];
  const valid = await bcrypt.compare(password, promotor.password_hash);
  if (!valid) return res.status(401).json({ error: 'Napačno uporabniško ime ali geslo.' });
  const token = jwt.sign({ id: promotor.id, username: promotor.username, name: promotor.name, role: 'promotor' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, name: promotor.name });
});

// ── Auth: Admin login ────────────────────────────────────
app.post('/api/auth/admin', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Vnesite podatke.' });
  const rows = query('SELECT * FROM admins WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ error: 'Napačno uporabniško ime ali geslo.' });
  const admin = rows[0];
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: 'Napačno uporabniško ime ali geslo.' });
  const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ── Promotor: Recent submissions ─────────────────────────
app.get('/api/submissions/recent', authPromotor, (req, res) => {
  const rows = query(`
    SELECT s.id, s.ime, s.priimek, s.email, s.consent_marketing, s.created_at,
      (SELECT lap_time FROM simulator_times WHERE submission_id = s.id ORDER BY id DESC LIMIT 1) as lap_time,
      (SELECT recorded_at FROM simulator_times WHERE submission_id = s.id ORDER BY id DESC LIMIT 1) as lap_recorded_at
    FROM submissions s
    ORDER BY s.created_at DESC
    LIMIT 5
  `);
  res.json(rows);
});

// ── Promotor: Search submissions ─────────────────────────
app.get('/api/submissions/search', authPromotor, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = query(`
    SELECT s.id, s.ime, s.priimek, s.email, s.consent_marketing, s.created_at,
      (SELECT lap_time FROM simulator_times WHERE submission_id = s.id ORDER BY id DESC LIMIT 1) as lap_time,
      (SELECT recorded_at FROM simulator_times WHERE submission_id = s.id ORDER BY id DESC LIMIT 1) as lap_recorded_at
    FROM submissions s
    WHERE s.ime LIKE ? OR s.priimek LIKE ? OR (s.ime || ' ' || s.priimek) LIKE ?
    ORDER BY s.created_at DESC
    LIMIT 20
  `, [like, like, like]);
  res.json(rows);
});

// ── Promotor: Record simulator time ──────────────────────
app.post('/api/simulator', authPromotor, (req, res) => {
  const { submission_id, lap_time } = req.body;
  if (!submission_id || !lap_time) {
    return res.status(400).json({ error: 'Manjkajoči podatki.' });
  }
  const sub = query('SELECT id, consent_marketing FROM submissions WHERE id = ?', [submission_id]);
  if (!sub.length) return res.status(404).json({ error: 'Prijava ne obstaja.' });
  if (!sub[0].consent_marketing) return res.status(403).json({ error: 'Oseba ni dala soglasja za nagrado.' });
  const recorded_at = new Date().toISOString();
  const existing = query('SELECT id FROM simulator_times WHERE submission_id = ?', [submission_id]);
  if (existing.length) {
    run('UPDATE simulator_times SET lap_time = ?, recorded_at = ?, promotor_id = ? WHERE submission_id = ?',
      [lap_time, recorded_at, req.user.id, submission_id]);
  } else {
    run('INSERT INTO simulator_times (submission_id, lap_time, recorded_at, promotor_id) VALUES (?, ?, ?, ?)',
      [submission_id, lap_time, recorded_at, req.user.id]);
  }
  res.json({ success: true });
});

// ── Promotor: Leaderboards ───────────────────────────────
app.get('/api/leaderboard', authPromotor, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const topDay = query(`
    SELECT st.lap_time, st.recorded_at, s.ime, s.priimek, s.id as submission_id
    FROM simulator_times st
    JOIN submissions s ON s.id = st.submission_id
    WHERE DATE(st.recorded_at) = ?
    ORDER BY st.lap_time ASC
    LIMIT 5
  `, [today]);
  const topAll = query(`
    SELECT st.lap_time, st.recorded_at, s.ime, s.priimek, s.id as submission_id
    FROM simulator_times st
    JOIN submissions s ON s.id = st.submission_id
    ORDER BY st.lap_time ASC
    LIMIT 5
  `);
  res.json({ topDay, topAll });
});

// ── Promotor: Search by time (name → best time + rank) ───
app.get('/api/submissions/search-time', authPromotor, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = query(`
    SELECT s.id, s.ime, s.priimek,
      (SELECT lap_time FROM simulator_times WHERE submission_id = s.id ORDER BY lap_time ASC LIMIT 1) as best_time,
      (SELECT recorded_at FROM simulator_times WHERE submission_id = s.id ORDER BY lap_time ASC LIMIT 1) as best_recorded_at
    FROM submissions s
    WHERE (s.ime LIKE ? OR s.priimek LIKE ? OR (s.ime || ' ' || s.priimek) LIKE ?)
      AND EXISTS (SELECT 1 FROM simulator_times WHERE submission_id = s.id)
    ORDER BY best_time ASC
    LIMIT 20
  `, [like, like, like]);

  // Compute ranks
  const today = new Date().toISOString().slice(0, 10);
  const allTimes = query(`SELECT submission_id, lap_time FROM simulator_times ORDER BY lap_time ASC`);
  const allDay = query(`SELECT submission_id, lap_time FROM simulator_times WHERE DATE(recorded_at) = ? ORDER BY lap_time ASC`, [today]);

  const rankAll = {};
  allTimes.forEach((r, i) => { if (!rankAll[r.submission_id]) rankAll[r.submission_id] = i + 1; });
  const rankDay = {};
  allDay.forEach((r, i) => { if (!rankDay[r.submission_id]) rankDay[r.submission_id] = i + 1; });

  const result = rows.map(r => {
    const recordedDay = r.best_recorded_at ? r.best_recorded_at.slice(0, 10) : null;
    let rank_on_recorded_day = null;
    if (recordedDay) {
      const dayTimes = query(
        `SELECT submission_id FROM simulator_times WHERE DATE(recorded_at) = ? ORDER BY lap_time ASC`,
        [recordedDay]
      );
      const seen = {};
      dayTimes.forEach((t, i) => { if (!seen[t.submission_id]) seen[t.submission_id] = i + 1; });
      rank_on_recorded_day = seen[r.id] || null;
    }
    return {
      ...r,
      rank_all: rankAll[r.id] || null,
      rank_day: rankDay[r.id] || null,
      rank_on_recorded_day,
    };
  });
  res.json(result);
});

// ── Admin: Stats ─────────────────────────────────────────
app.get('/api/admin/stats', authAdmin, (req, res) => {
  const total = query('SELECT COUNT(*) as count FROM submissions')[0].count;
  const withConsent = query('SELECT COUNT(*) as count FROM submissions WHERE consent_marketing = 1')[0].count;
  const totalTimes = query('SELECT COUNT(*) as count FROM simulator_times')[0].count;
  const bestPerDay = query(`
    SELECT DATE(st.recorded_at) as day,
      MIN(st.lap_time) as best_time,
      s.ime, s.priimek, p.name as promotor_name
    FROM simulator_times st
    JOIN submissions s ON s.id = st.submission_id
    JOIN promotors p ON p.id = st.promotor_id
    GROUP BY DATE(st.recorded_at)
    ORDER BY day DESC
  `);
  const byPromotor = query(`
    SELECT p.name, p.username, COUNT(st.id) as count
    FROM promotors p
    LEFT JOIN simulator_times st ON st.promotor_id = p.id
    GROUP BY p.id
    ORDER BY count DESC
  `);
  res.json({ total, withConsent, totalTimes, bestPerDay, byPromotor });
});

// ── Admin: CSV export ─────────────────────────────────────
app.get('/api/admin/export', (req, res, next) => {
  // Allow token via query string for direct browser download
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Ni avtorizacije.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Dostop zavrnjen.' });
  } catch { return res.status(401).json({ error: 'Neveljaven žeton.' }); }

  const rows = query(`
    SELECT s.ime, s.priimek, s.email, s.consent_marketing,
      (SELECT lap_time FROM simulator_times WHERE submission_id = s.id ORDER BY lap_time ASC LIMIT 1) as best_time
    FROM submissions s
    ORDER BY s.created_at ASC
  `);
  const header = 'Ime,Priimek,Email,Soglasje,Čas';
  const lines = rows.map(r => [
    `"${r.ime}"`, `"${r.priimek}"`, `"${r.email}"`,
    r.consent_marketing ? 'da' : 'ne',
    r.best_time || ''
  ].join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="f1teden-export.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

// ── Admin: List promotors ─────────────────────────────────
app.get('/api/admin/promotors', authAdmin, (req, res) => {
  const rows = query('SELECT id, username, name, created_at FROM promotors ORDER BY created_at DESC');
  res.json(rows);
});

// ── Admin: Add promotor ───────────────────────────────────
app.post('/api/admin/promotors', authAdmin, async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'Vnesite vse podatke.' });
  const existing = query('SELECT id FROM promotors WHERE username = ?', [username]);
  if (existing.length) return res.status(400).json({ error: 'Uporabniško ime je že zasedeno.' });
  const hash = await bcrypt.hash(password, 10);
  run('INSERT INTO promotors (username, password_hash, name) VALUES (?, ?, ?)', [username, hash, name]);
  res.json({ success: true });
});

// ── Admin: Delete promotor ────────────────────────────────
app.delete('/api/admin/promotors/:id', authAdmin, (req, res) => {
  run('DELETE FROM promotors WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── 404 ──────────────────────────────────────────────────
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public/404.html')));
async function seedAdmin() {
  await getDb();
  const existing = query('SELECT id FROM admins WHERE username = ?', ['admin']);
  if (!existing.length) {
    const hash = await bcrypt.hash('admin123', 10);
    run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('Default admin created: admin / admin123');
  }
}

// ── Start ─────────────────────────────────────────────────
getDb().then(() => {
  seedAdmin().then(() => {
    app.listen(PORT, () => {
      console.log(`F1 Teden server running on http://localhost:${PORT}`);
    });
  });
});
