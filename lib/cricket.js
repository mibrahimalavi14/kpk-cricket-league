// Cricket scoring & statistics engine (pure functions)

const OVERS_PER_QUOTA_FALLBACK = 3;

function fmtOvers(legalBalls) {
  const o = Math.floor(legalBalls / 6);
  const b = legalBalls % 6;
  return b === 0 ? '' + o : o + '.' + b;
}

function quotaOvers(season) {
  return (season && season.overs) || OVERS_PER_QUOTA_FALLBACK;
}

function squadSizeFor(teamName, data) {
  const team = (data.teams || []).find(t => t.name === teamName);
  const players = (data.players || []).filter(p => p.teamId === (team ? team.id : -1));
  return Math.max(1, players.length);
}

function to2(n) { return Math.round(n * 100) / 100; }
function to3(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }

function overOfBall(balls) {
  const legal = balls.filter(b => b.legal).length;
  return Math.floor(legal / 6) + 1;
}

// Build a ball object from form input
function buildBall(input, currentBalls) {
  const legalBalls = currentBalls.filter(b => b.legal).length;
  const over = Math.floor(legalBalls / 6) + 1;
  const ballInOver = (legalBalls % 6) + 1;
  const extraType = input.extraType || '';
  const isWicket = input.isWicket === '1' || input.wicket === '1';
  const batRuns = parseInt(input.batRuns || input.runs, 10) || 0;
  const extraRuns = parseInt(input.extraRuns, 10) || 0;
  const legal = extraType !== 'wd' && extraType !== 'nb' && !(extraType === 'penalty');
  return {
    over,
    ball: ballInOver,
    striker: input.striker || '',
    nonStriker: input.nonStriker || '',
    bowler: input.bowler || '',
    batRuns,
    extraType,
    extraRuns,
    legal,
    isWicket,
    wicketType: isWicket ? (input.wicketType || 'other') : '',
    fielder: input.fielder || ''
  };
}

// Compute full innings from raw ball list
function computeInnings(balls, quota, squadSize) {
  const batting = {};
  const bowling = {};
  const fow = [];
  const extras = { wd: 0, nb: 0, by: 0, lb: 0 };
  let score = 0;
  let legalBalls = 0;
  let wickets = 0;
  let crr = 0;

  balls.forEach((b) => {
    const bowlerRuns = b.batRuns
      + (b.extraType === 'wd' ? b.extraRuns : 0)
      + (b.extraType === 'nb' ? b.extraRuns : 0)
      + (b.extraType === 'lb' ? b.extraRuns : 0);
    score += b.batRuns + b.extraRuns;
    if (b.legal) legalBalls++;
    if (b.extraType === 'wd') extras.wd += b.extraRuns;
    else if (b.extraType === 'nb') extras.nb += b.extraRuns;
    else if (b.extraType === 'by') extras.by += b.extraRuns;
    else if (b.extraType === 'lb') extras.lb += b.extraRuns;

    if (b.striker) {
      const ba = batting[b.striker] = batting[b.striker] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, notOut: false, howOut: '', dismisser: '', sr: 0 };
      ba.runs += b.batRuns;
      if (b.batRuns === 4) ba.fours++;
      if (b.batRuns === 6) ba.sixes++;
      if (b.legal || b.extraType === 'nb') ba.balls++;
    }
    if (b.bowler) {
      const bo = bowling[b.bowler] = bowling[b.bowler] || { balls: 0, runs: 0, wickets: 0, maidens: 0, overs: '0', eco: 0 };
      bo.runs += bowlerRuns;
      if (b.legal) bo.balls++;
      if (b.legal && b.isWicket && b.wicketType !== 'runout') bo.wickets++;
    }
    if (b.isWicket) {
      wickets++;
      if (b.striker && batting[b.striker]) {
        batting[b.striker].out = true;
        batting[b.striker].howOut = b.wicketType;
      }
      fow.push({
        score: score,
        wickets: wickets,
        over: fmtOvers(legalBalls),
        player: b.striker,
        howOut: b.wicketType,
        bowler: b.bowler
      });
    }
  });

  const allOutThreshold = squadSize === 1 ? 1 : Math.max(1, squadSize - 1);
  const allOut = wickets >= allOutThreshold;
  const maxLegal = quota * 6;
  const fullOvers = legalBalls >= maxLegal;
  const done = allOut || fullOvers;

  const battingArr = Object.keys(batting).map(name => {
    const b = batting[name];
    b.sr = b.balls > 0 ? to2((b.runs / b.balls) * 100) : 0;
    b.notOut = !b.out && b.balls > 0;
    return { player: name, ...b };
  });

  const bowlingArr = Object.keys(bowling).map(name => {
    const b = bowling[name];
    b.overs = fmtOvers(b.balls);
    b.eco = b.balls > 0 ? to2((b.runs / b.balls) * 6) : 0;
    return { player: name, ...b };
  });

  if (legalBalls > 0) crr = to2((score / legalBalls) * 6);

  return {
    runs: score,
    wickets,
    legalBalls,
    overs: fmtOvers(legalBalls),
    ballStr: fmtOvers(legalBalls),
    extras,
    batting: battingArr,
    bowling: bowlingArr,
    fow,
    crr,
    allOut,
    fullOvers,
    done
  };
}

