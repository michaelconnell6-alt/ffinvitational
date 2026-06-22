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