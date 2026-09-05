const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views', 'admin'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'kpk-cricket-league-admin-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

const DATA_FILE = path.join(__dirname, 'data', 'data.json');

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function authMiddleware(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// ==================== ADMIN ROUTES ====================

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin/login', (req, res) => {
  res.render('login');
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid credentials' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/admin', authMiddleware, (req, res) => {
  const data = loadData();
  res.render('dashboard', { data });
});

app.get('/admin/teams', authMiddleware, (req, res) => {
  const data = loadData();
  res.render('teams', { data });
});

app.get('/admin/players', authMiddleware, (req, res) => {
  const data = loadData();
  res.render('players', { data });
});

app.get('/admin/seasons', authMiddleware, (req, res) => {
  const data = loadData();
  res.render('seasons', { data });
});

app.get('/admin/season/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  res.render('season_detail', { data, season });
});

// Admin - Update Team
app.post('/admin/teams/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  if (team) {
    team.name = req.body.name || team.name;
    team.color = req.body.color || team.color;
    team.captain = req.body.captain || team.captain;
    team.wins = parseInt(req.body.wins) || 0;
    team.losses = parseInt(req.body.losses) || 0;
    team.points = parseInt(req.body.points) || 0;
    saveData(data);
  }
  res.redirect('/admin/teams');
});

// Admin - Update Player Profile
app.post('/admin/players/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (player) {
    player.name = req.body.name || player.name;
    player.role = req.body.role || player.role;
    player.age = parseInt(req.body.age) || player.age;
    player.battingStyle = req.body.battingStyle || player.battingStyle;
    player.bowlingStyle = req.body.bowlingStyle || player.bowlingStyle;
    player.jerseyNo = parseInt(req.body.jerseyNo) || player.jerseyNo;
    player.bio = req.body.bio || player.bio;
    saveData(data);
  }
  res.redirect('/admin/players');
});

// Admin - Update Player Stats
app.post('/admin/players/:id/stats', authMiddleware, (req, res) => {
  const data = loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (player) {
    player.matches = parseInt(req.body.matches) || 0;
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
    saveData(data);
  }
  res.redirect('/admin/players');
});

// Admin - Update Season Info
app.post('/admin/seasons/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season) {
    season.name = req.body.name || season.name;
    season.year = parseInt(req.body.year) || season.year;
    season.status = req.body.status || season.status;
    saveData(data);
  }
  res.redirect('/admin/seasons');
});

// Admin - Update Season Points Table
app.post('/admin/season/:id/points/:teamIndex', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.pointsTable[parseInt(req.params.teamIndex)]) {
    const row = season.pointsTable[parseInt(req.params.teamIndex)];
    row.played = parseInt(req.body.played) || 0;
    row.won = parseInt(req.body.won) || 0;
    row.lost = parseInt(req.body.lost) || 0;
    row.tied = parseInt(req.body.tied) || 0;
    row.nrr = req.body.nrr || '0.000';
    row.points = parseInt(req.body.points) || 0;
    saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Season Match
app.post('/admin/season/:id/matches/:matchIndex', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.matches[parseInt(req.params.matchIndex)]) {
    const match = season.matches[parseInt(req.params.matchIndex)];
    match.team1 = req.body.team1 || match.team1;
    match.team2 = req.body.team2 || match.team2;
    match.date = req.body.date || match.date;
    match.time = req.body.time || match.time;
    match.result = req.body.result || match.result;
    saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Playoff Match
app.post('/admin/season/:id/playoff/:matchIndex', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (season && season.playoff[parseInt(req.params.matchIndex)]) {
    const match = season.playoff[parseInt(req.params.matchIndex)];
    match.team1 = req.body.team1 || match.team1;
    match.team2 = req.body.team2 || match.team2;
    match.date = req.body.date || match.date;
    match.time = req.body.time || match.time;
    match.result = req.body.result || match.result;
    saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Season Stats
app.post('/admin/season/:id/stats', authMiddleware, (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.redirect('/admin/seasons');
  season.stats = season.stats || { topRunScorers: [], topWicketTakers: [] };
  saveData(data);
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Runs Stat
app.post('/admin/season/:id/stats/runs/:idx', authMiddleware, (req, res) => {
  const data = loadData();
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
      p.fours = parseInt(req.body.fours) || 0;
      p.sixes = parseInt(req.body.sixes) || 0;
    }
    saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Wickets Stat
app.post('/admin/season/:id/stats/wickets/:idx', authMiddleware, (req, res) => {
  const data = loadData();
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
    }
    saveData(data);
  }
  res.redirect(`/admin/season/${req.params.id}`);
});

// Admin - Update Tournament Info
app.post('/admin/tournament', authMiddleware, (req, res) => {
  const data = loadData();
  data.tournament.name = req.body.name || data.tournament.name;
  data.tournament.season = req.body.season || data.tournament.season;
  data.tournament.description = req.body.description || data.tournament.description;
  saveData(data);
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`KPK Cricket League Admin Panel running at http://localhost:${PORT}/admin`);
});