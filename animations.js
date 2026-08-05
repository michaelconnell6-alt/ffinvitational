/* ── ForeFathers Invitational — Shared Animations ── */
(function() {
  'use strict';

  // ── STAGGER ENTRANCE OBSERVER ──────────────────────────────────────────
  // Finds staggerable elements, adds ff-animate, triggers ff-visible on scroll.
  var STAGGER_SELECTORS = [
    '.player-card',
    '.champion-row',
    '.recap-stat',
    '.recap-award',
    '.rule-card',
    '.y2027-status-card',
    '.y2027-round',
    '.course-card',
    '.tt-group',
    '.podium-place'
  ].join(',');

  function initStagger() {
    var elements = document.querySelectorAll(STAGGER_SELECTORS);
    if (!elements.length || !window.IntersectionObserver) return;

    // Group elements by their parent row (elements within ~80px of each other share a row)
    var groups = [];
    var lastTop = -999;
    var currentGroup = [];

    elements.forEach(function(el) {
      var rect = el.getBoundingClientRect();
      var top = Math.round(rect.top + window.scrollY);
      if (Math.abs(top - lastTop) > 80) {
        if (currentGroup.length) groups.push(currentGroup);
        currentGroup = [el];
        lastTop = top;
      } else {
        currentGroup.push(el);
      }
    });
    if (currentGroup.length) groups.push(currentGroup);

    // Apply ff-animate with stagger delays per group
    groups.forEach(function(group) {
      group.forEach(function(el, i) {
        el.classList.add('ff-animate');
        el.style.transitionDelay = (i * 55) + 'ms';
      });
    });

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ff-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(function(el) { observer.observe(el); });
  }

  // ── COUNT-UP ANIMATION ─────────────────────────────────────────────────
  // Call on elements with a numeric textContent to animate from 0.
  function countUp(el, duration) {
    var target = parseFloat(el.textContent.replace(/[^\d.]/g, ''));
    if (isNaN(target) || target === 0) return;
    var start = null;
    var suffix = el.textContent.replace(/[\d.]/g, '');
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      var ease = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(ease * target);
      el.textContent = val + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCountUp() {
    var targets = document.querySelectorAll('[data-countup]');
    if (!targets.length || !window.IntersectionObserver) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          countUp(entry.target, 1200);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    targets.forEach(function(el) { observer.observe(el); });
  }

  // ── INIT ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initStagger();
      initCountUp();
    });
  } else {
    initStagger();
    initCountUp();
  }

})();
