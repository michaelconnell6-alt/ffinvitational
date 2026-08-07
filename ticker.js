/* ── FFI Ticker ─────────────────────────────────────────────────────────────
   ForeFathers Invitational — offseason broadcast crawl.
   Self-contained IIFE. No external dependencies.
   ──────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Configuration ──────────────────────────────────────────────────────── */
  var FFI_TICKER = {

    tickerEnabled:  true,
    tickerSpeed:    72,          /* pixels per second — higher = faster      */
    pauseOnHover:   true,
    showOnMobile:   true,

    /* Edit items here. Fields:
       label     (string)  — ALL-CAPS category tag shown in gold
       text      (string)  — body copy; empty string if using countdown:true
       countdown (bool)    — replaces text with dynamic "N days until…"
       link      (string)  — optional relative URL; makes item clickable
    ─────────────────────────────────────────────────────────────────────── */
    tickerItems: [

      {
        label: 'NEXT STOP',
        text:  'Banff, Alberta · July 8–11, 2027',
        link:  'banff-2027.html'
      },
      {
        label:     'COUNTDOWN',
        text:      '',
        countdown: true
      },
      {
        label: 'THE FIELD',
        text:  '2027 roster announcements coming soon',
        link:  'roster.html'
      },
      {
        label: '2026 CHAMPION',
        text:  'Micah Smoak — Myrtle Beach, SC',
        link:  'champions.html'
      },
      {
        label: 'THE COURSES',
        text:  'Kananaskis · Stewart Creek · Silvertip · Banff Springs',
        link:  'banff-2027.html'
      },
      {
        label: 'DEFENDING CHAMPION',
        text:  'Micah Smoak returns after a wire-to-wire 2026 victory',
        link:  'champions.html'
      },
      {
        label: '2025 CHAMPION',
        text:  'Mikey Connell — Arcadia Bluffs / TreeTops',
        link:  'champions.html'
      },
      {
        label: '2026 RECAP',
        text:  'Smoak wins Myrtle Beach by 10 shots in dominant fashion',
        link:  'recap.html'
      },
      {
        label: '2022 CHAMPION',
        text:  'Mikey Connell — Pinehurst Resort',
        link:  'champions.html'
      },
      {
        label: 'HISTORY',
        text:  'In 2026, Steve Williams recorded the first hole-in-one in ForeFathers history'
      },
      {
        label: '2021 CHAMPION',
        text:  'Garrett Wardell — Pinehurst Resort',
        link:  'champions.html'
      },
      {
        label: 'FORMAT',
        text:  'Individual stroke play · Four rounds · Best total wins the title',
        link:  'format.html'
      }

    ]
  };

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  function daysUntilBanff() {
    var target = new Date('2027-07-08T00:00:00');
    var now    = new Date();
    var diff   = target - now;
    if (diff <= 0) { return 0; }
    return Math.ceil(diff / 86400000);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildItemHTML(item) {
    var text = item.text;
    if (item.countdown) {
      var d = daysUntilBanff();
      text  = d + ' days until the 2027 ForeFathers Invitational';
    }

    var inner =
      '<span class="ffi-t-label">' + esc(item.label) + '</span>' +
      '<span class="ffi-t-text">'  + esc(text)        + '</span>';

    if (item.link) {
      return '<a class="ffi-t-item" href="' + esc(item.link) + '">' + inner + '</a>';
    }
    return '<span class="ffi-t-item">' + inner + '</span>';
  }

  var SEP = '<span class="ffi-t-sep" aria-hidden="true">◆</span>';

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function init() {
    var cfg = FFI_TICKER;

    if (!cfg.tickerEnabled)                                        { return; }
    if (!cfg.showOnMobile && window.innerWidth < 600)              { return; }
    if (document.getElementById('ffi-ticker'))                     { return; }

    var prefersReduced = window.matchMedia &&
                         window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Build inner HTML — items separated by diamond glyphs */
    var items   = cfg.tickerItems;
    var htmlArr = items.map(function (item) {
      return buildItemHTML(item) + SEP;
    });
    var half = htmlArr.join('');
    var full = half + half;  /* duplicate for seamless CSS loop */

    /* Create ticker element */
    var ticker = document.createElement('div');
    ticker.id = 'ffi-ticker';
    ticker.setAttribute('aria-label', 'ForeFathers Invitational news ticker');
    ticker.setAttribute('role', 'marquee');
    ticker.setAttribute('aria-live', 'off');

    ticker.innerHTML =
      '<div class="ffi-t-badge" aria-hidden="true">FFI</div>' +
      '<div class="ffi-t-track">' +
        '<div class="ffi-t-inner" id="ffi-t-inner">' + full + '</div>' +
      '</div>';

    document.body.appendChild(ticker);

    /* Body padding so content never slides under ticker */
    var tickerH = 32 + 0; /* matches CSS height; safe-area handled via CSS */
    document.body.style.paddingBottom =
      'calc(' + tickerH + 'px + env(safe-area-inset-bottom, 0px))';

    if (prefersReduced) { return; } /* static display, no animation */

    /* Measure content width, then set animation duration */
    var inner = document.getElementById('ffi-t-inner');

    requestAnimationFrame(function () {
      /* scrollWidth is full duplicated content; half is one cycle */
      var oneCycleW = inner.scrollWidth / 2;
      var duration  = oneCycleW / cfg.tickerSpeed;
      inner.style.animationDuration = duration + 's';
      inner.classList.add('ffi-t-animate');

      /* Pause on hover */
      if (cfg.pauseOnHover) {
        ticker.addEventListener('mouseenter', function () {
          inner.style.animationPlayState = 'paused';
        });
        ticker.addEventListener('mouseleave', function () {
          inner.style.animationPlayState = 'running';
        });
        /* Pause on focus (keyboard/tab navigation) */
        ticker.addEventListener('focusin', function () {
          inner.style.animationPlayState = 'paused';
        });
        ticker.addEventListener('focusout', function () {
          inner.style.animationPlayState = 'running';
        });
      }
    });
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