function inningsSummary(balls, quota, squadSize) {
  return computeInnings(balls || [], quota, squadSize);
}

function commentary(ball) {
  if (ball.isWicket) return 'W ' + (ball.striker || '') + ' ' + (ball.wicketType || '');
  if (ball.extraType === 'wd') return 'Wide +' + (ball.extraRuns || 1);
  if (ball.extraType === 'nb') return 'No Ball +' + (ball.extraRuns || 1);
  if (ball.extraType === 'by') return 'Byes +' + ball.extraRuns;
  if (ball.extraType === 'lb') return 'Leg Byes +' + ball.extraRuns;
  if (ball.batRuns === 6) return 'SIX! Maximum by ' + (ball.striker || '');
  if (ball.batRuns === 4) return 'FOUR! ' + (ball.striker || '');
  if (ball.batRuns > 0) return (ball.batRuns || 1) + ' run' + (ball.batRuns === 1 ? '' : 's') + ' by ' + (ball.striker || '');
  return 'Dot ball by ' + (ball.bowler || '');
}

function matchOutcome(inn1, inn2, team1, team2, data) {
  const s1 = squadSizeFor(team1, data);
  const s2 = squadSizeFor(team2, data);
  if (!inn1 || !inn2) return null;
  const a = inn1.runs, b = inn2.runs;
  if (b > a) {
    const wktsLeft = s2 === 1 ? Math.max(0, 1 - inn2.wickets) : (s2 - 1 - inn2.wickets);
    return { winner: team2, loser: team1, margin: wktsLeft, marginType: 'wickets', text: team2 + ' won by ' + wktsLeft + ' wicket' + (wktsLeft === 1 ? '' : 's') };
  }
  if (a > b) {
    const runs = a - b;
    return { winner: team1, loser: team2, margin: runs, marginType: 'runs', text: team1 + ' won by ' + runs + ' run' + (runs === 1 ? '' : 's') };
  }
  return { winner: null, loser: null, margin: 0, marginType: 'tie', text: 'Match tied' };
}

