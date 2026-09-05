const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data', 'data.json');

let cachedData = null;
let cachedMtime = 0;

function loadData() {
  const stat = fs.statSync(DATA_FILE);
  if (cachedData && stat.mtimeMs === cachedMtime) return cachedData;
  cachedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  cachedMtime = stat.mtimeMs;
  return cachedData;
}

// ==================== PUBLIC ROUTES ====================

app.get('/', (req, res) => {
  const data = loadData();
  res.render('index', { data });
});

app.get('/teams', (req, res) => {
  const data = loadData();
  res.render('teams/index', { data });
});

app.get('/team/:id', (req, res) => {
  const data = loadData();
  const team = data.teams.find(t => t.id === parseInt(req.params.id));
  const player = data.players.find(p => p.teamId === parseInt(req.params.id));
  if (!team) return res.status(404).render('404', { data });
  res.render('teams/detail', { data, team, player });
});

app.get('/players', (req, res) => {
  const data = loadData();
  res.render('players/index', { data });
});

app.get('/player/:id', (req, res) => {
  const data = loadData();
  const player = data.players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).render('404', { data });
  res.render('players/detail', { data, player });
});

app.get('/seasons', (req, res) => {
  const data = loadData();
  res.render('seasons/index', { data });
});

app.get('/season/:id', (req, res) => {
  const data = loadData();
  const season = data.seasons.find(s => s.id === parseInt(req.params.id));
  if (!season) return res.status(404).render('404', { data });
  res.render('seasons/detail', { data, season });
});

app.get('/format', (req, res) => {
  const data = loadData();
  res.render('format', { data });
});

app.get('/schedule', (req, res) => {
  const data = loadData();
  const season = data.seasons[data.seasons.length - 1];
  res.render('schedule', { data, season });
});

app.get('/about', (req, res) => {
  const data = loadData();
  res.render('about', { data });
});

app.get('/contact', (req, res) => {
  const data = loadData();
  res.render('contact', { data, sent: false });
});

app.post('/contact', (req, res) => {
  const data = loadData();
  res.render('contact', { data, sent: true });
});

app.get('/faq', (req, res) => {
  const data = loadData();
  res.render('faq', { data });
});

app.use((req, res) => {
  const data = loadData();
  res.status(404).render('404', { data });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KPK Cricket League website running at http://localhost:${PORT}`);
  });
}

module.exports = app;