/**
 * Returns the JavaScript string to embed in the HTML presentation.
 * Handles core slide navigation and fullscreen.
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
      }

      function coreNavigationAvailable() {
        return !document.body.classList.contains('appendix-mode');
      }

      function isInteractiveTarget(target) {
        return target instanceof Element && !!target.closest(
          'button, a, input, textarea, select, summary, [contenteditable], [tabindex], [role="button"], [role="textbox"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menuitem"]'
        );
      }

      function next() { if (current < total - 1) { current++; showSlide(current); } }
      function prev() { if (current > 0) { current--; showSlide(current); } }

      document.addEventListener('keydown', function(e) {
        if (!coreNavigationAvailable() || e.defaultPrevented || e.isComposing ||
            e.altKey || e.ctrlKey || e.metaKey || isInteractiveTarget(e.target)) return;
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
        if (!coreNavigationAvailable() || isInteractiveTarget(e.target)) return;
        if (e.target.closest && (
          e.target.closest('.tooltip-wrap') ||
          e.target.closest('.data-table') ||
          e.target.closest('.card')
        )) return;
        var x = e.clientX / window.innerWidth;
        if (x < 0.3) prev(); else next();
      });

      var touchStartX = 0;
      document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
      document.addEventListener('touchend', function(e) {
        if (!coreNavigationAvailable() || isInteractiveTarget(e.target)) return;
        var diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 50) { diff > 0 ? prev() : next(); }
      });

      showSlide(0);
    })();
  `;
}
