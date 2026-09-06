const express = require('express');
const compression = require('compression');
const path = require('path');
const { loadData } = require('./lib/store');

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

// ==================== PUBLIC ROUTES ====================

app.get('/', handle(async (req, res) => {
  const data = await loadData();
  res.render('index', { data });
}));

app.get('/teams', handle(async (req, res) => {
  const data = await loadData();
  res.render('teams/index', { data });
}));

app.get('/team/:id', handle(async (req, res) => {
  const data = await loadData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  const player = data.players.find(p => p.teamId === parseInt(req.params.id));
  if (!team) return res.status(404).render('404', { data });
  res.render('teams/detail', { data, team, player });
}));

app.get('/players', handle(async (req, res) => {
  const data = await loadData();
  res.render('players/index', { data });
}));

app.get('/player/:id', handle(async (req, res) => {
  const data = await loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).render('404', { data });
  res.render('players/detail', { data, player });
}));

app.get('/seasons', handle(async (req, res) => {
  const data = await loadData();
  res.render('seasons/index', { data });
}));

app.get('/season/:id', handle(async (req, res) => {
  const data = await loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.status(404).render('404', { data });
  res.render('seasons/detail', { data, season });
}));

app.get('/format', handle(async (req, res) => {
  const data = await loadData();
  res.render('format', { data });
}));

app.get('/schedule', handle(async (req, res) => {
  const data = await loadData();
  const season = data.seasons[data.seasons.length - 1];
  res.render('schedule', { data, season });
}));

app.get('/about', handle(async (req, res) => {
  const data = await loadData();
  res.render('about', { data });
}));

app.get('/contact', handle(async (req, res) => {
  const data = await loadData();
  res.render('contact', { data, sent: false });
}));

app.post('/contact', handle(async (req, res) => {
  const data = await loadData();
  res.render('contact', { data, sent: true });
}));

app.get('/faq', handle(async (req, res) => {
  const data = await loadData();
  res.render('faq', { data });
}));

// ==================== ADMIN ROUTES ====================

app.use(require('./lib/admin-router'));

// ==================== 404 ====================

app.use(handle(async (req, res) => {
  const data = await loadData();
  res.status(404).render('404', { data });
}));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KPK Cricket League website running at http://localhost:${PORT}`);
  });
}

module.exports = app;