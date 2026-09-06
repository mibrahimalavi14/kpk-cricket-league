// Attach derived data (points table, stats, playoff bracket, scores, results, aggregates)
// to an in-memory data object. Pure computation — never persists derived fields.

const c = require('./cricket');

function buildSeasonStats(agg, players) {
  const byName = {};
  (players || []).forEach(p => { byName[p.name] = p; });

  const runsList = Object.keys(agg.bats).map(name => {
    const b = agg.bats[name];
    const p = byName[name];
    return {
      player: name,
      team: p ? p.teamName : '',
      runs: b.runs,
      avg: b.avg.toFixed(2),
      sr: b.sr.toFixed(2),
      best: b.best,
      matches: b.matches,
      innings: b.inns,
      fours: b.fours,
      sixes: b.sixes,
      fifties: b.fifties,
      hundreds: b.hundreds,
      notOuts: b.notOuts,
      dismissals: b.dismissals
    };
  }).sort((a, b) => b.runs - a.runs).slice(0, 20);

  const wktsList = Object.keys(agg.bowls).map(name => {
    const b = agg.bowls[name];
    const p = byName[name];
    return {
      player: name,
      team: p ? p.teamName : '',
      wickets: b.wickets,
      avg: b.avg.toFixed(2),
      eco: b.eco.toFixed(2),
      best: b.best,
      matches: b.matches,
      innings: b.inns,
      runs: b.runs,
      fiveW: b.fiveW
    };
  }).sort((a, b) => b.wickets - a.wickets || parseFloat(a.avg) - parseFloat(b.avg)).slice(0, 20);

  return { topRunScorers: runsList, topWicketTakers: wktsList };
}

function attach(data) {
  if (!data || !data.seasons) return data;
  data.tournament = data.tournament || {};

  (data.seasons || []).forEach(season => {
    season.overs = season.overs || data.tournament.overs || 3;
    const quota = c.quotaOvers(season);
    season._quota = quota;

    const allMatches = [].concat(season.matches || [], season.playoff || []);
    allMatches.forEach(m => {
      m.status = m.status || 'upcoming';
      if (!Array.isArray(m.innings)) m.innings = [];
      const size1 = c.squadSizeFor(m.team1, data);
      const size2 = c.squadSizeFor(m.team2, data);
      m.inn1 = c.inningsSummary(m.innings[0], quota, size1);
      m.inn2 = c.inningsSummary(m.innings[1], quota, size2);
      m.venue = m.venue || c.venueFor(m, data);
      if (m.innings.length > 1) m.target = m.inn1.runs + 1;
      if (m.status === 'completed' && m.innings.length >= 2) {
        const out = c.matchOutcome(m.inn1, m.inn2, m.team1, m.team2, data);
        if (out) {
          m.outcome = out;
          m.result = m.result || out.text;
        }
      }
    });

    // Points table (computed from completed league matches)
    season.pointsTable = c.standingsForSeason(season, data);

    // Season stats (computed from completed matches of this season)
    const seasonAgg = c.allPlayerAggregates(data, season);
    season.stats = buildSeasonStats(seasonAgg, data.players || []);

    // Awards: Man of the Match (per completed match) + Player of the Season
    const perf = c.seasonPerformance(season, data);
    season.playerOfSeason = perf.potm;
    season.motms = perf.motms;

    // Champion / runner-up (from completed Grand Final)
    const champ = c.seasonChampion(season, data);
    season.champion = champ.champion;
    season.runnerUp = champ.runnerUp;

    // Season date range from fixtures
    season.dateRange = c.seasonDateRange(season);

    // Playoff auto-qualification per league rules:
    // Top team -> Grand Final directly; 2nd vs 3rd -> Qualifier; Qualifier winner -> Final.
    const leagueDone = (season.matches || []).every(m => m.status === 'completed');
    const sorted = season.pointsTable.slice().sort((a, b) => b.points - a.points || parseFloat(b.nrr) - parseFloat(a.nrr));
    if (season.playoff && season.playoff.length >= 2 && sorted.length >= 3) {
      const q1 = season.playoff[0];
      const fin = season.playoff[1];
      if (leagueDone) {
        if (!q1.team1 || q1.team1 === 'TBD') q1.team1 = sorted[1].team;
        if (!q1.team2 || q1.team2 === 'TBD') q1.team2 = sorted[2].team;
        if (!fin.team1 || fin.team1 === 'TBD') fin.team1 = sorted[0].team;
        if (q1.status === 'completed' && q1.team1 !== 'TBD' && q1.team2 !== 'TBD') {
          const qOut = c.matchOutcome(q1.inn1, q1.inn2, q1.team1, q1.team2, data);
          if (qOut && qOut.winner && (!fin.team2 || fin.team2 === 'TBD')) fin.team2 = qOut.winner;
        }
      }
    }

    // Seed points table "position" for display helpers
    season.pointsByTeam = {};
    season.pointsTable.forEach(r => { season.pointsByTeam[r.team] = r; });
  });

  // Team totals from active season standings
  const active = data.seasons.find(s => s.status === 'Active') || data.seasons[data.seasons.length - 1];
  if (active && active.pointsTable) {
    (data.teams || []).forEach(t => {
      const row = active.pointsTable.find(r => r.team === t.name);
      if (row) {
        t.wins = row.won;
        t.losses = row.lost;
        t.points = row.points;
        t.nrr = row.nrr;
      }
    });
  }

  // Career player aggregates across all completed matches
  const career = c.allPlayerAggregates(data);
  (data.players || []).forEach(p => {
    const b = career.bats[p.name] || {};
    const bw = career.bowls[p.name] || {};
    p.matches = Math.max(b.matches || 0, bw.matches || 0);
    p.innings = b.inns || 0;
    p.runs = b.runs || 0;
    p.average = f2(b.avg);
    p.strikeRate = f2(b.sr);
    p.bestScore = b.best || '0';
    p.highScore = b.best || '0';
    p.fours = b.fours || 0;
    p.sixes = b.sixes || 0;
    p.centuries = b.hundreds || 0;
    p.fifties = b.fifties || 0;
    p.wickets = bw.wickets || 0;
    p.economyRate = f2(bw.eco);
    p.bestBowling = bw.best || '0/0';
    p.fiveWickets = bw.fiveW || 0;
    p.catches = 0;
  });

  return data;
}

function f2(n) {
  return (Math.round((n || 0) * 100) / 100).toFixed(2);
}

module.exports = { attach, buildSeasonStats };