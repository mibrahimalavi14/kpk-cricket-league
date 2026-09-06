const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/admin'));

app.use(require('./lib/admin-router'));

app.listen(PORT, () => {
  console.log(`KPK Cricket League Admin Panel running at http://localhost:${PORT}/admin`);
});