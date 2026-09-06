const express = require('express');
const crypto = require('crypto');
const { loadData, saveData } = require('./store');
const { attach } = require('./compute');
const c = require('./cricket');

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

async function loadAdminData() {
  const data = await loadData();
  return attach(data);
}

function locateMatch(season, id) {
  const mid = parseInt(id);
  const idx = (season.matches || []).findIndex(m => m.id === mid);
  if (idx >= 0) return { match: season.matches[idx], list: season.matches, index: idx, isPlayoff: false };
  const pidx = (season.playoff || []).findIndex(m => m.id === mid);
  if (pidx >= 0) return { match: season.playoff[pidx], list: season.playoff, index: pidx, isPlayoff: true };
  return null;
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
  const data = await loadAdminData();
  res.render('admin/dashboard', { data });
});

router.get('/admin/teams', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  res.render('admin/teams', { data });
});

router.get('/admin/players', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  res.render('admin/players', { data });
});

router.get('/admin/seasons', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  res.render('admin/seasons', { data });
});

router.get('/admin/season/:id', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  res.render('admin/season_detail', { data, season });
});

// Admin - Live Scoring page
router.get('/admin/season/:id/match/:mid', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  const found = locateMatch(season, req.params.mid);
  if (!found) return res.redirect('/admin/season/' + season.id);
  res.render('admin/scoreboard', { data, season, match: found.match, isPlayoff: found.isPlayoff });
});

// Start match scoring (toss + first innings)
router.post('/admin/season/:id/match/:mid/start', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const found = locateMatch(season, req.params.mid);
    if (found) {
      found.match.status = 'live';
      if (!Array.isArray(found.match.innings) || found.match.innings.length === 0) found.match.innings = [[]];
      if (found.match.toss === undefined) found.match.toss = req.body.toss || found.match.team1;
      found.match.result = found.match.toss ? '' : found.match.result;
      await saveData(data);
    }
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// Add a ball
router.post('/admin/season/:id/match/:mid/ball', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  const found = locateMatch(season, req.params.mid);
  if (!found) return res.redirect('/admin/season/' + season.id);

  const match = found.match;
  if (match.status !== 'live') match.status = 'live';
  if (!Array.isArray(match.innings) || match.innings.length === 0) match.innings = [[]];
  if (req.body.wicketType === 'runout' && !req.body.nonStriker) req.body.nonStriker = '';

  const current = match.innings[match.innings.length - 1];
  const quota = c.quotaOvers(season);
  const battTeam = match.innings.length === 1 ? match.team1 : match.team2;
  const size = c.squadSizeFor(battTeam, data);
  const state = c.inningsSummary(current, quota, size);
  if (!state.done) {
    const ball = c.buildBall(req.body, current);
    current.push(ball);
    await saveData(data);
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// End current innings and open the next
router.post('/admin/season/:id/match/:mid/endinnings', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const found = locateMatch(season, req.params.mid);
    if (found && found.match.status === 'live') {
      const match = found.match;
      if (!Array.isArray(match.innings) || match.innings.length === 0) match.innings = [[]];
      if (match.innings.length === 1 && match.innings[0].length > 0) match.innings.push([]);
      await saveData(data);
    }
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// Undo last ball
router.post('/admin/season/:id/match/:mid/undo', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const found = locateMatch(season, req.params.mid);
    if (found && found.match.innings && found.match.innings.length > 0) {
      const last = found.match.innings[found.match.innings.length - 1];
      last.pop();
      if (last.length === 0 && found.match.innings.length > 1) found.match.innings.pop();
      await saveData(data);
    }
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// Complete match -> auto result
router.post('/admin/season/:id/match/:mid/complete', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const found = locateMatch(season, req.params.mid);
    if (found) {
      const match = found.match;
      const quota = c.quotaOvers(season);
      if (match.innings && match.innings.length >= 2) {
        const inn1 = c.inningsSummary(match.innings[0], quota, c.squadSizeFor(match.team1, data));
        const inn2 = c.inningsSummary(match.innings[1], quota, c.squadSizeFor(match.team2, data));
        const out = c.matchOutcome(inn1, inn2, match.team1, match.team2, data);
        match.outcome = out;
        match.result = out ? out.text : 'Match completed';
        match.status = 'completed';
        match.target = inn1.runs + 1;
        await saveData(data);
      }
    }
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// Reset match scoring
router.post('/admin/season/:id/match/:mid/reset', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    const found = locateMatch(season, req.params.mid);
    if (found) {
      found.match.innings = [];
      found.match.status = 'upcoming';
      found.match.result = '';
      found.match.toss = undefined;
      found.match.target = undefined;
      await saveData(data);
    }
  }
  res.redirect('/admin/season/' + req.params.id + '/match/' + req.params.mid);
});

// Admin - Update Team
router.post('/admin/teams/:id', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  if (team) {
    team.name = req.body.name || team.name;
    team.color = req.body.color || team.color;
    team.captain = req.body.captain || team.captain;
    await saveData(data);
  }
  res.redirect('/admin/teams');
});

// Admin - Update Player Profile
router.post('/admin/players/:id', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
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

// Admin - Update Season Info
router.post('/admin/seasons/:id', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    season.name = req.body.name || season.name;
    season.year = parseInt(req.body.year) || season.year;
    season.status = req.body.status || season.status;
    await saveData(data);
  }
  res.redirect('/admin/seasons');
});

// Admin - Update Season Match (fixture metadata only; result is auto-computed)
router.post('/admin/season/:id/matches/:matchIndex', authMiddleware, async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.matches[parseInt(req.params.matchIndex)]) {
    const match = season.matches[parseInt(req.params.matchIndex)];
    match.team1 = req.body.team1 || match.team1;
    match.team2 = req.body.team2 || match.team2;
    match.date = req.body.date || match.date;
    match.time = req.body.time || match.time;
    match.venue = req.body.venue || match.venue;
    await saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Tournament Info
router.post('/admin/tournament', authMiddleware, async (req, res) => {
  const data = await loadAdminData();
  data.tournament.name = req.body.name || data.tournament.name;
  data.tournament.season = req.body.season || data.tournament.season;
  data.tournament.description = req.body.description || data.tournament.description;
  await saveData(data);
  res.redirect('/admin');
});

module.exports = router;