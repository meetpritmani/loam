/* ==========================================================================
   Loam — global.js
   The only script in the theme. Loaded once, as type="module", from <head>.
   Zero dependencies.

   Structure
   - Small shared helpers (focus, announce, scroll lock)
   - Reveal: one shared IntersectionObserver for the whole document
   - <sticky-header>: sticky behaviour + height reporting
   - <loam-drawer>: dialog semantics, focus trap, Escape, focus restore

   Rules this file follows
   - One class per behaviour, registered with customElements.define.
   - Every element must survive shopify:section:load / :unload. Custom
     elements get that for free through connected/disconnectedCallback;
     anything document-level is registered once at module scope and is
     idempotent when re-run.
   - Every DOM lookup is optional-chained. A missing node degrades, never
     throws.
   ========================================================================== */

const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Visible, focusable descendants of a root, in document order.
 * @param {ParentNode} root
 * @returns {HTMLElement[]}
 */
function focusableWithin(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el instanceof HTMLElement && el.offsetParent !== null
  );
}

/**
 * Announce a message in the polite live region rendered by theme.liquid.
 * Used for cart and form feedback, and by any fetch that fails.
 * @param {string} message
 */
export function announce(message) {
  const region = document.getElementById('a11y-announcer');
  if (!region || !message) return;
  // Clearing first forces assistive tech to re-read an identical message.
  region.textContent = '';
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/* --- Scroll lock ---------------------------------------------------------
   Reference-counted so two overlapping overlays (a drawer opened from
   inside another) cannot unlock the page early. */

let scrollLocks = 0;
let lockedScrollY = 0;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks > 1) return;
  lockedScrollY = window.scrollY;
  document.body.style.setProperty('--locked-scroll-y', `-${lockedScrollY}px`);
  document.body.classList.add('no-scroll');
}

function unlockScroll() {
  if (scrollLocks === 0) return;
  scrollLocks -= 1;
  if (scrollLocks > 0) return;
  document.body.classList.remove('no-scroll');
  document.body.style.removeProperty('--locked-scroll-y');
  // The body was pinned with position: fixed, so the page is now at the
  // top — put the visitor back where they were.
  window.scrollTo(0, lockedScrollY);
}

/* ==========================================================================
   Reveal
   One IntersectionObserver for every `.reveal` element in the document.
   Kept as a module singleton rather than a custom element because it is a
   document-wide service, not the behaviour of one node — wrapping every
   revealable element in a custom element would cost a element instance per
   heading, which is the cost this rule exists to avoid.
   ========================================================================== */

const Reveal = {
  /** @type {IntersectionObserver|null} */
  observer: null,

  /**
   * Mark every element visible immediately, with no observer at all.
   * Called under reduced motion so nothing is ever left at opacity 0.
   * @param {ParentNode} root
   */
  revealAll(root) {
    root.querySelectorAll?.('.reveal').forEach((el) => el.classList.add('is-visible'));
  },

  /** @param {ParentNode} [root] */
  observe(root = document) {
    // Reduced motion, or the merchant switched animations off: short-circuit.
    if (PREFERS_REDUCED_MOTION.matches || document.documentElement.dataset.reveal === 'off') {
      this.revealAll(root);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      this.revealAll(root);
      return;
    }

    if (!this.observer) {
      this.observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            // One-shot: an element never un-reveals.
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.01 }
      );
    }

    root.querySelectorAll?.('.reveal:not(.is-visible)').forEach((el) => {
      this.observer?.observe(el);
    });
  },
};

Reveal.observe();

// If the visitor turns reduced motion on mid-session, stop animating and
// make sure nothing is stranded invisible.
PREFERS_REDUCED_MOTION.addEventListener('change', (event) => {
  if (event.matches) Reveal.revealAll(document);
});

// Theme editor: a newly added or re-rendered section brings new `.reveal`
// elements that the observer has never seen.
document.addEventListener('shopify:section:load', (event) => {
  Reveal.observe(event.target ?? document);
});

/* ==========================================================================
   <sticky-header>
   Wraps the header section group. Reports its own height into
   --header-height so anchors, drawers, and sticky product info can offset
   against it, and hides on scroll down / shows on scroll up once past the
   first viewport.
   ========================================================================== */

