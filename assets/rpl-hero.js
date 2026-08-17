/*
  rpl-hero.js — hero slideshow: prev/next, dot navigation, optional
  autoplay, and background-video play/pause.

  Loaded only from sections/hero.liquid. Without this file, only the first
  slide/block ever renders (see the CSS in hero.liquid, which isn't gated
  behind .js) — a correct, complete single hero, just not navigable.

  Autoplay is opt-in (settings.autoplay) and pausable per WCAG 2.2.2 —
  hovering, focusing anything inside the carousel, the tab going to the
  background, or prefers-reduced-motion all pause it; the toggle button
  itself is a separate, deliberate pause reason so it isn't immediately
  overridden by e.g. focus leaving.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  function initCarousel(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.rpl-hero__slide'));
    if (slides.length <= 1) return;

    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-hero-dot]'));
    var prevButton = root.querySelector('[data-hero-prev]');
    var nextButton = root.querySelector('[data-hero-next]');
    var autoplayToggle = root.querySelector('[data-hero-autoplay-toggle]');
    var current = slides.findIndex(function (slide) {
      return slide.hasAttribute('data-slide-active');
    });
    if (current === -1) current = 0;

    function videoIn(slide) {
      return slide.querySelector('[data-hero-video] video, .rpl-hero__video');
    }

    function goTo(index) {
      var next = (index + slides.length) % slides.length;
      if (next === current) return;

      var leaving = slides[current];
      var entering = slides[next];

      leaving.removeAttribute('data-slide-active');
      leaving.setAttribute('aria-hidden', 'true');
      var leavingVideo = videoIn(leaving);
      if (leavingVideo) leavingVideo.pause();

      entering.setAttribute('data-slide-active', '');
      entering.setAttribute('aria-hidden', 'false');
      var enteringVideo = videoIn(entering);
      if (enteringVideo && !RPL.prefersReducedMotion()) {
        enteringVideo.play().catch(function () {});
      }

      dots.forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === next ? 'true' : 'false');
      });

      current = next;
    }

    if (prevButton) prevButton.addEventListener('click', function () { goTo(current - 1); });
    if (nextButton) nextButton.addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); });
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(current - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(current + 1);
      }
    });

    /* ------------------------------------------------------------------
       Autoplay — reference-counted pause reasons, so hover + focus +
       manual pause + tab-hidden can't accidentally cancel each other out.
       ------------------------------------------------------------------ */

    var autoplayEnabled = root.getAttribute('data-autoplay') === 'true';
    var speed = (parseInt(root.getAttribute('data-autoplay-speed'), 10) || 5) * 1000;
    var pauseReasons = new Set();
    var timer = null;

    function pause(reason) {
      pauseReasons.add(reason);
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function resume(reason) {
      pauseReasons.delete(reason);
      if (pauseReasons.size > 0 || timer) return;
      timer = setInterval(function () {
        goTo(current + 1);
      }, speed);
    }

    if (autoplayEnabled && !RPL.prefersReducedMotion()) {
      resume('init');

      root.addEventListener('mouseenter', function () { pause('hover'); });
      root.addEventListener('mouseleave', function () { resume('hover'); });
      root.addEventListener('focusin', function () { pause('focus'); });
      root.addEventListener('focusout', function () {
        if (!root.contains(document.activeElement)) resume('focus');
      });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          pause('hidden');
        } else {
          resume('hidden');
        }
      });

      if (autoplayToggle) {
        var pauseLabel = autoplayToggle.querySelector('[data-hero-autoplay-label-pause]');
        var playLabel = autoplayToggle.querySelector('[data-hero-autoplay-label-play]');
        var pauseIcon = autoplayToggle.querySelector('[data-hero-autoplay-icon-pause]');
        var playIcon = autoplayToggle.querySelector('[data-hero-autoplay-icon-play]');

        autoplayToggle.addEventListener('click', function () {
          var isPaused = pauseReasons.has('manual');
          if (isPaused) {
            resume('manual');
          } else {
            pause('manual');
          }
          isPaused = !isPaused;
          if (pauseIcon) pauseIcon.hidden = isPaused;
          if (playIcon) playIcon.hidden = !isPaused;
          if (pauseLabel) pauseLabel.hidden = isPaused;
          if (playLabel) playLabel.hidden = !isPaused;
        });
      }
    } else if (autoplayToggle) {
      autoplayToggle.hidden = true;
    }
  }

  function initVideoToggle(button) {
    var wrap = button.closest('[data-hero-video]');
    var video = wrap ? wrap.querySelector('video') : null;
    if (!video) return;

    var pauseIcon = button.querySelector('[data-hero-video-icon-pause]');
    var playIcon = button.querySelector('[data-hero-video-icon-play]');
    var pauseLabel = button.querySelector('[data-hero-video-label-pause]');
    var playLabel = button.querySelector('[data-hero-video-label-play]');

    function setPausedUI(paused) {
      if (pauseIcon) pauseIcon.hidden = paused;
      if (playIcon) playIcon.hidden = !paused;
      if (pauseLabel) pauseLabel.hidden = paused;
      if (playLabel) playLabel.hidden = !paused;
    }

    button.addEventListener('click', function () {
      if (video.paused) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    });
    video.addEventListener('play', function () { setPausedUI(false); });
    video.addEventListener('pause', function () { setPausedUI(true); });
  }

  function boot(root) {
    var scope = root || document;
    var carousels = scope.querySelectorAll('[data-hero-carousel]');
    Array.prototype.forEach.call(carousels, initCarousel);

    var videoToggles = scope.querySelectorAll('[data-hero-video-toggle]');
    Array.prototype.forEach.call(videoToggles, initVideoToggle);

    if (!RPL.prefersReducedMotion()) {
      var videos = scope.querySelectorAll('.rpl-hero__slide[data-slide-active] video');
      Array.prototype.forEach.call(videos, function (video) {
        video.play().catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
    });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });
})();
