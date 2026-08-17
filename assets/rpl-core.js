/*
  rpl-core.js — global runtime shared by every section.

  Loaded with `defer`. Exposes a single global, `window.RPL`, plus the
  `<rpl-drawer>` primitive that the cart drawer / menu drawer build on.

  Rules enforced here:
  - Never throw on a missing element. Sections render in the Theme Editor with
    zero blocks and no content; the JS must be a no-op in that case.
  - Everything is re-initialisable, because the Theme Editor swaps section HTML
    in place (`shopify:section:load`).
*/
(function () {
  'use strict';

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), details > summary, iframe, [tabindex]:not([tabindex="-1"])';

  var RPL = {};

  /* ------------------------------------------------------------------
     Small utilities
     ------------------------------------------------------------------ */

  RPL.debounce = function (fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait || 200);
    };
  };

  RPL.prefersReducedMotion = function () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  /* ------------------------------------------------------------------
     Screen-reader announcements
     ------------------------------------------------------------------ */

  RPL.announce = function (message, assertive) {
    var region = document.getElementById(assertive ? 'rpl-live-alert' : 'rpl-live-status');
    if (!region || !message) return;
    // Clearing first forces AT to re-read an identical consecutive message.
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 60);
  };

  /* ------------------------------------------------------------------
     Focus management
     ------------------------------------------------------------------ */

  RPL.getFocusable = function (container) {
    if (!container) return [];
    return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  };

  var activeTrap = null;

  RPL.trapFocus = function (container, elementToFocus) {
    if (!container) return;
    RPL.releaseFocus();

    function onKeydown(event) {
      if (event.key !== 'Tab') return;
      var focusable = RPL.getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    activeTrap = { container: container, onKeydown: onKeydown };
    document.addEventListener('keydown', onKeydown);

    var target = elementToFocus || RPL.getFocusable(container)[0] || container;
    if (target === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }
    window.requestAnimationFrame(function () {
      target.focus();
    });
  };

  RPL.releaseFocus = function () {
    if (!activeTrap) return;
    document.removeEventListener('keydown', activeTrap.onKeydown);
    activeTrap = null;
  };

  /* ------------------------------------------------------------------
     Body scroll lock (reference counted — nested drawers stay correct)
     ------------------------------------------------------------------ */

  var scrollLocks = 0;
  var savedScrollY = 0;

  RPL.lockScroll = function () {
    scrollLocks += 1;
    if (scrollLocks > 1) return;
    savedScrollY = window.scrollY;
    document.body.classList.add('rpl-scroll-locked');
  };

  RPL.unlockScroll = function () {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks > 0) return;
    document.body.classList.remove('rpl-scroll-locked');
    window.scrollTo({ top: savedScrollY, behavior: 'auto' });
  };

  /* ------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------ */

  var revealObserver = null;

  RPL.initReveal = function (root) {
    var scope = root || document;
    var targets = scope.querySelectorAll('.rpl-reveal:not(.rpl-reveal--in)');
    if (targets.length === 0) return;

    if (!('IntersectionObserver' in window) || RPL.prefersReducedMotion()) {
      Array.prototype.forEach.call(targets, function (el) {
        el.classList.add('rpl-reveal--in');
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('rpl-reveal--in');
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
      );
    }

    Array.prototype.forEach.call(targets, function (el) {
      revealObserver.observe(el);
    });
  };

  /* ------------------------------------------------------------------
     <rpl-drawer> — shared drawer/modal primitive
     ------------------------------------------------------------------ */

  if ('customElements' in window && !customElements.get('rpl-drawer')) {
    class RplDrawerElement extends HTMLElement {
      connectedCallback() {
        this.panel = this.querySelector('[data-drawer-panel]');
        this.overlay = this.querySelector('[data-drawer-overlay]');
        this.opener = null;

        this.onKeydown = this.onKeydown.bind(this);
        this.close = this.close.bind(this);

        this.addEventListener('click', (event) => {
          if (event.target.closest('[data-drawer-close]') || event.target === this.overlay) {
            event.preventDefault();
            this.close();
          }
        });
      }

      disconnectedCallback() {
        if (this.hasAttribute('data-open')) this.close();
      }

      onKeydown(event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          this.close();
        }
      }

      open(opener) {
        if (this.hasAttribute('data-open')) return;
        this.opener = opener || document.activeElement;
        this.setAttribute('data-open', 'true');
        if (this.panel) this.panel.setAttribute('data-open', 'true');
        if (this.overlay) this.overlay.setAttribute('data-open', 'true');
        RPL.lockScroll();
        document.addEventListener('keydown', this.onKeydown);
        RPL.trapFocus(this.panel || this);
        this.dispatchEvent(new CustomEvent('rpl:drawer:open', { bubbles: true }));
      }

      close() {
        if (!this.hasAttribute('data-open')) return;
        this.removeAttribute('data-open');
        if (this.panel) this.panel.removeAttribute('data-open');
        if (this.overlay) this.overlay.removeAttribute('data-open');
        RPL.unlockScroll();
        RPL.releaseFocus();
        document.removeEventListener('keydown', this.onKeydown);
        if (this.opener && typeof this.opener.focus === 'function') this.opener.focus();
        this.opener = null;
        this.dispatchEvent(new CustomEvent('rpl:drawer:close', { bubbles: true }));
      }

      toggle(opener) {
        if (this.hasAttribute('data-open')) {
          this.close();
        } else {
          this.open(opener);
        }
      }
    }

    customElements.define('rpl-drawer', RplDrawerElement);
  }

  /* Any `[data-drawer-open="drawer-id"]` button controls a drawer by id. */
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-drawer-open]');
    if (!trigger) return;
    var drawer = document.getElementById(trigger.getAttribute('data-drawer-open'));
    if (!drawer || typeof drawer.toggle !== 'function') return;
    event.preventDefault();
    drawer.toggle(trigger);
  });

  /* ------------------------------------------------------------------
     Mobile navigation — enhances the header's <details> off-canvas menu.

     The menu already opens/closes with zero JS (native <details>). This
     only adds what a plain disclosure can't do on its own: lock background
     scroll, trap focus in the panel, and close on overlay click, Escape,
     link click, or resize past the desktop breakpoint.
     ------------------------------------------------------------------ */

  function initMobileNav(root) {
    var scope = root || document;
    var navs = scope.querySelectorAll('.rpl-header__mobile-nav');

    Array.prototype.forEach.call(navs, function (details) {
      if (details.hasAttribute('data-rpl-bound')) return;
      details.setAttribute('data-rpl-bound', 'true');

      var panel = details.querySelector('.rpl-header__mobile-nav-panel');
      var overlay = details.querySelector('[data-mobile-nav-overlay]');
      var summary = details.querySelector('summary');

      function close() {
        if (details.open) details.open = false;
      }

      details.addEventListener('toggle', function () {
        if (details.open) {
          RPL.lockScroll();
          if (panel) RPL.trapFocus(panel);
        } else {
          RPL.unlockScroll();
          RPL.releaseFocus();
          if (summary && typeof summary.focus === 'function') summary.focus();
        }
      });

      if (overlay) {
        overlay.addEventListener('click', close);
      }

      details.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && details.open) {
          event.stopPropagation();
          close();
        }
      });

      if (panel) {
        panel.addEventListener('click', function (event) {
          if (event.target.closest('a[href]')) close();
        });
      }

      window.addEventListener(
        'resize',
        RPL.debounce(function () {
          if (details.open && window.matchMedia('(min-width: 990px)').matches) close();
        }, 150)
      );
    });
  }

  /* ------------------------------------------------------------------
     Carousels — generic enhancement for any native CSS scroll-snap track.
     The swipe/scroll itself needs no JS at all (that's the browser's native
     scroll-snap behavior, which is why this is a `[data-carousel]` track
     rather than a hand-rolled slider); this only wires up optional
     prev/next buttons. Shared by every section that wants a horizontal
     carousel (collection list, testimonials, …) instead of each rebuilding
     the same few lines.
     ------------------------------------------------------------------ */

  function initCarousels(root) {
    var scope = root || document;
    var carousels = scope.querySelectorAll('[data-carousel]');

    Array.prototype.forEach.call(carousels, function (carousel) {
      if (carousel.hasAttribute('data-rpl-bound')) return;
      carousel.setAttribute('data-rpl-bound', 'true');

      var track = carousel.querySelector('[data-carousel-track]');
      var prev = carousel.querySelector('[data-carousel-prev]');
      var next = carousel.querySelector('[data-carousel-next]');
      if (!track) return;

      function scrollByAmount(direction) {
        var item = track.querySelector('[data-carousel-item]');
        var amount = item ? item.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
        track.scrollBy({
          left: amount * direction,
          behavior: RPL.prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }

      if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
      if (next) next.addEventListener('click', function () { scrollByAmount(1); });
    });
  }

  /* ------------------------------------------------------------------
     Boot + Theme Editor lifecycle
     ------------------------------------------------------------------ */

  function boot(root) {
    RPL.initReveal(root);
    initMobileNav(root);
    initCarousels(root);
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

  window.RPL = RPL;
})();
