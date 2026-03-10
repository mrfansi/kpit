/**
 * Returns the JavaScript string to embed in the HTML presentation.
 * Handles slide navigation, animations, fullscreen, and counter animations.
 */
export function getPresentationEngine(totalSlides: number): string {
  return `
    (function() {
      var current = 0;
      var total = ${totalSlides};
      var slides = document.querySelectorAll('.slide');
      var progressBar = document.getElementById('progress-bar');
      var counterEl = document.getElementById('slide-counter');

      function showSlide(index) {
        for (var i = 0; i < slides.length; i++) {
          slides[i].classList.remove('active', 'prev');
          if (i === index) slides[i].classList.add('active');
          else if (i < index) slides[i].classList.add('prev');
        }
        if (progressBar) progressBar.style.width = ((index + 1) / total * 100) + '%';
        if (counterEl) counterEl.textContent = (index + 1) + ' / ' + total;

        var activeSlide = slides[index];
        if (activeSlide) {
          var counters = activeSlide.querySelectorAll('[data-count-to]');
          for (var c = 0; c < counters.length; c++) {
            if (counters[c].dataset.counted) continue;
            counters[c].dataset.counted = 'true';
            animateCounter(counters[c], parseFloat(counters[c].dataset.countTo), counters[c].dataset.countSuffix || '');
          }

          var typewriters = activeSlide.querySelectorAll('[data-typewriter]');
          for (var t = 0; t < typewriters.length; t++) {
            if (typewriters[t].dataset.typed) continue;
            typewriters[t].dataset.typed = 'true';
            typewriter(typewriters[t], typewriters[t].dataset.typewriter);
          }
        }
      }

      function animateCounter(el, target, suffix) {
        var duration = 800;
        var start = performance.now();
        var isFloat = target % 1 !== 0;

        function tick(now) {
          var elapsed = now - start;
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          var val = eased * target;
          el.textContent = (isFloat ? val.toFixed(1) : Math.round(val)) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }

      function typewriter(el, text) {
        el.textContent = '';
        el.style.visibility = 'visible';
        var i = 0;
        function tick() {
          if (i < text.length) {
            el.textContent += text[i];
            i++;
            setTimeout(tick, 25);
          }
        }
        tick();
      }

      function next() { if (current < total - 1) { current++; showSlide(current); } }
      function prev() { if (current > 0) { current--; showSlide(current); } }

      document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === 'f' || e.key === 'F') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
        }
        else if (e.key === 'Escape' && document.fullscreenElement) {
          document.exitFullscreen();
        }
      });

      document.addEventListener('click', function(e) {
        if (e.target.closest && (
          e.target.closest('.tooltip-wrap') ||
          e.target.closest('.data-table') ||
          e.target.closest('.card') ||
          e.target.closest('a') ||
          e.target.closest('button')
        )) return;
        var x = e.clientX / window.innerWidth;
        if (x < 0.3) prev(); else next();
      });

      var touchStartX = 0;
      document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
      document.addEventListener('touchend', function(e) {
        var diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 50) { diff > 0 ? prev() : next(); }
      });

      showSlide(0);
    })();
  `;
}