function netRunRate(teamName, matches, data) {
  let scored = 0, facedBalls = 0, conceded = 0, bowledBalls = 0;
  const quota = quotaOversForMatches(matches);
  matches.forEach(m => {
    const batFirst = m.team1 === teamName;
    const batSecond = m.team2 === teamName;
    if (!batFirst && !batSecond) return;
    const inns = m.innings || [];
    if (inns.length < 2) return;
    let myInn = null, oppInn = null;
    if (batFirst) {
      myInn = inningsSummary(inns[0], quota, squadSizeFor(m.team1, data));
      oppInn = inningsSummary(inns[1], quota, squadSizeFor(m.team2, data));
    }
    if (batSecond) {
      myInn = inningsSummary(inns[1], quota, squadSizeFor(m.team2, data));
      oppInn = inningsSummary(inns[0], quota, squadSizeFor(m.team1, data));
    }
    if (!myInn || !oppInn) return;
    scored += myInn.runs;
    conceded += oppInn.runs;
    facedBalls += myInn.allOut ? quota * 6 : myInn.legalBalls;
    bowledBalls += oppInn.allOut ? quota * 6 : oppInn.legalBalls;
  });
  const facedOvers = facedBalls / 6;
  const bowledOvers = bowledBalls / 6;
  if (!facedOvers && !bowledOvers) return '0.000';
  const pos = facedOvers ? scored / facedOvers : 0;
  const neg = bowledOvers ? conceded / bowledOvers : 0;
  return to3(pos - neg);
}

function quotaOversForMatches(matches) {
  const s = matches[0] && matches[0]._seasonOvers;
  return s || OVERS_PER_QUOTA_FALLBACK;
}

function standingsForSeason(season, data) {
  const teams = (data.teams || []).map(t => t.name);
  const rows = teams.map(name => ({ team: name, played: 0, won: 0, lost: 0, tied: 0, nrr: '0.000', points: 0, position: 0 }));
  const completed = (season.matches || []).filter(m => m.status === 'completed');
  completed.forEach(m => {
    const mySize1 = squadSizeFor(m.team1, data);
    const mySize2 = squadSizeFor(m.team2, data);
    const inn1 = inningsSummary(m.innings && m.innings[0], quotaOvers(season), mySize1);
    const inn2 = inningsSummary(m.innings && m.innings[1], quotaOvers(season), mySize2);
    const out = matchOutcome(inn1, inn2, m.team1, m.team2, data);
    const r1 = rows.find(r => r.team === m.team1);
    const r2 = rows.find(r => r.team === m.team2);
    if (r1) { r1.played++; if (out && out.marginType === 'tie') { r1.tied++; r1.points += 1; } else if (out && out.winner === m.team1) { r1.won++; r1.points += 2; } else if (out) { r1.lost++; } }
    if (r2) { r2.played++; if (out && out.marginType === 'tie') { r2.tied++; r2.points += 1; } else if (out && out.winner === m.team2) { r2.won++; r2.points += 2; } else if (out) { r2.lost++; } }
  });
  // NRR
  const leagueMatches = completed.map(m => ({ ...m, _seasonOvers: quotaOvers(season) }));
  rows.forEach(r => { r.nrr = netRunRate(r.team, leagueMatches, data); });
  const sorted = rows.slice().sort((a, b) => b.points - a.points || parseFloat(b.nrr) - parseFloat(a.nrr));
  sorted.forEach((r, i) => { r.position = i + 1; });
  return rows;
}

