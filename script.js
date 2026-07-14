// 2026 Gallery folder toggle
function toggleGallery2026(card) {
  var expanded = document.getElementById('gallery-2026-expanded');
  var isOpen = expanded.style.display !== 'none';
  expanded.style.display = isOpen ? 'none' : 'block';
  if (card) {
    var hint = card.querySelector('.gallery-folder-hint');
    if (hint) hint.textContent = isOpen ? 'Tap to expand · 53 photos' : 'Tap to collapse ▲';
  }
}

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
    // Countdown elements may have been removed post-tournament — guard against null
    var countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    var target = new Date('2026-07-09T16:00:00-04:00').getTime();
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      var now = Date.now();
      var diff = target - now;
      if (diff <= 0) {
        countdownEl.innerHTML =
          '<div style="font-family:Oswald,sans-serif;font-size:1.1rem;letter-spacing:2px;color:var(--gold);text-transform:uppercase;">🏌️ Tournament is live!</div>';
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var dEl = document.getElementById('cd-days');
      var hEl = document.getElementById('cd-hours');
      var mEl = document.getElementById('cd-mins');
      var sEl = document.getElementById('cd-secs');
      if (dEl) dEl.textContent = pad(d);
      if (hEl) hEl.textContent = pad(h);
      if (mEl) mEl.textContent = pad(m);
      if (sEl) sEl.textContent = pad(s);
    }
    tick();
    setInterval(tick, 1000);
  })();

// ── LIVE LEADERBOARD ─────────────────────────────────────────
function showLeaderboardSkeleton() {
  document.querySelectorAll('#leaderboard-body tr').forEach(row => {
    row.classList.add('lb-skeleton-row');
  });
}

async function loadLeaderboard() {
  showLeaderboardSkeleton();
  try {
    const res = await fetch('scores.json?t=' + Date.now());
    const data = await res.json();
    renderLeaderboard(data);
  } catch(e) {
    // fetch failed — remove skeletons, show static dashes
    document.querySelectorAll('#leaderboard-body .lb-skeleton-row').forEach(row => {
      row.classList.remove('lb-skeleton-row');
    });
  }
}

function fmtVsPar(diff) {
  if (diff === 0) return '<span class="vs-par even">E</span>';
  if (diff > 0)   return `<span class="vs-par over">+${diff}</span>`;
  return `<span class="vs-par under">${diff}</span>`;
}

function renderLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  // Snapshot current row positions + scores before re-render (for FLIP animation)
  const prevRects  = {};
  const prevScores = {};
  tbody.querySelectorAll('tr[data-player]').forEach(row => {
    prevRects[row.dataset.player]  = row.getBoundingClientRect().top;
    prevScores[row.dataset.player] = row.dataset.score;
  });

  const pars = data.pars || [72, 70, 72, 72];

  // Find last completed round (last round where any player has a score)
  let lastRound = -1;
  for (let r = 0; r < 4; r++) {
    if (data.players.some(p => p.scores[r] !== null)) lastRound = r;
  }

  // Previous round positions: cumulative net through lastRound-1
  const prevPositions = {};
  if (lastRound > 0) {
    const prevSorted = data.players.map(p => {
      let nvp = 0, played = 0;
      for (let r = 0; r < lastRound; r++) {
        if (p.scores[r] !== null) {
          nvp += p.scores[r] - ((p.strokes && p.strokes[r]) || 0) - pars[r];
          played++;
        }
      }
      return { name: p.name, nvp: played > 0 ? nvp : null };
    }).sort((a, b) => {
      if (a.nvp === null && b.nvp === null) return 0;
      if (a.nvp === null) return 1;
      if (b.nvp === null) return -1;
      return a.nvp - b.nvp;
    });
    prevSorted.forEach((p, i) => { prevPositions[p.name] = i + 1; });
  }

  // Fire = best net of last round, poop = worst net of last round
  let fireName = null, poopName = null;
  if (lastRound >= 0) {
    const roundNets = data.players
      .filter(p => p.scores[lastRound] !== null)
      .map(p => ({ name: p.name, net: p.scores[lastRound] - ((p.strokes && p.strokes[lastRound]) || 0) }));
    if (roundNets.length > 0) {
      const best  = Math.min(...roundNets.map(p => p.net));
      const worst = Math.max(...roundNets.map(p => p.net));
      fireName = roundNets.find(p => p.net === best).name;
      poopName = roundNets.find(p => p.net === worst).name;
      if (fireName === poopName) poopName = null;
    }
  }

  // Calculate overall totals for display
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

    // Movement arrow
    let arrow = '', arrowStyle = 'color:#888;';
    if (lastRound > 0 && prevPositions[p.name]) {
      const curPos  = i + 1;
      const prevPos = prevPositions[p.name];
      const diff    = prevPos - curPos;
      if (diff > 0)      { arrow = '↑'; arrowStyle = 'color:#2ecc71;font-weight:bold;'; }
      else if (diff < 0) { arrow = '↓'; arrowStyle = 'color:#e74c3c;font-weight:bold;'; }
      else               { arrow = '—'; arrowStyle = 'color:#888;'; }
    } else if (lastRound === 0) {
      arrow = '—';
    }
    const arrowHtml = arrow ? `<span style="font-size:11px;margin-right:5px;${arrowStyle}">${arrow}</span>` : '';

    // Fire / poop badge
    const badge = p.name === fireName ? ' 🔥' : p.name === poopName ? ' 💩' : '';

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
      <tr class="${rowClass}" data-player="${p.name}" data-score="${p.netVsPar ?? ''}">
        <td><span class="${posClass}">${p.pos || (i + 1)}</span></td>
        <td>${arrowHtml}<span class="player-name-cell">${p.name}${badge}</span></td>
        ${netCell}
        ${grossCell}
        ${roundCells}
      </tr>`;
  });

  // ── FLIP ANIMATION ──────────────────────────────────────────
  const newRows = {};
  tbody.querySelectorAll('tr[data-player]').forEach(row => {
    newRows[row.dataset.player] = { el: row, top: row.getBoundingClientRect().top };
  });

  Object.entries(newRows).forEach(([name, { el, top }]) => {
    if (prevRects[name] !== undefined) {
      const delta = prevRects[name] - top;
      if (Math.abs(delta) > 2) {
        el.style.transform  = `translateY(${delta}px)`;
        el.style.transition = 'none';
      }
      if (prevScores[name] !== undefined && prevScores[name] !== el.dataset.score) {
        el.style.background = 'rgba(201,168,76,0.18)';
      }
    } else {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(-12px)';
      el.style.transition = 'none';
    }
  });

  tbody.getBoundingClientRect();

  Object.entries(newRows).forEach(([name, { el }]) => {
    if (prevRects[name] !== undefined) {
      el.style.transition = 'transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94), background 1.2s ease';
      el.style.transform  = 'translateY(0)';
      el.style.background = '';
    } else {
      el.style.transition = 'opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s';
      el.style.opacity    = '1';
      el.style.transform  = 'translateX(0)';
    }
  });
}

// Track last successful load for "Updated X ago" display
window._lbLastUpdated = null;

var _origRenderLb = renderLeaderboard;
renderLeaderboard = function(data) {
  _origRenderLb(data);
  window._lbLastUpdated = Date.now();
};

loadLeaderboard();
setInterval(loadLeaderboard, 30000); // auto-refresh every 30s

// ── WEATHER ───────────────────────────────────────────────────
const TOURNAMENT_DATES = ['2026-07-09','2026-07-10','2026-07-11','2026-07-12'];
const DAY_LABELS = ['Thu Jul 9','Fri Jul 10','Sat Jul 11','Sun Jul 12'];
const DAY_NOTES  = ['Check-in','R1 · R2','R3','R4'];

function weatherDesc(code) {
  if (code === 0)                    return ['☀️','Clear'];
  if (code <= 2)                     return ['🌤️','Partly Cloudy'];
  if (code === 3)                    return ['☁️','Overcast'];
  if (code <= 48)                    return ['🌫️','Fog'];
  if (code <= 55)                    return ['🌦️','Drizzle'];
  if (code <= 65)                    return ['🌧️','Rain'];
  if (code <= 77)                    return ['❄️','Snow'];
  if (code <= 82)                    return ['🌧️','Showers'];
  if (code <= 86)                    return ['🌨️','Snow Showers'];
  if (code <= 99)                    return ['⛈️','Storms'];
  return ['🌡️','Unknown'];
}

async function loadWeather() {
  const el = document.getElementById('weather-widget');
  if (!el) return;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=33.6891&longitude=-78.8867' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=16';
    const res = await fetch(url);
    const data = await res.json();
    const dates = data.daily.time;

    const cards = TOURNAMENT_DATES.map((d, i) => {
      const idx = dates.indexOf(d);
      if (idx === -1) return `
        <div class="wx-card">
          <div class="wx-label">${DAY_LABELS[i]}</div>
          <div class="wx-note">${DAY_NOTES[i]}</div>
          <div class="wx-icon">📅</div>
          <div class="wx-temp">—</div>
          <div class="wx-cond">Not yet available</div>
        </div>`;
      const [icon, desc] = weatherDesc(data.daily.weather_code[idx]);
      const hi = Math.round(data.daily.temperature_2m_max[idx]);
      const lo = Math.round(data.daily.temperature_2m_min[idx]);
      const pop = data.daily.precipitation_probability_max[idx];
      return `
        <div class="wx-card">
          <div class="wx-label">${DAY_LABELS[i]}</div>
          <div class="wx-note">${DAY_NOTES[i]}</div>
          <div class="wx-icon">${icon}</div>
          <div class="wx-temp">${hi}° <span class="wx-lo">/ ${lo}°</span></div>
          <div class="wx-cond">${desc}</div>
          <div class="wx-pop">💧 ${pop}%</div>
        </div>`;
    }).join('');
    el.innerHTML = cards;
  } catch(e) {
    el.innerHTML = '<span style="font-family:Oswald,sans-serif;color:rgba(245,240,232,0.4);font-size:13px;">Could not load forecast</span>';
  }
}
loadWeather();

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

const TEE_INFO = {
  'True Blue':           'Blue Tees · 6,662 yds',
  'Caledonia':           'Black Tees · 6,317 yds',
  'Pawleys Plantation':  'Green/Winged Teal Tees · 6,592 yds',
  'TPC Myrtle Beach':    'Blue Tees · 6,587 yds'
};

function showTtRound(idx) {
  ttActiveRound = idx;
  document.querySelectorAll('.tt-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  const round = ttData.rounds[idx];
  const bodyEl = document.getElementById('teetimes-body');

  if (!round.groups || round.groups.length === 0) {
    bodyEl.innerHTML = `<p style="text-align:center;font-style:italic;color:#888;font-family:'EB Garamond',serif;">Pairings not yet set for this round.</p>`;
    return;
  }

  const teeInfo = TEE_INFO[round.course] || '';

  bodyEl.innerHTML = `
    <p class="tt-date">${round.date} · ${round.course}</p>
    ${teeInfo ? `<p class="tt-tees">${teeInfo}</p>` : ''}
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


