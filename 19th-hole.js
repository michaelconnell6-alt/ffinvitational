/* ── 19th Hole — Closest to the Pin ─────────────────────────────────────────
   ForeFathers Invitational Mini-Game
   Vanilla JS / requestAnimationFrame / no dependencies
   ─────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     CONSTANTS & CONFIG
     ══════════════════════════════════════════════════════════════════════════ */

  var YARD_MIN  = 135;
  var YARD_MAX  = 190;
  var WIND_MAX  = 14;   // mph
  var PB_KEY    = 'ffi_19th_pb'; // localStorage key (inches)
  var BREAKFAST_CHANCE = 0.35;   // probability when shot is bad

  // SVG coordinate constants (viewBox 700×420)
  var TEE_X   = 350;
  var TEE_Y   = 385;
  var CUP_X   = 350;
  var CUP_Y   = 205;
  var GREEN_CX = 350; var GREEN_RX = 120; var GREEN_RY = 40;
  var BUNKER_L_CX = 200; var BUNKER_L_RX = 45; var BUNKER_L_RY = 18; var BUNKER_L_CY = 215;
  var BUNKER_R_CX = 500; var BUNKER_R_RX = 50; var BUNKER_R_RY = 20; var BUNKER_R_CY = 210;
  var FAIRWAY_LEFT  = 120; var FAIRWAY_RIGHT = 580;

  /* ══════════════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════════════ */

  var state = {
    phase:        'aim',    // aim | power | accuracy | flight | result
    holeYards:    160,
    windAngle:    0,        // degrees (0 = N = toward target)
    windSpeed:    0,        // mph
    aimAngle:     0,        // degrees from center (-45 to +45)
    powerPct:     0,        // 0–1
    accuracyPct:  0.5,      // 0–1 (0.5 = center)
    idealPowerLo: 0,        // 0–1
    idealPowerHi: 0,
    landX:        CUP_X,   // SVG coords where ball lands
    landY:        CUP_Y,
    terrain:      'green',  // green | rough | bunker
    distInches:   0,        // distance from cup in inches (real units)
    breakfastOffered: false,
    shotCount:    0,        // shots this reload (for breakfast ball)
    animEpoch:    0,        // invalidate in-flight animations
    hidden:       false,
    prefRed:      false,
  };

  /* ══════════════════════════════════════════════════════════════════════════
     DOM REFS
     ══════════════════════════════════════════════════════════════════════════ */

  var $ = function(id) { return document.getElementById(id); };

  var els = {
    holeDist:     $('nh-hole-dist'),
    windDisplay:  $('nh-wind-display'),
    pbDisplay:    $('nh-pb-display'),
    aimSlider:    $('nh-aim-slider'),
    aimLockBtn:   $('nh-aim-lock-btn'),
    powerLockBtn: $('nh-power-lock-btn'),
    accLockBtn:   $('nh-acc-lock-btn'),
    replayBtn:    $('nh-replay-btn'),
    breakfastBtn: $('nh-breakfast-btn'),

    phaseAim:     $('nh-phase-aim'),
    phasePower:   $('nh-phase-power'),
    phaseAcc:     $('nh-phase-accuracy'),
    phaseFlight:  $('nh-phase-flight'),
    phaseResult:  $('nh-phase-result'),
    flightLabel:  $('nh-flight-label'),

    resultReaction: $('nh-result-reaction'),
    resultDist:     $('nh-result-dist'),
    resultTerrain:  $('nh-result-terrain'),
    resultPb:       $('nh-result-pb'),

    // SVG elements
    aimLine:      $('nh-aim-line'),
    ball:         $('nh-ball'),
    landMarker:   $('nh-landing-marker'),
    windLine:     $('nh-wind-line'),
    windTip:      $('nh-wind-tip'),
    windArrow:    $('nh-wind-arrow'),
    powerFill:    $('nh-power-fill'),
    powerIdeal:   $('nh-power-ideal'),
    powerCursor:  $('nh-power-cursor'),
    accIdeal:     $('nh-acc-ideal'),
    accCursor:    $('nh-acc-cursor'),
    accMeter:     $('nh-acc-meter'),
    phaseResult:  $('nh-phase-result'),
    gameArea:     $('nh-game-area'),
  };

  /* ══════════════════════════════════════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════════════════════════════════════ */

  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
  function rndInt(lo, hi) { return Math.floor(rnd(lo, hi + 1)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function inEllipse(px, py, cx, cy, rx, ry) {
    var dx = (px - cx) / rx;
    var dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  // Convert SVG coordinate distance to real-world feet
  // The SVG fairway is ~200px tall (~160–385px) = ~165px for hole yards
  function svgToFeet(svgDist, holeYards) {
    var svgHoleLen = TEE_Y - CUP_Y; // 180 px
    var yardsPerPx = holeYards / svgHoleLen;
    return svgDist * yardsPerPx * 3; // yards→feet
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PERSONAL BEST
     ══════════════════════════════════════════════════════════════════════════ */

  function getPB() {
    try {
      var v = localStorage.getItem(PB_KEY);
      return v !== null ? parseInt(v, 10) : null;
    } catch(e) { return null; }
  }

  function setPB(inches) {
    try { localStorage.setItem(PB_KEY, String(inches)); } catch(e) {}
  }

  function formatDist(inches) {
    if (inches < 12) {
      return inches + '"';
    }
    var ft = Math.floor(inches / 12);
    var rem = inches % 12;
    return rem === 0 ? ft + '\'' : ft + '\'' + ' ' + rem + '"';
  }

  function updatePBDisplay() {
    var pb = getPB();
    els.pbDisplay.textContent = pb !== null ? formatDist(pb) : '—';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     WIND
     ══════════════════════════════════════════════════════════════════════════ */

  var DIRS = ['N','NE','E','SE','S','SW','W','NW'];

  function angleToDir(deg) {
    // 0=N, 90=E, 180=S, 270=W
    var idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return DIRS[idx];
  }

  function setWindArrow(angleDeg) {
    // Rotate the wind arrow group to show wind direction
    var line = els.windLine;
    var tip  = els.windTip;
    if (!line || !tip) return;
    // angleDeg: 0=pointing up (N). We rotate the arrow.
    line.setAttribute('transform', 'rotate(' + angleDeg + ')');
    tip.setAttribute('transform', 'rotate(' + angleDeg + ')');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     HOLE SETUP
     ══════════════════════════════════════════════════════════════════════════ */

  function setupHole() {
    state.holeYards  = rndInt(YARD_MIN, YARD_MAX);
    state.windSpeed  = rndInt(0, WIND_MAX);
    state.windAngle  = rndInt(0, 359);
    state.shotCount  = 0;
    state.breakfastOffered = false;
    state.animEpoch++;

    // Ideal power zone: 65–85% of the bar (center = 75%)
    state.idealPowerLo = 0.62;
    state.idealPowerHi = 0.82;

    // Display
    els.holeDist.textContent = state.holeYards + ' yds';

    var dir = angleToDir(state.windAngle);
    els.windDisplay.textContent = state.windSpeed === 0 ? 'CALM' : state.windSpeed + ' mph ' + dir;

    setWindArrow(state.windAngle);
    updatePBDisplay();

    // Hide ball and marker
    els.ball.setAttribute('opacity', '0');
    els.landMarker.setAttribute('opacity', '0');
    els.aimLine.setAttribute('opacity', '0');

    // Reset aim line to center
    updateAimLine(0);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE TRANSITIONS
     ══════════════════════════════════════════════════════════════════════════ */

  function showPhase(name) {
    var phases = {
      aim:      els.phaseAim,
      power:    els.phasePower,
      accuracy: els.phaseAcc,
      flight:   els.phaseFlight,
      result:   els.phaseResult,
    };
    Object.keys(phases).forEach(function(k) {
      var el = phases[k];
      if (!el) return;
      if (k === name) {
        el.hidden = false;
        el.removeAttribute('hidden');
        // retrigger animation
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = '';
      } else {
        el.hidden = true;
      }
    });
    state.phase = name;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     AIM PHASE
     ══════════════════════════════════════════════════════════════════════════ */

  function startAimPhase() {
    showPhase('aim');
    if (els.aimSlider) {
      els.aimSlider.value = 0;
      updateAimLine(0);
    }
    els.aimLine.setAttribute('opacity', '0.55');
  }

  function updateAimLine(angleDeg) {
    // Aim line: from tee toward cup, deflected by angleDeg
    var rad = (angleDeg * Math.PI) / 180;
    var dx = Math.sin(rad) * (TEE_Y - CUP_Y);
    var ex = TEE_X + dx;
    var ey = CUP_Y - 20;
    els.aimLine.setAttribute('x1', TEE_X);
    els.aimLine.setAttribute('y1', TEE_Y - 10);
    els.aimLine.setAttribute('x2', ex);
    els.aimLine.setAttribute('y2', ey);
  }

  if (els.aimSlider) {
    els.aimSlider.addEventListener('input', function() {
      updateAimLine(parseFloat(this.value));
    });
  }

  if (els.aimLockBtn) {
    els.aimLockBtn.addEventListener('click', function() {
      state.aimAngle = parseFloat(els.aimSlider.value);
      els.aimLine.setAttribute('opacity', '0.2');
      startPowerPhase();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     POWER PHASE
     ══════════════════════════════════════════════════════════════════════════ */

  var powerRaf = null;
  var powerDir = 1;
  var powerVal = 0; // 0–1

  function startPowerPhase() {
    showPhase('power');
    powerVal = 0;
    powerDir = 1;

    // Position ideal zone
    var idealBot = (1 - state.idealPowerHi) * 100;
    var idealH   = (state.idealPowerHi - state.idealPowerLo) * 100;
    els.powerIdeal.style.bottom = idealBot + '%';
    els.powerIdeal.style.height = idealH + '%';

    animatePower();
  }

  function animatePower() {
    powerRaf = requestAnimationFrame(function() {
      if (state.phase !== 'power') return;
      if (state.hidden) { powerRaf = requestAnimationFrame(animatePower); return; }

      // Speed: full oscillation in ~1.8s → 0.011 per frame at 60fps
      var speed = state.prefRed ? 0.05 : 0.011;
      powerVal += powerDir * speed;

      if (powerVal >= 1) { powerVal = 1; powerDir = -1; }
      if (powerVal <= 0) { powerVal = 0; powerDir =  1; }

      // Update visuals
      els.powerFill.style.height = (powerVal * 100) + '%';
      var cursorTop = ((1 - powerVal) * 100);
      els.powerCursor.style.top = cursorTop + '%';

      // Color feedback: green inside ideal zone
      if (powerVal >= state.idealPowerLo && powerVal <= state.idealPowerHi) {
        els.powerFill.style.background = 'linear-gradient(to top, #4caf72, #a0e8b8, #fff)';
      } else {
        els.powerFill.style.background = 'linear-gradient(to top, #c9a84c, #e8c96a, #fff)';
      }

      powerRaf = requestAnimationFrame(animatePower);
    });
  }

  if (els.powerLockBtn) {
    els.powerLockBtn.addEventListener('click', function() {
      state.powerPct = powerVal;
      cancelAnimationFrame(powerRaf);
      startAccuracyPhase();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ACCURACY PHASE
     ══════════════════════════════════════════════════════════════════════════ */

  var accRaf = null;
  var accVal = 0.5; // 0=full hook, 1=full slice
  var accDir = 1;

  function startAccuracyPhase() {
    showPhase('accuracy');
    accVal = 0.5;
    accDir = 1;

    // Position ideal zone in center 20% of bar
    var meterEl = els.accMeter;
    // ideal zone: 40%-60% (centred)
    els.accIdeal.style.left   = '40%';
    els.accIdeal.style.width  = '20%';

    animateAccuracy();
  }

  function animateAccuracy() {
    accRaf = requestAnimationFrame(function() {
      if (state.phase !== 'accuracy') return;
      if (state.hidden) { accRaf = requestAnimationFrame(animateAccuracy); return; }

      var speed = state.prefRed ? 0.06 : 0.013;
      accVal += accDir * speed;

      if (accVal >= 1) { accVal = 1; accDir = -1; }
      if (accVal <= 0) { accVal = 0; accDir =  1; }

      els.accCursor.style.left = (accVal * 100) + '%';

      // Color: green in ideal zone
      var inZone = accVal >= 0.4 && accVal <= 0.6;
      els.accCursor.style.background = inZone ? '#4caf72' : '#c9a84c';
      els.accCursor.style.boxShadow  = inZone
        ? '0 0 6px rgba(76,175,114,0.7)'
        : '0 0 6px rgba(201,168,76,0.6)';

      accRaf = requestAnimationFrame(animateAccuracy);
    });
  }

  if (els.accLockBtn) {
    els.accLockBtn.addEventListener('click', function() {
      state.accuracyPct = accVal;
      cancelAnimationFrame(accRaf);
      calculateShot();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SHOT CALCULATION
     ══════════════════════════════════════════════════════════════════════════ */

  function calculateShot() {
    var power    = state.powerPct;     // 0–1
    var acc      = state.accuracyPct;  // 0=hook, 0.5=perfect, 1=slice
    var aim      = state.aimAngle;     // -45 to +45
    var windSpd  = state.windSpeed;
    var windAng  = state.windAngle;    // degrees

    // --- Power score: how well did they hit the ideal zone ---
    // ideal center = midpoint of idealPowerLo/Hi = ~0.72
    var idealCenter = (state.idealPowerLo + state.idealPowerHi) / 2;
    var powerDelta  = power - idealCenter; // how far from ideal center
    // penalty: 0 at ideal center, increases away
    var powerScore  = 1 - Math.min(1, Math.abs(powerDelta) / 0.38); // 0–1

    // --- Accuracy score: deviation from center (0.5) ---
    var accDev   = (acc - 0.5) * 2;    // -1=max hook, 0=center, +1=max slice
    var accScore = 1 - Math.abs(accDev); // 0–1

    // --- Aim offset in SVG pixels ---
    var aimRad  = (aim * Math.PI) / 180;
    var aimOffX = Math.sin(aimRad) * (TEE_Y - CUP_Y) * 0.6;

    // --- Accuracy offset (sidespin) ---
    var accOffX = accDev * 60; // ±60px sidespin

    // --- Distance from ideal: power affects how far ball travels ---
    // If power > ideal, ball overshoots; if under, undershoots
    var svgHoleLen = TEE_Y - CUP_Y; // 180px
    var distPct    = power / idealCenter; // 1.0 = perfect distance
    var landY      = TEE_Y - svgHoleLen * clamp(distPct, 0.5, 1.4);

    // --- Wind effect (simplified) ---
    // Wind angle 0=north (toward target) helps/hurts distance; east = pushes right
    var windRad    = (windAng * Math.PI) / 180;
    var windX      = Math.sin(windRad) * windSpd * 1.2; // lateral push px
    var windY      = -Math.cos(windRad) * windSpd * 0.6; // forward/back push

    var rawX = TEE_X + aimOffX + accOffX + windX;
    var rawY = landY - windY;

    // Clamp to visible area
    rawX = clamp(rawX, 40, 660);
    rawY = clamp(rawY, 140, 415);

    state.landX = rawX;
    state.landY = rawY;

    // --- Determine terrain ---
    if (inEllipse(rawX, rawY, BUNKER_L_CX, BUNKER_L_CY, BUNKER_L_RX, BUNKER_L_RY) ||
        inEllipse(rawX, rawY, BUNKER_R_CX, BUNKER_R_CY, BUNKER_R_RX, BUNKER_R_RY)) {
      state.terrain = 'bunker';
    } else if (inEllipse(rawX, rawY, GREEN_CX, CUP_Y, GREEN_RX, GREEN_RY)) {
      state.terrain = 'green';
    } else if (rawX > FAIRWAY_LEFT && rawX < FAIRWAY_RIGHT && rawY > 180) {
      state.terrain = 'fairway';
    } else {
      state.terrain = 'rough';
    }

    // --- Roll-out based on terrain ---
    var rollFactor = { green: 1.0, fairway: 0.8, rough: 0.35, bunker: 0.05 }[state.terrain];
    // Roll toward nearest point on green
    var rollDX = (CUP_X - rawX) * rollFactor * 0.25;
    var rollDY = (CUP_Y - rawY) * rollFactor * 0.25;
    state.landX = clamp(rawX + rollDX, 40, 660);
    state.landY = clamp(rawY + rollDY, 140, 415);

    // --- Distance to cup in inches ---
    var finalDX  = state.landX - CUP_X;
    var finalDY  = state.landY - CUP_Y;
    var svgDist  = Math.sqrt(finalDX * finalDX + finalDY * finalDY);
    var realFeet = svgToFeet(svgDist, state.holeYards);
    state.distInches = Math.round(realFeet * 12);

    // Hole-in-one: if svgDist < cup radius (5px) effectively
    if (svgDist < 5 || (powerScore > 0.92 && accScore > 0.92 && Math.abs(aimOffX) < 5)) {
      state.distInches = 0;
      state.landX = CUP_X;
      state.landY = CUP_Y;
      state.terrain = 'green';
    }

    // --- Breakfast Ball logic ---
    state.shotCount++;
    var isBadShot = state.distInches > (state.holeYards * 6); // more than 6 inches per yard = very bad
    state.breakfastOffered = (state.shotCount === 1 && isBadShot && Math.random() < BREAKFAST_CHANCE);

    startFlightPhase();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FLIGHT ANIMATION
     ══════════════════════════════════════════════════════════════════════════ */

  function startFlightPhase() {
    showPhase('flight');
    var myEpoch = ++state.animEpoch;

    // Labels
    var labels = ['IN FLIGHT...', 'ON THE WAY...', 'TRACKING...'];
    els.flightLabel.textContent = labels[Math.floor(Math.random() * labels.length)];

    // Show ball at tee
    els.ball.setAttribute('opacity', '1');
    els.landMarker.setAttribute('opacity', '0');

    var ballEl = els.ball;
    var start  = null;

    // Duration: 2.0–3.0 s (respect reduced motion → 0.3s)
    var dur = state.prefRed ? 300 : rndInt(1800, 2600);

    var startX = TEE_X;
    var startY = TEE_Y;
    var endX   = state.landX;
    var endY   = state.landY;

    // Apex: midpoint raised by arc height
    var arcH = state.prefRed ? 0 : (TEE_Y - CUP_Y) * 0.7;
    var midX  = (startX + endX) / 2;
    var midY  = Math.min(startY, endY) - arcH;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function bezier(p0, p1, p2, t) {
      // Quadratic bezier
      var mt = 1 - t;
      return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
    }

    function frame(ts) {
      if (myEpoch !== state.animEpoch) return;
      if (!start) start = ts;
      var elapsed = ts - start;
      var raw = clamp(elapsed / dur, 0, 1);
      var t   = easeInOut(raw);

      var bx = bezier(startX, midX, endX, t);
      var by = bezier(startY, midY, endY, t);

      ballEl.setAttribute('transform', 'translate(' + bx + ',' + by + ')');

      // Scale ball: bigger at apex, smaller at land
      var scale = 1 + Math.sin(t * Math.PI) * 0.6;
      var ballCirc = ballEl.querySelector('circle:last-child');
      if (ballCirc) ballCirc.setAttribute('r', String(5 * scale));
      var ballGlow = ballEl.querySelector('circle:first-child');
      if (ballGlow) ballGlow.setAttribute('r', String(10 * scale));

      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        // Bounce + roll
        bounceBall(myEpoch, endX, endY);
      }
    }

    requestAnimationFrame(frame);
  }

  function bounceBall(myEpoch, x, y) {
    if (myEpoch !== state.animEpoch) return;
    var bounceH = state.terrain === 'bunker' ? 4 : 12;
    var bounces = state.terrain === 'bunker' ? 1 : 2;
    var bounceDur = 200;
    var startTs = null;

    function bounceFrame(ts) {
      if (myEpoch !== state.animEpoch) return;
      if (!startTs) startTs = ts;
      var elapsed = ts - startTs;
      var totalDur = bounceDur * bounces;
      var t = clamp(elapsed / totalDur, 0, 1);

      // Simple sine bounce
      var bounceY = -Math.abs(Math.sin(t * Math.PI * bounces)) * bounceH;
      var bx = lerp(x, state.landX, t);
      var by = y + bounceY + (state.landY - y) * t;

      els.ball.setAttribute('transform', 'translate(' + bx + ',' + by + ')');

      if (t < 1) {
        requestAnimationFrame(bounceFrame);
      } else {
        // Settle
        els.ball.setAttribute('transform', 'translate(' + state.landX + ',' + state.landY + ')');
        showLandingMarker();
        setTimeout(function() {
          if (myEpoch === state.animEpoch) showResult();
        }, 500);
      }
    }

    requestAnimationFrame(bounceFrame);
  }

  function showLandingMarker() {
    var m = els.landMarker;
    m.setAttribute('transform', 'translate(' + state.landX + ',' + state.landY + ')');
    m.setAttribute('opacity', '1');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RESULT DISPLAY
     ══════════════════════════════════════════════════════════════════════════ */

  function getReaction(inches, terrain) {
    if (inches === 0) return 'HOLE IN ONE!';
    if (terrain === 'bunker') return 'BEACH.';
    if (inches <= 6)   return 'KICK-IN.';
    if (inches <= 18)  return 'THAT\'LL PLAY.';
    if (inches <= 54)  return 'GOOD LOOK AT BIRDIE.';
    if (inches <= 120) return 'YOU\'RE AWAY.';
    if (inches <= 240) return 'COULD BE WORSE.';
    return 'RELOAD.';
  }

  function getTerrainLabel(terrain) {
    return { green: 'On the green', fairway: 'On the fairway', rough: 'In the rough', bunker: 'In the bunker' }[terrain] || '';
  }

  function showResult() {
    showPhase('result');

    var dist = state.distInches;
    var hio  = dist === 0;
    var terrain = state.terrain;

    // Reaction
    els.resultReaction.textContent = getReaction(dist, terrain);

    // Distance
    if (hio) {
      els.resultDist.textContent = '';
    } else {
      els.resultDist.textContent = formatDist(dist) + ' from the pin';
    }

    // Terrain
    els.resultTerrain.textContent = getTerrainLabel(terrain);

    // Personal best
    var pb = getPB();
    els.resultPb.textContent = '';
    if (!hio && dist > 0) {
      if (pb === null || dist < pb) {
        setPB(dist);
        els.resultPb.textContent = '★ NEW PERSONAL BEST';
        updatePBDisplay();
      }
    } else if (hio) {
      // HIO — best possible, always a PB
      setPB(0);
      els.resultPb.textContent = '★ HOLE IN ONE — PERSONAL BEST';
      updatePBDisplay();
    }

    // Hole-in-one class
    var resultEl = els.phaseResult;
    if (hio) {
      resultEl.classList.add('nh-hole-in-one');
    } else {
      resultEl.classList.remove('nh-hole-in-one');
    }

    // Breakfast ball
    if (els.breakfastBtn) {
      if (state.breakfastOffered && !hio) {
        els.breakfastBtn.hidden = false;
      } else {
        els.breakfastBtn.hidden = true;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     REPLAY / BREAKFAST BALL
     ══════════════════════════════════════════════════════════════════════════ */

  if (els.replayBtn) {
    els.replayBtn.addEventListener('click', function() {
      setupHole();
      startAimPhase();
    });
  }

  if (els.breakfastBtn) {
    els.breakfastBtn.addEventListener('click', function() {
      // Take breakfast ball: re-shoot the same hole, same wind
      state.breakfastOffered = false;
      els.breakfastBtn.hidden = true;
      // Reset ball position
      els.ball.setAttribute('opacity', '0');
      els.landMarker.setAttribute('opacity', '0');
      startAimPhase();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PAGE VISIBILITY — PAUSE WHEN HIDDEN
     ══════════════════════════════════════════════════════════════════════════ */

  document.addEventListener('visibilitychange', function() {
    state.hidden = document.hidden;
  });

  /* ══════════════════════════════════════════════════════════════════════════
     REDUCED MOTION
     ══════════════════════════════════════════════════════════════════════════ */

  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  state.prefRed = mq && mq.matches;
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function() { state.prefRed = mq.matches; });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     KEYBOARD SUPPORT
     ══════════════════════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (state.phase === 'aim') els.aimLockBtn && els.aimLockBtn.click();
      else if (state.phase === 'power') els.powerLockBtn && els.powerLockBtn.click();
      else if (state.phase === 'accuracy') els.accLockBtn && els.accLockBtn.click();
      else if (state.phase === 'result') els.replayBtn && els.replayBtn.click();
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.phase === 'aim') {
      var slider = els.aimSlider;
      if (!slider) return;
      var v = parseFloat(slider.value) + (e.key === 'ArrowLeft' ? -1 : 1);
      slider.value = clamp(v, -45, 45);
      updateAimLine(parseFloat(slider.value));
    }
  });

  /* ══════════════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════════════ */

  setupHole();
  startAimPhase();

})();