class StickyHeader extends HTMLElement {
  connectedCallback() {
    this.lastScroll = window.scrollY;
    this.ticking = false;
    this.enabled = this.dataset.sticky !== 'false';

    this.onScroll = this.onScroll.bind(this);
    this.measure = this.measure.bind(this);

    this.measure();

    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.measure);
      this.resizeObserver.observe(this);
    } else {
      window.addEventListener('resize', this.measure, { passive: true });
    }

    if (this.enabled) {
      this.classList.add('sticky-header--stuck');
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.measure);
    this.resizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--header-height');
  }

  measure() {
    const height = Math.round(this.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  }

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;

    window.requestAnimationFrame(() => {
      const current = window.scrollY;
      const height = this.offsetHeight;

      // Never hide while an overlay owns the screen, or the close button
      // scrolls out of reach.
      const overlayOpen = document.body.classList.contains('no-scroll');

      if (!overlayOpen && current > height * 2 && current > this.lastScroll) {
        this.classList.add('sticky-header--hidden');
      } else {
        this.classList.remove('sticky-header--hidden');
      }

      this.lastScroll = current > 0 ? current : 0;
      this.ticking = false;
    });
  }
}

if (!customElements.get('sticky-header')) {
  customElements.define('sticky-header', StickyHeader);
}

/* ==========================================================================
   <loam-drawer>
   The shared overlay used by the cart drawer, the mobile navigation, and
   any future panel. Owns dialog semantics, the focus trap, Escape, the
   scroll lock, and returning focus to whatever opened it.

   Markup contract:
     <loam-drawer id="cart-drawer">
       <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="...">
         <button data-drawer-close>…</button>
         <div class="drawer__overlay" data-drawer-close></div>
         <div class="drawer__panel">…</div>
       </div>
     </loam-drawer>

   Any button anywhere on the page opens it with:
     <button aria-controls="cart-drawer" aria-expanded="false" data-drawer-toggle>
   ========================================================================== */

class LoamDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('[role="dialog"]');
    this.panel = this.querySelector('.drawer__panel');

    this.onKeydown = this.onKeydown.bind(this);
    this.onClick = this.onClick.bind(this);

    this.addEventListener('click', this.onClick);
    this.setAttribute('data-drawer', '');

    // Openers live outside this element, so the listener is delegated from
    // the document and filtered by aria-controls.
    this.onDocumentClick = this.onDocumentClick.bind(this);
    document.addEventListener('click', this.onDocumentClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeydown);
    // A drawer removed while open (section reorder in the editor) must not
    // leave the page scroll-locked.
    if (this.open) unlockScroll();
  }

  get open() {
    return this.dialog?.hasAttribute('open') ?? false;
  }

  /** @param {MouseEvent} event */
  onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const toggle = target.closest('[data-drawer-toggle]');
    if (!toggle || toggle.getAttribute('aria-controls') !== this.id) return;
    event.preventDefault();
    this.opener = toggle;
    this.show();
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-drawer-close]')) {
      event.preventDefault();
      this.hide();
    }
  }

  /** @param {KeyboardEvent} event */
  onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = focusableWithin(this.panel ?? this.dialog);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  show() {
    if (!this.dialog || this.open) return;

    this.dialog.setAttribute('open', '');
    this.setToggleState(true);
    lockScroll();
    document.addEventListener('keydown', this.onKeydown);

    // Focus the first control inside the panel, falling back to the panel
    // itself so the trap always has somewhere to start.
    const focusable = focusableWithin(this.panel ?? this.dialog);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.panel?.setAttribute('tabindex', '-1');
      this.panel?.focus();
    }

    this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
  }

  hide() {
    if (!this.dialog || !this.open) return;

    this.dialog.removeAttribute('open');
    this.setToggleState(false);
    unlockScroll();
    document.removeEventListener('keydown', this.onKeydown);

    this.opener?.focus?.();
    this.opener = null;

    this.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));
  }

  /** @param {boolean} expanded */
  setToggleState(expanded) {
    document
      .querySelectorAll(`[data-drawer-toggle][aria-controls="${this.id}"]`)
      .forEach((toggle) => toggle.setAttribute('aria-expanded', String(expanded)));
  }
}

if (!customElements.get('loam-drawer')) {
  customElements.define('loam-drawer', LoamDrawer);
}
