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

function renderLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  // Calculate net totals using GHIN-provided strokes per round
  const players = data.players.map(p => {
    const gross = p.scores.reduce((a, v) => a + (v || 0), 0);
    const strokesTotal = p.scores.reduce((a, v, i) => v !== null ? a + ((p.strokes && p.strokes[i]) || 0) : a, 0);
    const played = p.scores.filter(s => s !== null).length;
    const net = played > 0 ? gross - strokesTotal : null;
    return { ...p, gross, net, played };
  }).sort((a, b) => {
    if (a.net === null && b.net === null) return 0;
    if (a.net === null) return 1;
    if (b.net === null) return -1;
    return a.net - b.net;
  });

  tbody.innerHTML = '';
  players.forEach((p, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? 'pos-num gold' : 'pos-num';
    const rounds = data.courses || ['R1','R2','R3','R4'];
    const cells = p.scores.map(s =>
      s !== null
        ? `<td class="score-cell">${s}</td>`
        : `<td class="score-cell"><span class="score-dash">—</span></td>`
    ).join('');
    const totalCell = p.played > 0
      ? `<td class="score-cell">${p.gross}</td><td class="score-cell" style="color:var(--gold)">${p.net}</td>`
      : `<td class="score-cell"><span class="score-dash">—</span></td><td class="score-cell"><span class="score-dash">—</span></td>`;

    tbody.innerHTML += `
      <tr>
        <td><span class="${posClass}">${pos}</span></td>
        <td><span class="player-name-cell">${p.name}</span></td>
        ${cells}
        ${totalCell}
      </tr>`;
  });
}

loadLeaderboard();
