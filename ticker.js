/* ── FFI Ticker v4 ──────────────────────────────────────────────────────────
   ForeFathers Invitational — single-row wipe/expand ticker.

   Behavior loop:
     1. SLIDE IN  — category-label pill queue translates from off-screen right
                    to left edge of stage (all labels briefly visible)
     2. PAUSE     — queue holds at position so the active label is legible
     3. WIPE IN   — clip-path expands the bar left → right, covering queue
     4. CONTENT   — active label + info text fade in inside the bar
     5. DISPLAY   — multi-item sections cross-fade items without collapsing
     6. WIPE OUT  — clip-path collapses bar right → left (label stays last)
     7. ROTATE    — active section moves to end of queue; cycle repeats

   Content: exact tickerSections data — do not add, remove, or change items.
   ──────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     CONFIGURATION
     ═══════════════════════════════════════════════════════════════════════════ */

  var FFI_TICKER = {

    tickerEnabled:          true,

    /* Slide-in animation duration (ms) */
    slideInDuration:        620,

    /* How long the queue labels are visible before expand begins (ms) */
    queuePause:             480,

    /* Expand (wipe-in) duration (ms) */
    expandDuration:         460,

    /* Content opacity fade durations (ms) */
    contentFadeInDuration:  280,
    contentFadeOutDuration: 200,

    /* How long each piece of content stays fully visible (ms) */
    sectionDisplayDuration: 6000,   /* single-item sections                  */
    itemDisplayDuration:    4200,   /* each item within multi-item sections   */

    /* Collapse (wipe-out) duration (ms) */
    collapseDuration:       420,

    pauseOnHover:           true,
    showOnMobile:           true,

    /* ── Sections ────────────────────────────────────────────────────────────
       label    {string}   shown in the queue pill AND the expand-bar label
       items    {Array}    one or more content objects
         text     {string}  display copy
         href     {string}  optional — makes the text a clickable link
         countdown {bool}   replaces text with live "N days until…" countdown
    ─────────────────────────────────────────────────────────────────────────── */
    tickerSections: [

      {
        label: 'NEXT STOP',
        items: [
          {
            text: 'Committee announces the 2027 FFI will be in Canada. Local felons shocked and dissapointed',
            href: 'banff-2027.html'
          }
        ]
      },

      {
        label: 'COUNTDOWN',
        items: [
          { countdown: true }
        ]
      },

      {
        label: 'THE FIELD',
        items: [
          { text: 'The 2027 field will be announced in November.' }
          /* Add confirmed players below when announced:
             { text: 'FirstName LastName' }   */
        ]
      },

      {
        label: 'THE COURSES',
        items: [
          { text: 'Kananaskis Country Golf Course',    href: 'banff-2027.html' },
          { text: 'Stewart Creek Golf & Country Club', href: 'banff-2027.html' },
          { text: 'Silvertip Resort',                  href: 'banff-2027.html' },
          { text: 'Fairmont Banff Springs',            href: 'banff-2027.html' }
        ]
      },

      {
        label: 'DEFENDING CHAMPION',
        items: [
          {
            text: 'Micah Smoak returns after a wire-to-wire victory in Myrtle Beach.',
            href: 'champions.html'
          }
        ]
      },

      {
        label: '2026 RECAP',
        items: [
          {
            text: 'Smoak captured the 2026 title by 10 shots.',
            href: 'recap.html'
          }
        ]
      },

      {
        label: 'HISTORY',
        items: [
          {
            text: 'In 2026, Steve Williams recorded the first ace in ForeFathers history, on the 13th hole at TPC Myrtle Beach'
          }
        ]
      },

      {
        label: 'CHAMPIONS',
        items: [
          { text: 'Micah Smoak  ·  2026  ·  Myrtle Beach, SC',           href: 'champions.html' },
          { text: 'Mikey Connell  ·  2025  ·  Arcadia Bluffs / TreeTops', href: 'champions.html' },
          { text: 'Mikey Connell  ·  2022  ·  Pinehurst Resort',          href: 'champions.html' },
          { text: 'Garrett Wardell  ·  2021  ·  Pinehurst Resort',        href: 'champions.html' }
        ]
      },

      {
        label: 'FOLLOW US',
        items: [
          {
            text: 'Follow us on Instagram @forefathersinvitational',
            href: 'https://www.instagram.com/forefathersinvitational'
          }
        ]
      }

    ]

  };

  /* ═══════════════════════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════════════════════ */

  var cfg        = FFI_TICKER;
  var secs       = cfg.tickerSections;
  var queueOrder = [];   /* section indices in display order; [0] = next active */
  var iIdx       = 0;    /* item index within the current section               */
  var epoch      = 0;    /* incremented on every new cycle; stale callbacks bail */
  var isPaused   = false;
  var timer      = null;

  var prefRed = !!(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* DOM refs — assigned in buildTicker() */
  var tickerEl, stageEl, queueEl, expandEl, expandLabelEl, expandContentEl;
  var pillEls = [];   /* one <div> per section, in tickerSections order */

  /* ═══════════════════════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════════════════════ */

  function daysUntilBanff() {
    var diff = new Date('2027-07-08T00:00:00') - new Date();
    return diff <= 0 ? 0 : Math.ceil(diff / 86400000);
  }

  function resolveText(item) {
    if (item.countdown) {
      return daysUntilBanff() + ' days until the 2027 ForeFathers Invitational';
    }
    return item.text || '';
  }

  function displayTime(sIdx) {
    return secs[sIdx].items.length > 1
      ? cfg.itemDisplayDuration
      : cfg.sectionDisplayDuration;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     BUILD DOM
     ═══════════════════════════════════════════════════════════════════════════ */

  function buildTicker() {
    /* Outer wrapper */
    tickerEl = document.createElement('div');
    tickerEl.id = 'ffi-ticker';
    tickerEl.setAttribute('role', 'region');
    tickerEl.setAttribute('aria-label', 'ForeFathers Invitational updates');

    /* Gold badge */
    var badge = document.createElement('div');
    badge.id  = 'ffi-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = 'FFI';
    tickerEl.appendChild(badge);

    /* Stage */
    stageEl = document.createElement('div');
    stageEl.id = 'ffi-stage';
    tickerEl.appendChild(stageEl);

    /* Queue */
    queueEl = document.createElement('div');
    queueEl.id = 'ffi-queue';
    stageEl.appendChild(queueEl);

    secs.forEach(function (sec, i) {
      var pill = document.createElement('div');
      pill.className   = 'ffi-pill';
      pill.textContent = sec.label;
      queueEl.appendChild(pill);
      pillEls.push(pill);
    });

    /* Expand overlay */
    expandEl = document.createElement('div');
    expandEl.id = 'ffi-expand';
    stageEl.appendChild(expandEl);

    expandLabelEl = document.createElement('div');
    expandLabelEl.id = 'ffi-expand-label';
    expandEl.appendChild(expandLabelEl);

    expandContentEl = document.createElement('div');
    expandContentEl.id = 'ffi-expand-content';
    expandEl.appendChild(expandContentEl);

    document.body.appendChild(tickerEl);

    /* Expand bar fully clipped (hidden) on build */
    expandEl.style.clipPath = 'inset(0 100% 0 0)';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     QUEUE MANAGEMENT
     Re-order pill DOM elements to match queueOrder, then colour the first pill.
     ═══════════════════════════════════════════════════════════════════════════ */

  function reorderQueue() {
    var frag = document.createDocumentFragment();
    queueOrder.forEach(function (sIdx) {
      frag.appendChild(pillEls[sIdx]);
    });
    queueEl.appendChild(frag);   /* appending a fragment moves each child in order */

    /* Colour pills: first is brighter (active), rest are dim */
    var children = queueEl.children;
    for (var i = 0; i < children.length; i++) {
      children[i].style.color = i === 0
        ? 'rgba(245,240,232,0.75)'
        : 'rgba(245,240,232,0.28)';
    }
  }

  /* Snap queue off-screen to the right (no visible effect — bar covers this). */
  function resetQueueOffscreen() {
    var sw = stageEl.getBoundingClientRect().width;
    queueEl.style.transition = 'none';
    queueEl.style.transform  = 'translateX(' + sw + 'px)';
    void queueEl.offsetWidth; /* force layout so next transition fires cleanly */
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SLIDE IN
     Translates the queue from off-screen right to its natural position (x=0),
     so category labels scroll in left-ward into view.
     ═══════════════════════════════════════════════════════════════════════════ */

  function slideQueueIn(onDone) {
    var dur = prefRed ? 0 : cfg.slideInDuration;
    if (dur) {
      queueEl.style.transition =
        'transform ' + dur + 'ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
    queueEl.style.transform = 'translateX(0)';
    setTimeout(onDone, dur + 16);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     WIPE IN / WIPE OUT
     Drives clip-path on the expand bar.
     Wipe-in  : bar grows from left edge to full width  (left → right sweep)
     Wipe-out : bar shrinks from right toward the label (right → left retreat)
     ═══════════════════════════════════════════════════════════════════════════ */

  function wipeIn(onDone) {
    var dur = prefRed ? 0 : cfg.expandDuration;
    /* Ensure start state */
    expandEl.style.transition = 'none';
    expandEl.style.clipPath   = 'inset(0 100% 0 0)';
    void expandEl.offsetWidth;
    /* Animate to fully visible */
    if (dur) {
      expandEl.style.transition =
        'clip-path ' + dur + 'ms cubic-bezier(0.4, 0, 0.2, 1)';
    }
    expandEl.style.clipPath = 'inset(0 0% 0 0)';
    setTimeout(onDone, dur + 16);
  }

  function wipeOut(onDone) {
    var dur = prefRed ? 0 : cfg.collapseDuration;
    /* Bar is currently at inset(0 0% 0 0) — shrink it right → left */
    if (dur) {
      expandEl.style.transition =
        'clip-path ' + dur + 'ms cubic-bezier(0.6, 0, 0.8, 1)';
    } else {
      expandEl.style.transition = 'none';
    }
    expandEl.style.clipPath = 'inset(0 100% 0 0)';
    setTimeout(onDone, dur + 16);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CONTENT RENDER AND FADE
     ═══════════════════════════════════════════════════════════════════════════ */

  function setExpandContent(sIdx, itemIdx) {
    var sec  = secs[sIdx];
    var item = sec.items[itemIdx];
    var text = resolveText(item);

    expandLabelEl.textContent = sec.label;

    /* Clear old content and reset opacity without transition */
    expandContentEl.style.transition = 'none';
    expandContentEl.style.opacity    = '0';
    expandContentEl.innerHTML        = '';

    var node;
    if (item.href) {
      node      = document.createElement('a');
      node.href = item.href;
    } else {
      node = document.createElement('span');
    }
    node.textContent = text;
    expandContentEl.appendChild(node);
  }

  function fadeContentIn(onDone) {
    var dur = prefRed ? 0 : cfg.contentFadeInDuration;
    void expandContentEl.offsetWidth;
    if (dur) {
      expandContentEl.style.transition = 'opacity ' + dur + 'ms ease';
    }
    expandContentEl.style.opacity = '1';
    setTimeout(onDone, dur + 10);
  }

  function fadeContentOut(onDone) {
    var dur = prefRed ? 0 : cfg.contentFadeOutDuration;
    if (dur) {
      expandContentEl.style.transition = 'opacity ' + dur + 'ms ease';
    } else {
      expandContentEl.style.transition = 'none';
    }
    expandContentEl.style.opacity = '0';
    setTimeout(onDone, dur + 10);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     ITEM SCHEDULER
     Called once the bar is open and content has faded in.
     Waits displayTime, then either cross-fades to the next item (if any remain)
     or collapses the bar and rotates the queue.
     ═══════════════════════════════════════════════════════════════════════════ */

  function scheduleItem(myEpoch, activeSIdx) {
    if (epoch !== myEpoch || isPaused) return;
    timer = setTimeout(function () {
      if (epoch !== myEpoch || isPaused) return;

      var nextI = iIdx + 1;

      if (nextI < secs[activeSIdx].items.length) {
        /* ── More items remain — cross-fade within the open bar ── */
        fadeContentOut(function () {
          if (epoch !== myEpoch) return;
          iIdx = nextI;
          setExpandContent(activeSIdx, iIdx);
          fadeContentIn(function () {
            if (epoch !== myEpoch) return;
            scheduleItem(myEpoch, activeSIdx);
          });
        });

      } else {
        /* ── Last item — collapse and rotate ── */
        fadeContentOut(function () {
          if (epoch !== myEpoch) return;

          /* Rotate the queue while the bar still covers everything:
             move active section to end, reorder pills, snap queue off-screen.
             All of this is invisible behind the full-width expand bar.       */
          queueOrder.push(queueOrder.shift());
          reorderQueue();
          resetQueueOffscreen();

          wipeOut(function () {
            if (epoch !== myEpoch) return;
            /* Bar is gone; stage is momentarily dark.
               startCycle will immediately begin sliding the queue in.        */
            startCycle(myEpoch);
          });
        });
      }
    }, displayTime(activeSIdx));
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN CYCLE
     Entry point for each section. Resets bar, slides queue in, expands, shows.
     Pass the epoch from the caller to preserve continuity across multi-item
     cross-fades; a fresh ++epoch is only issued at the top-level startCycle().
     ═══════════════════════════════════════════════════════════════════════════ */

  function startCycle(inheritEpoch) {
    if (isPaused) return;

    /* When called as a top-level resume (hover-end, init), issue a new epoch.
       When called internally from scheduleItem's rotate callback, pass through
       the existing epoch so in-flight guards remain valid.                    */
    var myEpoch = (inheritEpoch !== undefined) ? inheritEpoch : (++epoch);

    /* Hard-reset bar and content (idempotent; safe to call mid-animation) */
    expandEl.style.transition        = 'none';
    expandEl.style.clipPath          = 'inset(0 100% 0 0)';
    expandContentEl.style.transition = 'none';
    expandContentEl.style.opacity    = '0';

    var activeSIdx = queueOrder[0];
    iIdx = 0;

    /* Pre-load content text while bar is hidden */
    setExpandContent(activeSIdx, 0);

    /* If this is a fresh top-level call, we already rotated + reset the queue
       in scheduleItem. But on the very first call (init) the queue hasn't been
       positioned yet, so resetQueueOffscreen + reorderQueue are always safe.  */
    reorderQueue();
    resetQueueOffscreen();

    /* ── Step 1: slide queue in from the right ── */
    slideQueueIn(function () {
      if (epoch !== myEpoch || isPaused) return;

      /* ── Step 2: brief pause with labels visible ── */
      timer = setTimeout(function () {
        if (epoch !== myEpoch || isPaused) return;

        /* ── Step 3: wipe expand bar in (left → right) ── */
        wipeIn(function () {
          if (epoch !== myEpoch || isPaused) return;

          /* ── Step 4: fade in content ── */
          fadeContentIn(function () {
            if (epoch !== myEpoch || isPaused) return;

            /* ── Step 5: display / cycle items ── */
            scheduleItem(myEpoch, activeSIdx);
          });
        });

      }, cfg.queuePause);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════════════ */

  function init() {
    if (!cfg.tickerEnabled)                            return;
    if (!cfg.showOnMobile && window.innerWidth < 600)  return;
    if (document.getElementById('ffi-ticker'))         return;

    /* Seed queue order (0 through N-1) */
    secs.forEach(function (_, i) { queueOrder.push(i); });

    buildTicker();

    /* Push page content above the fixed ticker row */
    var mobile = window.innerWidth <= 600;
    var padH   = mobile ? 40 : 44;
    document.body.style.paddingBottom =
      'calc(' + padH + 'px + env(safe-area-inset-bottom, 0px))';

    /* ── Pause on hover / focus ── */
    if (cfg.pauseOnHover) {
      tickerEl.addEventListener('mouseenter', function () {
        isPaused = true;
        clearTimeout(timer);
      });
      tickerEl.addEventListener('mouseleave', function () {
        isPaused = false;
        ++epoch;               /* invalidate any stale callbacks */
        startCycle();          /* fresh cycle; no inheritEpoch   */
      });
      tickerEl.addEventListener('focusin', function () {
        isPaused = true;
        clearTimeout(timer);
      });
      tickerEl.addEventListener('focusout', function () {
        isPaused = false;
        ++epoch;
        startCycle();
      });
    }

    /* Wait two animation frames so the DOM has painted before starting */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        startCycle();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