// ── PAGE TRANSITIONS ─────────────────────────────────────────
(function() {
  const sections = document.querySelectorAll('section');
  const vh = window.innerHeight;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('ff-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top > vh * 0.85) {
      section.classList.add('ff-animate');
      observer.observe(section);
    }
  });
})();

// ── SHARE LEADERBOARD ─────────────────────────────────────────
async function shareLeaderboard() {
  const rows = [...document.querySelectorAll('#leaderboard-body tr[data-player]')];
  if (rows.length === 0) {
    alert('Scores haven\'t been posted yet — check back during the tournament!');
    return;
  }

  const btn = document.getElementById('lb-share-btn');
  if (btn) btn.classList.add('generating');

  await document.fonts.ready;

  const logo = await new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'images/logo.png';
  });

  const W = 1080;
  const ROW_H = 92;
  const LOGO_H = logo ? 160 : 0;
  const HEADER_H = 310 + LOGO_H;
  const FOOTER_H = 130;
  const H = HEADER_H + rows.length * ROW_H + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#080f09';
  ctx.fillRect(0, 0, W, H);

  const grd = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 600);
  grd.addColorStop(0, 'rgba(201,168,76,0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.strokeStyle = 'rgba(201,168,76,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  let headerY = 60;
  if (logo) {
    const logoW = Math.min(520, logo.naturalWidth);
    const logoRatio = logo.naturalHeight / logo.naturalWidth;
    const logoH = logoW * logoRatio;
    const logoX = (W - logoW) / 2;
    ctx.save();
    ctx.drawImage(logo, logoX, headerY, logoW, logoH);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(logoX, headerY, logoW, logoH);
    ctx.restore();
    headerY += logoH + 24;
  } else {
    ctx.fillStyle = '#c9a84c';
    ctx.font = '500 54px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FOREFATHERS INVITATIONAL', W / 2, headerY + 54);
    headerY += 80;
  }

  ctx.fillStyle = 'rgba(245,240,232,0.5)';
  ctx.font = '400 26px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2026 · MYRTLE BEACH, SC · LEADERBOARD', W / 2, headerY + 8);
  headerY += 40;

  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, headerY + 12); ctx.lineTo(W - 80, headerY + 12); ctx.stroke();
  headerY += 58;

  ctx.fillStyle = 'rgba(245,240,232,0.32)';
  ctx.font = '400 20px Oswald, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('POS', 90, headerY);
  ctx.fillText('PLAYER', 210, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('NET', W - 90, headerY);
  headerY += 16;

  ctx.strokeStyle = 'rgba(245,240,232,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, headerY); ctx.lineTo(W - 80, headerY); ctx.stroke();

  let y = headerY + 16;
  rows.forEach((row, i) => {
    const posEl  = row.querySelector('.pos-num');
    const nameEl = row.querySelector('.player-name-cell');
    const netEl  = row.querySelector('.net-score');
    const isLeader = row.classList.contains('lb-leader');

    const pos  = posEl  ? posEl.textContent.replace(/[🔥💩↑↓—]/g,'').trim() : String(i + 1);
    const name = nameEl ? nameEl.textContent.replace(/[🔥💩]/g,'').trim() : '';
    const net  = netEl  ? netEl.textContent.trim() : '—';

    const cy = y + ROW_H / 2;

    if (isLeader) {
      ctx.fillStyle = 'rgba(201,168,76,0.07)';
      ctx.fillRect(60, y, W - 120, ROW_H);
      ctx.strokeStyle = 'rgba(201,168,76,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(60, y + ROW_H); ctx.stroke();
    }

    if (isLeader) {
      ctx.fillStyle = '#c9a84c';
      ctx.beginPath();
      ctx.arc(128, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#080f09';
      ctx.font = '500 24px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pos, 128, cy + 9);
    } else {
      ctx.fillStyle = 'rgba(245,240,232,0.45)';
      ctx.font = '400 24px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pos, 128, cy + 9);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isLeader ? '#f5f0e8' : 'rgba(245,240,232,0.82)';
    ctx.font = (isLeader ? '500' : '400') + ' 30px Oswald, sans-serif';
    ctx.fillText(name, 200, cy + 10);

    ctx.textAlign = 'right';
    const num = parseFloat(net);
    if (net === 'E')      ctx.fillStyle = '#c9a84c';
    else if (num < 0)     ctx.fillStyle = '#2ecc71';
    else if (num > 0)     ctx.fillStyle = '#e74c3c';
    else                  ctx.fillStyle = 'rgba(245,240,232,0.4)';
    ctx.font = '500 38px Oswald, sans-serif';
    ctx.fillText(net, W - 90, cy + 13);

    if (i < rows.length - 1) {
      ctx.strokeStyle = 'rgba(245,240,232,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, y + ROW_H);
      ctx.lineTo(W - 80, y + ROW_H);
      ctx.stroke();
    }

    y += ROW_H;
  });

  ctx.strokeStyle = 'rgba(201,168,76,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, y + 30); ctx.lineTo(W - 80, y + 30); ctx.stroke();

  ctx.fillStyle = 'rgba(245,240,232,0.28)';
  ctx.font = '400 22px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('forefathersinvitational.com', W / 2, y + 72);

  canvas.toBlob(async blob => {
    if (btn) btn.classList.remove('generating');
    const file = new File([blob], 'forefathers-leaderboard.png', { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'ForeFathers Invitational Leaderboard', files: [file] });
        return;
      }
    } catch(e) {}
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'forefathers-leaderboard.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, 'image/png');
}
