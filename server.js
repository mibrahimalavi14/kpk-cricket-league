const express = require('express');
const compression = require('compression');
const path = require('path');
const { loadData } = require('./lib/store');
const { attach } = require('./lib/compute');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  };
}

async function loadViewData() {
  const data = await loadData();
  return attach(data);
}

function findMatch(data, id) {
  const mid = parseInt(id);
  for (const season of data.seasons) {
    const match = (season.matches || []).find(m => m.id === mid);
    if (match) return { match, season };
    const playoff = (season.playoff || []).find(m => m.id === mid);
    if (playoff) return { match: playoff, season, isPlayoff: true };
  }
  return null;
}

// ==================== PUBLIC ROUTES ====================

app.get('/', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('index', { data });
}));

app.get('/teams', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('teams/index', { data });
}));

app.get('/team/:id', handle(async (req, res) => {
  const data = await loadViewData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  const player = data.players.find(p => p.teamId === parseInt(req.params.id));
  if (!team) return res.status(404).render('404', { data });
  res.render('teams/detail', { data, team, player });
}));

app.get('/players', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('players/index', { data });
}));

app.get('/player/:id', handle(async (req, res) => {
  const data = await loadViewData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).render('404', { data });
  res.render('players/detail', { data, player });
}));

app.get('/seasons', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('seasons/index', { data });
}));

app.get('/season/:id', handle(async (req, res) => {
  const data = await loadViewData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.status(404).render('404', { data });
  res.render('seasons/detail', { data, season });
}));

app.get('/format', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('format', { data });
}));

app.get('/fixtures', handle(async (req, res) => {
  const data = await loadViewData();
  const season = data.seasons[data.seasons.length - 1];
  res.render('fixtures', { data, season });
}));

app.get('/schedule', handle(async (req, res) => {
  const data = await loadViewData();
  const season = data.seasons[data.seasons.length - 1];
  res.render('fixtures', { data, season });
}));

app.get('/live', handle(async (req, res) => {
  const data = await loadViewData();
  const liveMatches = [];
  (data.seasons || []).forEach(season => {
    [].concat(season.matches || [], season.playoff || []).forEach(m => {
      if (m.status === 'live') liveMatches.push({ ...m, seasonName: season.name, seasonId: season.id });
    });
  });
  res.render('live', { data, liveMatches });
}));

app.get('/api/live', handle(async (req, res) => {
  const data = await loadViewData();
  const live = [];
  (data.seasons || []).forEach(season => {
    [].concat(season.matches || [], season.playoff || []).forEach(m => {
      if (m.status === 'live') {
        live.push({
          id: m.id,
          match: m.match,
          team1: m.team1,
          team2: m.team2,
          seasonId: season.id,
          inn1: { runs: m.inn1.runs, wickets: m.inn1.wickets, overs: m.inn1.ballStr, crr: m.inn1.crr },
          inn2: m.innings.length > 1 ? { runs: m.inn2.runs, wickets: m.inn2.wickets, overs: m.inn2.ballStr, crr: m.inn2.crr, target: m.target } : null,
          target: m.target
        });
      }
    });
  });
  res.json({ live });
}));

app.get('/match/:id', handle(async (req, res) => {
  const data = await loadViewData();
  const found = findMatch(data, req.params.id);
  if (!found) return res.status(404).render('404', { data });
  res.render('match', { data, season: found.season, match: found.match, isPlayoff: found.isPlayoff });
}));

app.get('/about', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('about', { data });
}));

app.get('/contact', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('contact', { data, sent: false });
}));

app.post('/contact', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('contact', { data, sent: true });
}));

app.get('/faq', handle(async (req, res) => {
  const data = await loadViewData();
  res.render('faq', { data });
}));

// ==================== ADMIN ROUTES ====================

app.use(require('./lib/admin-router'));

// ==================== 404 ====================

app.use(handle(async (req, res) => {
  const data = await loadViewData();
  res.status(404).render('404', { data });
}));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KPK Cricket League website running at http://localhost:${PORT}`);
  });
}

module.exports = app;