function allPlayerAggregates(data, seasonOnly) {
  const bats = {};
  const bowls = {};
  const field = {};
  const playerMatches = {};
  const seenMatch = {};
  (data.seasons || []).forEach(season => {
    if (seasonOnly && season.id !== seasonOnly.id) return;
    const quota = quotaOvers(season);
    [...((season.matches || [])), ...((season.playoff || []))].forEach(m => {
      if (m.status !== 'completed') return;
      const inns = m.innings || [];
      inns.forEach((balls, i) => {
        const teamName = i === 0 ? m.team1 : m.team2;
        const inn = inningsSummary(balls, quota, squadSizeFor(teamName, data));
        inn.batting.forEach(bb => {
          const a = bats[bb.player] = bats[bb.player] || { matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, dismissals: 0, hs: 0, hsNotOut: false, inns: 0, notOuts: 0, fifties: 0, hundreds: 0 };
          playerMatches[bb.player] = playerMatches[bb.player] || {};
          playerMatches[bb.player][String(m.id)] = true;
          a.inns++;
          a.runs += bb.runs;
          a.balls += bb.balls;
          a.fours += bb.fours;
          a.sixes += bb.sixes;
          if (bb.out) a.dismissals++;
          else a.notOuts++;
          if (bb.runs > a.hs) { a.hs = bb.runs; a.hsNotOut = !bb.out; }
          if (bb.runs >= 100) a.hundreds++;
          else if (bb.runs >= 50) a.fifties++;
        });
        inn.bowling.forEach(bb => {
          const a = bowls[bb.player] = bowls[bb.player] || { matches: 0, balls: 0, runs: 0, wickets: 0, inns: 0, bestW: 0, bestR: 9999, fiveW: 0 };
          playerMatches[bb.player] = playerMatches[bb.player] || {};
          playerMatches[bb.player][String(m.id)] = true;
          a.inns++;
          a.balls += bb.balls;
          a.runs += bb.runs;
          a.wickets += bb.wickets;
          if (bb.wickets > a.bestW || (bb.wickets === a.bestW && bb.runs < a.bestR)) { a.bestW = bb.wickets; a.bestR = bb.runs; }
          if (bb.wickets >= 5) a.fiveW++;
        });
      });
    });
  });
  Object.keys(bats).forEach(name => {
    const a = bats[name];
    a.matches = Object.keys(playerMatches[name] || {}).length;
    a.avg = a.dismissals > 0 ? to2(a.runs / a.dismissals) : a.runs > 0 ? a.runs : 0;
    a.sr = a.balls > 0 ? to2((a.runs / a.balls) * 100) : 0;
    a.best = a.hs > 0 ? a.hs + (a.hsNotOut ? '*' : '') : '0';
  });
  Object.keys(bowls).forEach(name => {
    const a = bowls[name];
    a.matches = Math.max(a.matches, Object.keys(playerMatches[name] || {}).length);
    a.overs = fmtOvers(a.balls);
    a.avg = a.wickets > 0 ? to2(a.runs / a.wickets) : 0;
    a.eco = a.balls > 0 ? to2((a.runs / a.balls) * 6) : 0;
    a.best = a.bestW > 0 ? a.bestW + '/' + a.bestR : (a.balls > 0 ? '0/' + a.runs : '0/0');
  });
  return { bats, bowls, field };
}

// --- Performance points (Man of the Match + Player of the Season) ---
// Scheme: batting run=1, four bonus=1, six bonus=2, fifty=+10, hundred=+25, wicket=25, catch/runout/stumping=8.
const PP_FOUR = 1, PP_SIX = 2, PP_FIFTY = 10, PP_HUNDRED = 25, PP_WICKET = 25, PP_FIELD = 8;
const FIELD_WICKETS = ['caught', 'stumped', 'run out', 'runout', 'lbw stumping'];

function matchPoints(season, match, data) {
  const byPlayer = {};
  const add = (name, key, val) => {
    if (!name) return;
    const a = byPlayer[name] = byPlayer[name] || { points: 0, runs: 0, wickets: 0, catches: 0, fours: 0, sixes: 0 };
    a[key] += val;
  };
  const quota = quotaOvers(season);
  const inns = match.innings || [];
  inns.forEach((balls, i) => {
    const teamName = i === 0 ? match.team1 : match.team2;
    const inn = inningsSummary(balls, quota, squadSizeFor(teamName, data));
    inn.batting.forEach(bb => {
      if (!bb.player) return;
      add(bb.player, 'runs', bb.runs);
      add(bb.player, 'fours', bb.fours);
      add(bb.player, 'sixes', bb.sixes);
      let pts = bb.runs + bb.fours * PP_FOUR + bb.sixes * PP_SIX;
      if (bb.runs >= 100) pts += PP_HUNDRED;
      else if (bb.runs >= 50) pts += PP_FIFTY;
      add(bb.player, 'points', pts);
    });
    inn.bowling.forEach(bb => {
      if (!bb.player) return;
      add(bb.player, 'wickets', bb.wickets);
      add(bb.player, 'points', bb.wickets * PP_WICKET);
    });
  });
  // Fielding credits from the raw ball list
  inns.forEach(balls => {
    (balls || []).forEach(b => {
      if (!b.isWicket || !b.fielder) return;
      const wt = (b.wicketType || '').toLowerCase().replace(/\s+/g, ' ');
      if (FIELD_WICKETS.indexOf(wt) !== -1) {
        add(b.fielder, 'catches', 1);
        add(b.fielder, 'points', PP_FIELD);
      }
    });
  });
  let motm = null;
  const tie = (a, b) => a.points !== b.points ? a.points > b.points : a.runs !== b.runs ? a.runs > b.runs : a.name < b.name;
  Object.keys(byPlayer).forEach(name => {
    if (!motm || tie({ name, ...byPlayer[name] }, motm)) motm = { name, ...byPlayer[name] };
  });
  if (motm) {
    const p = (data.players || []).find(x => x.name === motm.name);
    motm.team = p ? p.teamName : '';
  }
  return { byPlayer, motm };
}

