const express = require('express');
const crypto = require('crypto');
const { loadData, saveData } = require('./store');

const router = express.Router();

const SECRET = process.env.ADMIN_SECRET || 'kpk-cricket-league-admin-2026';
const COOKIE_NAME = 'kpk_admin';
const HOUR = 3600000;
const ADMIN_USER = process.env.ADMIN_USER || 'mia';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE_NAME) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return null; }
    }
  }
  return null;
}

function signToken() {
  const payload = ADMIN_USER + ':' + (Date.now() + HOUR);
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const payload = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const exp = parseInt(payload.split(':')[1], 10);
  return exp > Date.now();
}

function authMiddleware(req, res, next) {
  if (verifyToken(readCookie(req))) return next();
  res.redirect('/admin/login');
}

// ==================== ADMIN ROUTES ====================

router.get('/admin/login', (req, res) => {
  res.render('admin/login');
});

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.cookie(COOKIE_NAME, signToken(), { httpOnly: true, maxAge: HOUR, sameSite: 'lax', secure: req.secure });
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid credentials' });
});

router.get('/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/');
});

router.get('/admin', authMiddleware, async (req, res) => {
  const data = await loadData();
  res.render('admin/dashboard', { data });
});

router.get('/admin/teams', authMiddleware, async (req, res) => {
  const data = await loadData();
  res.render('admin/teams', { data });
});

router.get('/admin/players', authMiddleware, async (req, res) => {
  const data = await loadData();
  res.render('admin/players', { data });
});

router.get('/admin/seasons', authMiddleware, async (req, res) => {
  const data = await loadData();
  res.render('admin/seasons', { data });
});

router.get('/admin/season/:id', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  res.render('admin/season_detail', { data, season });
});

// Admin - Update Team
router.post('/admin/teams/:id', authMiddleware, async (req, res) => {
  const data = await loadData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  if (team) {
    team.name = req.body.name || team.name;
    team.color = req.body.color || team.color;
    team.captain = req.body.captain || team.captain;
    team.wins = parseInt(req.body.wins) || 0;
    team.losses = parseInt(req.body.losses) || 0;
    team.points = parseInt(req.body.points) || 0;
    await saveData(data);
  }
  res.redirect('/admin/teams');
});

// Admin - Update Player Profile
router.post('/admin/players/:id', authMiddleware, async (req, res) => {
  const data = await loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (player) {
    player.name = req.body.name || player.name;
    player.role = req.body.role || player.role;
    player.age = parseInt(req.body.age) || player.age;
    player.battingStyle = req.body.battingStyle || player.battingStyle;
    player.bowlingStyle = req.body.bowlingStyle || player.bowlingStyle;
    player.jerseyNo = parseInt(req.body.jerseyNo) || player.jerseyNo;
    player.bio = req.body.bio || player.bio;
    await saveData(data);
  }
  res.redirect('/admin/players');
});

// Admin - Update Player Stats
router.post('/admin/players/:id/stats', authMiddleware, async (req, res) => {
  const data = await loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (player) {
    player.matches = parseInt(req.body.matches) || 0;
    player.innings = parseInt(req.body.innings) || 0;
    player.runs = parseInt(req.body.runs) || 0;
    player.wickets = parseInt(req.body.wickets) || 0;
    player.average = req.body.average || '0.00';
    player.strikeRate = req.body.strikeRate || '0.00';
    player.bestScore = req.body.bestScore || '0';
    player.bestBowling = req.body.bestBowling || '0/0';
    player.fours = parseInt(req.body.fours) || 0;
    player.sixes = parseInt(req.body.sixes) || 0;
    player.centuries = parseInt(req.body.centuries) || 0;
    player.fifties = parseInt(req.body.fifties) || 0;
    player.highScore = req.body.highScore || '0';
    player.economyRate = req.body.economyRate || '0.00';
    player.fiveWickets = parseInt(req.body.fiveWickets) || 0;
    player.catches = parseInt(req.body.catches) || 0;
    await saveData(data);
  }
  res.redirect('/admin/players');
});

// Admin - Update Season Info
router.post('/admin/seasons/:id', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    season.name = req.body.name || season.name;
    season.year = parseInt(req.body.year) || season.year;
    season.status = req.body.status || season.status;
    await saveData(data);
  }
  res.redirect('/admin/seasons');
});

// Admin - Update Season Points Table
router.post('/admin/season/:id/points/:teamIndex', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.pointsTable[parseInt(req.params.teamIndex)]) {
    const row = season.pointsTable[parseInt(req.params.teamIndex)];
    row.played = parseInt(req.body.played) || 0;
    row.won = parseInt(req.body.won) || 0;
    row.lost = parseInt(req.body.lost) || 0;
    row.tied = parseInt(req.body.tied) || 0;
    row.nrr = req.body.nrr || '0.000';
    row.points = parseInt(req.body.points) || 0;
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Season Match
router.post('/admin/season/:id/matches/:matchIndex', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.matches[parseInt(req.params.matchIndex)]) {
    const match = season.matches[parseInt(req.params.matchIndex)];
    match.team1 = req.body.team1 || match.team1;
    match.team2 = req.body.team2 || match.team2;
    match.date = req.body.date || match.date;
    match.time = req.body.time || match.time;
    match.result = req.body.result || match.result;
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Playoff Match
router.post('/admin/season/:id/playoff/:matchIndex', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.playoff[parseInt(req.params.matchIndex)]) {
    const match = season.playoff[parseInt(req.params.matchIndex)];
    match.team1 = req.body.team1 || match.team1;
    match.team2 = req.body.team2 || match.team2;
    match.date = req.body.date || match.date;
    match.time = req.body.time || match.time;
    match.result = req.body.result || match.result;
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Season Stats
router.post('/admin/season/:id/stats', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  season.stats = season.stats || { topRunScorers: [], topWicketTakers: [] };
  await saveData(data);
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Runs Stat
router.post('/admin/season/:id/stats/runs/:idx', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const list = season.stats.topRunScorers || [];
    const idx = parseInt(req.params.idx);
    if (list[idx]) {
      const p = list[idx];
      p.player = req.body.player || p.player;
      p.team = req.body.team || p.team;
      p.runs = parseInt(req.body.runs) || 0;
      p.avg = req.body.avg || '0.00';
      p.sr = req.body.sr || '0.00';
      p.best = req.body.best || '0';
      p.matches = parseInt(req.body.matches) || 0;
      p.innings = parseInt(req.body.innings) || 0;
      p.fours = parseInt(req.body.fours) || 0;
      p.sixes = parseInt(req.body.sixes) || 0;
    }
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Wickets Stat
router.post('/admin/season/:id/stats/wickets/:idx', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const list = season.stats.topWicketTakers || [];
    const idx = parseInt(req.params.idx);
    if (list[idx]) {
      const p = list[idx];
      p.player = req.body.player || p.player;
      p.team = req.body.team || p.team;
      p.wickets = parseInt(req.body.wickets) || 0;
      p.avg = req.body.avg || '0.00';
      p.eco = req.body.eco || '0.00';
      p.best = req.body.best || '0/0';
      p.matches = parseInt(req.body.matches) || 0;
      p.innings = parseInt(req.body.innings) || 0;
    }
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Tournament Info
router.post('/admin/tournament', authMiddleware, async (req, res) => {
  const data = await loadData();
  data.tournament.name = req.body.name || data.tournament.name;
  data.tournament.season = req.body.season || data.tournament.season;
  data.tournament.description = req.body.description || data.tournament.description;
  await saveData(data);
  res.redirect('/admin');
});

module.exports = router;