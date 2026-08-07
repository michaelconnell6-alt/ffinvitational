/* ── FFI Ticker v2 ──────────────────────────────────────────────────────────
   ForeFathers Invitational — segmented broadcast crawl.
   Shows one section at a time with broadcast-style transitions.
   No external dependencies. Self-contained IIFE.
   ──────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     CONFIGURATION — edit this block to change content or timing
     ═══════════════════════════════════════════════════════════════════════════ */

  var FFI_TICKER = {

    tickerEnabled:           true,

    /* How long each content item stays on screen (milliseconds) */
    sectionDisplayDuration:  6000,   /* single-item sections                  */
    itemDisplayDuration:     4200,   /* each item in multi-item sections       */

    /* Transition timing (milliseconds) */
    transitionDuration:      220,    /* slot exit and enter duration each      */
    labelTransDuration:      130,    /* section label fade duration            */

    pauseOnHover:            true,
    showOnMobile:            true,

    /* ── Sections ────────────────────────────────────────────────────────────
       Each section has a label and one or more items.
       Item fields:
         text     {string}   display copy
         href     {string}   optional — makes item a clickable link
         countdown {boolean} replaces text with live "N days until…" string
    ─────────────────────────────────────────────────────────────────────────── */
    tickerSections: [

      {
        label: 'NEXT STOP',
        items: [
          {
            text: 'Banff, Alberta  ·  July 8–11, 2027',
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
          { text: 'The 2027 field is taking shape.' }
          /* Add confirmed players below when announced:
             { text: 'FirstName LastName' }   */
        ]
      },

      {
        label: 'THE COURSES',
        items: [
          { text: 'Kananaskis Country Golf Course',   href: 'banff-2027.html' },
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
            text: 'In 2026, Steve Williams recorded the first ace in ForeFathers history.'
          }
        ]
      },

      {
        label: 'CHAMPIONS',
        items: [
          { text: 'Micah Smoak  ·  2026  ·  Myrtle Beach, SC',        href: 'champions.html' },
          { text: 'Mikey Connell  ·  2025  ·  Arcadia Bluffs / TreeTops', href: 'champions.html' },
          { text: 'Mikey Connell  ·  2022  ·  Pinehurst Resort',       href: 'champions.html' },
          { text: 'Garrett Wardell  ·  2021  ·  Pinehurst Resort',     href: 'champions.html' }
        ]
      }

    ]

  };

  /* ═══════════════════════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════════════════════ */

  var cfg  = FFI_TICKER;
  var secs = cfg.tickerSections;

  var sIdx     = 0;     /* current section index                              */
  var iIdx     = 0;     /* current item index within section                  */
  var timer    = null;  /* display countdown timer handle                     */
  var isBusy   = false; /* true while a transition is running                 */
  var isPaused = false; /* true while hovering or focused                     */

  var prefRed = !!(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* ── DOM element references (set in buildTicker) ── */
  var tickerEl, lblEl, slotEl;

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

  /* Duration the current item should remain visible */
  function displayTime() {
    return secs[sIdx].items.length > 1
      ? cfg.itemDisplayDuration
      : cfg.sectionDisplayDuration;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */

  function renderItem(item) {
    var text = resolveText(item);
    slotEl.innerHTML = '';

    if (item.href) {
      var a       = document.createElement('a');
      a.href      = item.href;
      a.textContent = text;
      slotEl.appendChild(a);
    } else {
      var span       = document.createElement('span');
      span.textContent = text;
      slotEl.appendChild(span);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     TIMER
     ═══════════════════════════════════════════════════════════════════════════ */

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(advance, displayTime());
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     TRANSITION STATE MACHINE
     ──────────────────────────────────────────────────────────────────────────
     Sequence for ITEM change (within same section):
       0ms   → slot exits (fade + slide up)
       xDur  → content updated, slot enters (fade + slide up from below)
       xDur×2 → isBusy = false, schedule next

     Sequence for SECTION change:
       0ms   → slot exits (fade + slide left), label fades out
       lDur  → label text updates, label fades in
       xDur  → content updated, slot enters (fade + slide right from right)
       xDur×2 → isBusy = false, schedule next
     ═══════════════════════════════════════════════════════════════════════════ */

  function advance() {
    if (isBusy || isPaused) return;
    isBusy = true;
    clearTimeout(timer);

    /* ── Compute next indices ── */
    var nI        = iIdx + 1;
    var nS        = sIdx;
    var isNewSec  = false;

    if (nI >= secs[sIdx].items.length) {
      nI       = 0;
      nS       = (sIdx + 1) % secs.length;
      isNewSec = true;
    }

    var xDur = prefRed ? 0 : cfg.transitionDuration;
    var lDur = prefRed ? 0 : cfg.labelTransDuration;

    /* ── EXIT ── */
    slotEl.classList.add('ffi-gone');

    if (!prefRed) {
      /* Direction: horizontal for section change, vertical for item change */
      slotEl.style.transform = isNewSec ? 'translateX(-12px)' : 'translateY(-5px)';
    }

    /* Label transition starts at the same time as slot exit */
    if (isNewSec) {
      if (!prefRed) {
        lblEl.classList.add('ffi-lbl-gone');
        /* Update label text once it's invisible */
        setTimeout(function () {
          lblEl.textContent = secs[nS].label;
          lblEl.classList.remove('ffi-lbl-gone');
        }, lDur);
      } else {
        /* Reduced motion: instant label swap */
        lblEl.textContent = secs[nS].label;
      }
    }

    /* ── MID-POINT: update content, flip slot to enter position ── */
    setTimeout(function () {
      /* Advance state */
      sIdx = nS;
      iIdx = nI;

      /* Render new content while slot is invisible */
      renderItem(secs[sIdx].items[iIdx]);

      /* Reset slot to enter-from position instantly (no transition) */
      slotEl.classList.add('ffi-t-no-trans');

      if (!prefRed) {
        slotEl.style.transform = isNewSec ? 'translateX(12px)' : 'translateY(5px)';
      }

      /* Force a layout flush so the browser registers the new position
         before we re-enable transitions on the next paint */
      void slotEl.offsetWidth;

      /* ── ENTER ── */
      slotEl.classList.remove('ffi-t-no-trans', 'ffi-gone');
      slotEl.style.transform = ''; /* transition fires: enter-from → base (0,0) */

      /* ── DONE ── */
      setTimeout(function () {
        isBusy = false;
        if (!isPaused) schedule();
      }, xDur + 50); /* small buffer past transition end */

    }, xDur || 0);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     BUILD DOM
     ═══════════════════════════════════════════════════════════════════════════ */

  function buildTicker() {
    tickerEl = document.createElement('div');
    tickerEl.id = 'ffi-ticker';
    tickerEl.setAttribute('role', 'region');
    tickerEl.setAttribute('aria-label', 'ForeFathers Invitational updates');

    /* Badge */
    var badge = document.createElement('div');
    badge.className = 'ffi-t-badge';
    badge.setAttribute('aria-hidden', 'true');

    var ffiSpan  = document.createElement('span');
    ffiSpan.className   = 'ffi-t-ffi';
    ffiSpan.textContent = 'FFI';

    var pipe = document.createElement('span');
    pipe.className   = 'ffi-t-pipe';
    pipe.textContent = '|';

    lblEl = document.createElement('span');
    lblEl.className   = 'ffi-t-lbl';
    lblEl.id          = 'ffi-t-lbl';
    lblEl.textContent = secs[0].label;

    badge.appendChild(ffiSpan);
    badge.appendChild(pipe);
    badge.appendChild(lblEl);

    /* Stage */
    var stage = document.createElement('div');
    stage.className = 'ffi-t-stage';

    slotEl = document.createElement('div');
    slotEl.className = 'ffi-t-slot';
    slotEl.id        = 'ffi-t-slot';
    stage.appendChild(slotEl);

    tickerEl.appendChild(badge);
    tickerEl.appendChild(stage);
    document.body.appendChild(tickerEl);

    /* Render first item immediately */
    renderItem(secs[0].items[0]);

    /* Enable slot and label transitions AFTER the first render frame
       to prevent a fade-in on page load */
    var tDur = cfg.transitionDuration;
    var lDur = cfg.labelTransDuration;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!prefRed) {
          slotEl.style.transition =
            'opacity ' + tDur + 'ms ease, transform ' + tDur + 'ms ease';
          lblEl.style.transition =
            'opacity ' + lDur + 'ms ease';
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════════════ */

  function init() {
    if (!cfg.tickerEnabled)                                       return;
    if (!cfg.showOnMobile && window.innerWidth < 600)             return;
    if (document.getElementById('ffi-ticker'))                    return;

    buildTicker();

    /* Push body content up so nothing hides under the ticker */
    document.body.style.paddingBottom =
      'calc(48px + env(safe-area-inset-bottom, 0px))';

    /* ── Hover / focus pause ── */
    if (cfg.pauseOnHover) {
      tickerEl.addEventListener('mouseenter', function () {
        isPaused = true;
        clearTimeout(timer);
      });
      tickerEl.addEventListener('mouseleave', function () {
        isPaused = false;
        if (!isBusy) schedule();
      });
      tickerEl.addEventListener('focusin', function () {
        isPaused = true;
        clearTimeout(timer);
      });
      tickerEl.addEventListener('focusout', function () {
        isPaused = false;
        if (!isBusy) schedule();
      });
    }

    /* ── Start ── */
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
