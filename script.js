// Lightbox
  function openLightbox(img) {
    document.getElementById('lightbox-img').src = img.src;
    document.getElementById('lightbox-cap').textContent = img.alt || '';
    document.getElementById('lightbox').classList.add('open');
  }
  document.getElementById('lightbox').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });

(function() {
    // Tee time: Thursday July 9, 2026 at 4:00 PM ET
    var target = new Date('2026-07-09T16:00:00-04:00').getTime();
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      var now = Date.now();
      var diff = target - now;
      if (diff <= 0) {
        document.getElementById('countdown').innerHTML =
          '<div style="font-family:Oswald,sans-serif;font-size:1.1rem;letter-spacing:2px;color:var(--gold);text-transform:uppercase;">🏌️ Tournament is live!</div>';
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      document.getElementById('cd-days').textContent  = pad(d);
      document.getElementById('cd-hours').textContent = pad(h);
      document.getElementById('cd-mins').textContent  = pad(m);
      document.getElementById('cd-secs').textContent  = pad(s);
    }
    tick();
    setInterval(tick, 1000);
  })();

// ── LIVE LEADERBOARD ─────────────────────────────────────────
async function loadLeaderboard() {
  try {
    const res = await fetch('scores.json?t=' + Date.now());
    const data = await res.json();
    renderLeaderboard(data);
  } catch(e) { /* scores.json not available, keep static table */ }
}

function fmtVsPar(diff) {
  if (diff === 0) return '<span class="vs-par even">E</span>';
  if (diff > 0)   return `<span class="vs-par over">+${diff}</span>`;
  return `<span class="vs-par under">${diff}</span>`;
}

function renderLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  const pars = data.pars || [72, 70, 72, 72];

  // Calculate totals
  const players = data.players.map(p => {
    const gross = p.scores.reduce((a, v) => a + (v || 0), 0);
    const strokesTotal = p.scores.reduce((a, v, i) => v !== null ? a + ((p.strokes && p.strokes[i]) || 0) : a, 0);
    const played = p.scores.filter(s => s !== null).length;
    const net = played > 0 ? gross - strokesTotal : null;
    const parTotal = pars.reduce((a, v, i) => p.scores[i] !== null ? a + v : a, 0);
    const netVsPar = net !== null ? net - parTotal : null;
    const grossVsPar = played > 0 ? gross - parTotal : null;
    return { ...p, gross, net, played, parTotal, netVsPar, grossVsPar };
  }).sort((a, b) => {
    if (a.netVsPar === null && b.netVsPar === null) return 0;
    if (a.netVsPar === null) return 1;
    if (b.netVsPar === null) return -1;
    return a.netVsPar - b.netVsPar;
  });

  // Assign positions (with ties)
  let displayPos = 1;
  players.forEach((p, i) => {
    if (i === 0) { p.pos = '1'; return; }
    if (p.netVsPar === players[i-1].netVsPar) {
      p.pos = 'T' + displayPos;
      players[i-1].pos = 'T' + displayPos;
    } else {
      displayPos = i + 1;
      p.pos = String(displayPos);
    }
  });

  tbody.innerHTML = '';
  players.forEach((p, i) => {
    const isLeader = i === 0 && p.netVsPar !== null;
    const rowClass = isLeader ? 'lb-leader' : '';
    const posClass = isLeader ? 'pos-num gold' : 'pos-num';

    const roundCells = p.scores.map((s, ri) => {
      if (s === null) return `<td class="score-cell"><span class="score-dash">—</span></td>`;
      const roundNet = s - ((p.strokes && p.strokes[ri]) || 0);
      return `<td class="score-cell">
        <span class="round-gross">${s}</span>
        <span class="round-net">net ${roundNet}</span>
      </td>`;
    }).join('');

    const netCell = p.netVsPar !== null
      ? `<td class="score-cell"><span class="net-score ${p.netVsPar > 0 ? 'over' : p.netVsPar < 0 ? 'under' : 'even'}">${p.netVsPar > 0 ? '+' + p.netVsPar : p.netVsPar === 0 ? 'E' : p.netVsPar}</span></td>`
      : `<td class="score-cell"><span class="score-dash">—</span></td>`;

    const grossCell = p.grossVsPar !== null
      ? `<td class="score-cell"><span class="gross-score">${p.grossVsPar > 0 ? '+' + p.grossVsPar : p.grossVsPar === 0 ? 'E' : p.grossVsPar}</span></td>`
      : `<td class="score-cell"><span class="score-dash">—</span></td>`;

    tbody.innerHTML += `
      <tr class="${rowClass}">
        <td><span class="${posClass}">${p.pos || (i + 1)}</span></td>
        <td><span class="player-name-cell">${p.name}</span></td>
        ${netCell}
        ${grossCell}
        ${roundCells}
      </tr>`;
  });
}

loadLeaderboard();

// ── TEE TIMES ─────────────────────────────────────────────────
async function loadTeetimes() {
  try {
    const res = await fetch('pairings.json?t=' + Date.now());
    const data = await res.json();
    renderTeetimes(data);
  } catch(e) {}
}

let ttActiveRound = 0;
let ttData = null;

function renderTeetimes(data) {
  ttData = data;
  const hasAny = data.rounds.some(r => r.groups && r.groups.length > 0);
  if (!hasAny) return;

  const tabsEl = document.getElementById('tt-tabs');
  const bodyEl = document.getElementById('teetimes-body');
  if (!tabsEl || !bodyEl) return;

  tabsEl.innerHTML = data.rounds.map((r, i) =>
    `<button class="tt-tab ${i === 0 ? 'active' : ''}" onclick="showTtRound(${i})">
      R${r.round} · ${r.course}
    </button>`
  ).join('');

  showTtRound(0);
}

function showTtRound(idx) {
  ttActiveRound = idx;
  document.querySelectorAll('.tt-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  const round = ttData.rounds[idx];
  const bodyEl = document.getElementById('teetimes-body');

  if (!round.groups || round.groups.length === 0) {
    bodyEl.innerHTML = `<p style="text-align:center;font-style:italic;color:#888;font-family:'EB Garamond',serif;">Pairings not yet set for this round.</p>`;
    return;
  }

  bodyEl.innerHTML = `
    <p class="tt-date">${round.date} · ${round.course}</p>
    <div class="tt-groups">
      ${round.groups.map((g, gi) => `
        <div class="tt-group">
          <div class="tt-group-header">Group ${gi + 1}${g.teeTime ? ' · ' + g.teeTime : ''}</div>
          ${g.players.map(p => `<div class="tt-player">${p}</div>`).join('')}
        </div>
      `).join('')}
    </div>`;
}

loadTeetimes();