function seasonPerformance(season, data) {
  const totals = {};
  const motms = [];
  const seen = {};
  [].concat(season.matches || [], season.playoff || []).forEach(m => {
    if (m.status !== 'completed') return;
    const mp = matchPoints(season, m, data);
    m.motm = mp.motm;
    if (mp.motm) motms.push(mp.motm);
    Object.keys(mp.byPlayer).forEach(name => {
      const a = mp.byPlayer[name];
      const t = totals[name] = totals[name] || { points: 0, runs: 0, wickets: 0, catches: 0, motmAwards: 0, matches: 0, team: '' };
      t.points += a.points;
      t.runs += a.runs;
      t.wickets += a.wickets;
      t.catches += a.catches;
      const key = m.match || m.id;
      if (!seen[name]) seen[name] = {};
      if (!seen[name][key]) { seen[name][key] = true; t.matches++; }
      const p = (data.players || []).find(x => x.name === name);
      if (p) t.team = p.teamName;
    });
    if (mp.motm) {
      const t = totals[mp.motm.name];
      if (t) t.motmAwards++;
    }
  });
  let potm = null;
  Object.keys(totals).forEach(name => {
    const t = totals[name];
    if (!potm || t.points > potm.points || (t.points === potm.points && t.runs > potm.runs)) {
      potm = { player: name, points: t.points, runs: t.runs, wickets: t.wickets, catches: t.catches, motmAwards: t.motmAwards, matches: t.matches, team: t.team };
    }
  });
  return { motms, potm };
}

function seasonChampion(season, data) {
  const fin = season.playoff && season.playoff[season.playoff.length - 1];
  if (fin && fin.status === 'completed' && fin.innings && fin.innings.length >= 2) {
    const inn1 = inningsSummary(fin.innings[0], quotaOvers(season), squadSizeFor(fin.team1, data));
    const inn2 = inningsSummary(fin.innings[1], quotaOvers(season), squadSizeFor(fin.team2, data));
    const out = matchOutcome(inn1, inn2, fin.team1, fin.team2, data);
    if (out && out.winner) {
      return { champion: out.winner, runnerUp: out.winner === fin.team1 ? fin.team2 : fin.team1 };
    }
  }
  return { champion: '', runnerUp: '' };
}

function seasonDateRange(season) {
  const dates = [].concat(season.matches || [], season.playoff || [])
    .map(m => m.date).filter(Boolean)
    .map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
  if (!dates.length) return '';
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const fmt = (d, withYear) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });
  return fmt(min, false) + ' – ' + fmt(max, true);
}

function venueFor(m, data) {
  const t = (data.teams || []).find(x => x.name === m.team1);
  return (t && t.city) ? t.city + ' Ground' : 'KPK Ground';
}

module.exports = {
  fmtOvers,
  quotaOvers,
  squadSizeFor,
  buildBall,
  computeInnings,
  inningsSummary,
  commentary,
  matchOutcome,
  standingsForSeason,
  allPlayerAggregates,
  netRunRate,
  matchPoints,
  seasonPerformance,
  seasonChampion,
  seasonDateRange,
  venueFor,
  to2,
  to3
};