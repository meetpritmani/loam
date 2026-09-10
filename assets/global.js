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
const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)');

// Matches --dur-slow in theme-tokens.liquid, the drawer panel's own
// slide transition. Used only to sequence one drawer's close against
// another's open — see <product-form> below — so it has to track that
// token rather than drift from it.
const DRAWER_TRANSITION_MS = 420;

// Marks that the module parsed and is running, so CSS can hide the no-JS
// fallbacks (the localization submit buttons) without a flash.
document.documentElement.classList.add('js');

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
   inside another) cannot unlock the page early.

   The lock is `overflow: hidden` on <html>. It is not `position: fixed` on
   <body>: that pins the body out of flow, at which point its background
   propagates to the canvas while its children are clipped away, and the page
   behind an open drawer paints as a flat colour with nothing on it. Because
   the page never moves, there is no scroll position to save or restore. */

let scrollLocks = 0;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks > 1) return;
  document.documentElement.classList.add('no-scroll');
}

function unlockScroll() {
  if (scrollLocks === 0) return;
  scrollLocks -= 1;
  if (scrollLocks > 0) return;
  document.documentElement.classList.remove('no-scroll');
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
      const overlayOpen = document.documentElement.classList.contains('no-scroll');

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
      focusable[0].focus({ preventScroll: true });
    } else {
      this.panel?.setAttribute('tabindex', '-1');
      this.panel?.focus({ preventScroll: true });
    }

    this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
  }

  hide() {
    if (!this.dialog || !this.open) return;

    this.dialog.removeAttribute('open');
    this.setToggleState(false);
    unlockScroll();
    document.removeEventListener('keydown', this.onKeydown);

    // preventScroll matters: focusing the opener sits immediately after
    // unlockScroll, and the browser's default scroll-into-view undoes the
    // restore we just performed — landing the shopper back at the top of the
    // page every time they close the cart.
    this.opener?.focus?.({ preventScroll: true });
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

/* --------------------------------------------------------------------------
   Lazy sections
   quick-view-drawer and compare-drawer are closed dialogs most sessions
   never open, shipped inert inside `<template data-lazy-section="...">` in
   theme.liquid instead of live in the initial DOM (Lighthouse's dom-size
   audit was counting their markup on every single page load, opened or
   not). This runs in the capture phase — before <quick-view-trigger>'s own
   click handler and before <loam-drawer>'s own document-level listener,
   both added the moment their element connects — so by the time either
   runs, the real element is already in the DOM exactly as if it had been
   there all along. Neither piece of code above needed to change to know
   this exists; a drawer already present (every other one — cart, menu,
   search, size guide) is a no-op here.
   -------------------------------------------------------------------------- */
document.addEventListener(
  'click',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest('quick-view-trigger, [data-drawer-toggle]');
    if (!trigger) return;

    const id =
      trigger.localName === 'quick-view-trigger'
        ? 'quick-view-drawer'
        : trigger.getAttribute('aria-controls');
    if (!id || document.getElementById(id)) return;

    const template = document.querySelector(`template[data-lazy-section="${id}"]`);
    if (!template) return;

    document.body.appendChild(template.content.cloneNode(true));
    template.remove();
  },
  true
);

/* ==========================================================================
   <mega-menu>
   Progressive enhancement over native <details>/<summary>. The menu already
   opens on click and is keyboard operable with no JavaScript at all; this
   adds hover-intent for pointer users, Escape to close, and closing when
   focus or the pointer leaves the menu entirely.
   ========================================================================== */

class MegaMenu extends HTMLElement {
  connectedCallback() {
    this.openDelay = 80;
    this.closeDelay = 220;
    this.timer = null;

    this.onToggle = this.onToggle.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.onPointerOver = this.onPointerOver.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);

    // `toggle` does not bubble, so it is captured rather than delegated.
    this.addEventListener('toggle', this.onToggle, true);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('focusout', this.onFocusOut);

    if (CAN_HOVER.matches) {
      this.addEventListener('pointerover', this.onPointerOver);
      this.addEventListener('pointerleave', this.onPointerLeave);
    }
  }

  disconnectedCallback() {
    window.clearTimeout(this.timer);
    this.removeEventListener('toggle', this.onToggle, true);
    this.removeEventListener('keydown', this.onKeydown);
    this.removeEventListener('focusout', this.onFocusOut);
    this.removeEventListener('pointerover', this.onPointerOver);
    this.removeEventListener('pointerleave', this.onPointerLeave);
  }

  /** @returns {HTMLDetailsElement[]} */
  get panels() {
    return Array.from(this.querySelectorAll('[data-mega]'));
  }

  /** @param {HTMLDetailsElement} [except] */
  closeAll(except) {
    this.panels.forEach((panel) => {
      if (panel !== except) panel.open = false;
    });
  }

  /** Only one mega panel may be open at a time. */
  onToggle(event) {
    const panel = event.target;
    if (panel instanceof HTMLDetailsElement && panel.open) this.closeAll(panel);
  }

  onPointerOver(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = target.closest('[data-mega]');
    window.clearTimeout(this.timer);

    if (!panel) {
      // Hovering a top-level link that has no dropdown still dismisses an
      // open panel — otherwise it hangs over the page.
      this.timer = window.setTimeout(() => this.closeAll(), this.closeDelay);
      return;
    }

    this.timer = window.setTimeout(() => {
      panel.open = true;
      this.closeAll(panel);
    }, this.openDelay);
  }

  onPointerLeave() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.closeAll(), this.closeDelay);
  }

  onKeydown(event) {
    if (event.key !== 'Escape') return;
    const open = this.panels.find((panel) => panel.open);
    if (!open) return;
    event.preventDefault();
    open.open = false;
    // Focus must land somewhere predictable, not on <body>.
    open.querySelector('summary')?.focus();
  }

  onFocusOut() {
    // Where focus actually landed is not reliably readable synchronously, so
    // check on the next frame.
    window.requestAnimationFrame(() => {
      if (!this.contains(document.activeElement)) this.closeAll();
    });
  }
}

if (!customElements.get('mega-menu')) {
  customElements.define('mega-menu', MegaMenu);
}

/* ==========================================================================
   <announcement-bar>
   Crossfades between stacked messages. Messages are absolutely positioned on
   top of each other so the bar's height never changes mid-rotation.

   Auto-rotation stops entirely under reduced motion while the previous and
   next buttons keep working — the shopper can still read every message, they
   are just not moved through them. It also pauses on hover, on focus, and
   when the tab is hidden.
   ========================================================================== */

class AnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.slides = Array.from(this.querySelectorAll('[data-announcement-slide]'));
    if (this.slides.length < 2) return;

    this.index = 0;
    this.interval = Number(this.dataset.interval) || 6000;
    this.autoplay = this.dataset.rotate === 'true' && !PREFERS_REDUCED_MOTION.matches;

    this.onClick = this.onClick.bind(this);
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);

    this.addEventListener('click', this.onClick);
    this.addEventListener('pointerenter', this.pause);
    this.addEventListener('pointerleave', this.resume);
    this.addEventListener('focusin', this.pause);
    this.addEventListener('focusout', this.resume);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.resume();
  }

  disconnectedCallback() {
    this.pause();
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('pointerenter', this.pause);
    this.removeEventListener('pointerleave', this.resume);
    this.removeEventListener('focusin', this.pause);
    this.removeEventListener('focusout', this.resume);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('[data-announcement-step]');
    if (!control) return;
    this.pause();
    this.go(this.index + Number(control.dataset.announcementStep));
    this.resume();
  }

  onVisibilityChange() {
    if (document.hidden) this.pause();
    else this.resume();
  }

  pause() {
    window.clearInterval(this.timer);
    this.timer = null;
  }

  resume() {
    if (!this.autoplay || this.timer) return;
    this.timer = window.setInterval(() => this.go(this.index + 1), this.interval);
  }

  /** @param {number} next */
  go(next) {
    const total = this.slides.length;
    const index = ((next % total) + total) % total;

    this.slides.forEach((slide, i) => {
      const isActive = i === index;
      slide.classList.toggle('is-active', isActive);
      if (isActive) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });

    this.index = index;
  }
}

if (!customElements.get('announcement-bar')) {
  customElements.define('announcement-bar', AnnouncementBar);
}

/* --------------------------------------------------------------------------
   Announcement bar dismiss (§9.4: "optional dismiss persisting for the
   session"). Lives outside the <announcement-bar> custom element above
   because dismissing has to remove the whole bar, localization selectors
   included, not just the rotator. sessionStorage rather than localStorage —
   a new tab or the next visit sees the bar again, which is what "for the
   session" means. Keyed per section id so more than one announcement bar
   on a page dismisses independently.
   -------------------------------------------------------------------------- */

function hideDismissedAnnouncements(root) {
  root.querySelectorAll?.('[data-announcement-root]').forEach((bar) => {
    try {
      if (sessionStorage.getItem(`loam:announcement-dismissed:${bar.dataset.announcementRoot}`) === 'true') {
        bar.remove();
      }
    } catch {
      // Storage unavailable (private mode, disabled) — bar just stays visible.
    }
  });
}

hideDismissedAnnouncements(document);
document.addEventListener('shopify:section:load', (event) => {
  hideDismissedAnnouncements(event.target ?? document);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('[data-announcement-dismiss]');
  if (!button) return;

  const bar = button.closest('[data-announcement-root]');
  if (!bar) return;

  try {
    sessionStorage.setItem(`loam:announcement-dismissed:${bar.dataset.announcementRoot}`, 'true');
  } catch {
    // Storage unavailable — dismissal just won't persist across navigations.
  }
  bar.remove();
});

/* ==========================================================================
   <quantity-input>
   The <input type="number"> stays the source of truth so the control still
   works when this module has not loaded; the buttons only step it and fire a
   change event, which is what the cart listens for.
   ========================================================================== */

class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.onClick = this.onClick.bind(this);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }

  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-quantity-step]');
    if (!button || !this.input) return;

    event.preventDefault();
    const step = Number(button.dataset.quantityStep) || 0;
    const min = Number(this.input.min) || 0;
    const max = this.input.max === '' ? Infinity : Number(this.input.max);
    const next = Math.min(max, Math.max(min, Number(this.input.value) + step));

    if (next === Number(this.input.value)) return;
    this.input.value = String(next);
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

if (!customElements.get('quantity-input')) {
  customElements.define('quantity-input', QuantityInput);
}

/* ==========================================================================
   Cart
   Every mutation goes through the Section Rendering API: the request asks
   Shopify to re-render the cart sections and hands back their HTML, which is
   swapped in wholesale. Cart markup is never rebuilt in JavaScript, so Liquid
   stays the single source of truth for money formatting, discounts, and the
   free-shipping threshold.
   ========================================================================== */

function cartRoute(path) {
  const root = window.Shopify?.routes?.root || '/';
  return root + path;
}

/**
 * The section ids to ask Shopify to re-render, read from the document rather
 * than hardcoded. The drawer is present on every page; the cart page section
 * is present only on /cart, and its id is whatever key the merchant's
 * cart.json uses. Asking for a section that is not on the page returns null
 * for it, so over-asking is harmless — but under-asking silently leaves half
 * the cart stale, which is why the DOM is the source of truth here.
 * @returns {string}
 */
function cartSectionIds() {
  const ids = new Set(['cart-count']);
  document.querySelectorAll('[data-cart-root]').forEach((node) => {
    const id = node.getAttribute('data-cart-root');
    if (id) ids.add(id);
  });
  return Array.from(ids).join(',');
}

const Cart = {
  /**
   * @param {string} url
   * @param {object} payload
   * @returns {Promise<object|null>} the cart JSON, or null on failure
   */
  async post(url, payload) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...payload,
          sections: cartSectionIds(),
          sections_url: window.location.pathname,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Shopify puts the human-readable reason in `description`, e.g.
        // "You can only add 3 of this item to your cart."
        throw new Error(data?.description || data?.message || response.statusText);
      }

      this.render(data.sections);
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: data } }));
      return data;
    } catch (error) {
      console.warn('[Loam] Cart update failed:', error);
      announce(error?.message || '');
      return null;
    }
  },

  /**
   * Swap the rendered sections in.
   *
   * Each cart section is matched to its own `[data-cart-root]`, and only the
   * inner regions of that root are replaced. Matching per root matters once
   * there is more than one cart on the page: on /cart the drawer and the cart
   * page both exist, both contain a `[data-cart-body]`, and a document-wide
   * querySelector would put the page's lines inside the drawer.
   *
   * The root elements themselves are never replaced. Replacing <loam-drawer>
   * while it is open would tear down the focus trap and the scroll lock
   * mid-interaction.
   * @param {Record<string,string>|undefined} sections
   */
  render(sections) {
    if (!sections) return;
    const parser = new DOMParser();

    Object.entries(sections).forEach(([id, html]) => {
      if (!html) return;
      const parsed = parser.parseFromString(html, 'text/html');

      if (id === 'cart-count') {
        const next = parsed.querySelector('.cart-count');
        if (!next) return;
        document.querySelectorAll('.cart-count').forEach((node) => {
          node.replaceWith(next.cloneNode(true));
        });
        return;
      }

      const current = document.querySelector(`[data-cart-root="${id}"]`);
      const incoming = parsed.querySelector(`[data-cart-root="${id}"]`);
      if (!current || !incoming) return;

      // Focus lives inside the region about to be replaced more often than
      // not — the shopper is usually holding a quantity stepper when this
      // runs. Remember it by id and put it back afterwards, or every change
      // dumps a keyboard user back to the top of the document.
      const active = document.activeElement;
      const activeId =
        active instanceof HTMLElement && current.contains(active) ? active.id : '';

      ['[data-cart-body]', '[data-cart-footer]'].forEach((selector) => {
        const nextRegion = incoming.querySelector(selector);
        const currentRegion = current.querySelector(selector);
        if (nextRegion && currentRegion) currentRegion.innerHTML = nextRegion.innerHTML;
      });

      // Carries the item count onto the live root so layout that depends on
      // an empty cart can react without the wrapper being re-rendered.
      const count = incoming.getAttribute('data-cart-count');
      if (count !== null) current.setAttribute('data-cart-count', count);

      if (activeId) document.getElementById(activeId)?.focus();
    });
  },

  /**
   * @param {number|string} id variant id
   * @param {number} quantity
   * @param {{properties?: object, recipient?: object}} [extra] gift card
   *   recipient fields — see GiftCardRecipientForm/ProductForm.onSubmit.
   */
  add(id, quantity, extra) {
    return this.post(cartRoute('cart/add.js'), { id, quantity, ...extra });
  },

  /**
   * @param {number} line 1-based cart line
   * @param {number} quantity
   */
  change(line, quantity) {
    return this.post(cartRoute('cart/change.js'), { line, quantity });
  },

  /** @param {string} note */
  updateNote(note) {
    return this.post(cartRoute('cart/update.js'), { note });
  },
};

/* --------------------------------------------------------------------------
   <cart-items>
   Owns the line-level controls inside the cart drawer. Quantity changes are
   debounced so holding the stepper fires one request, not eight.
   -------------------------------------------------------------------------- */

class CartItems extends HTMLElement {
  connectedCallback() {
    this.debounce = null;

    this.onChange = this.onChange.bind(this);
    this.onClick = this.onClick.bind(this);

    this.addEventListener('change', this.onChange);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    window.clearTimeout(this.debounce);
    this.removeEventListener('change', this.onChange);
    this.removeEventListener('click', this.onClick);
  }

  /** @param {boolean} busy */
  setBusy(busy) {
    this.toggleAttribute('aria-busy', busy);
  }

  onChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.line) return;

    const line = Number(input.dataset.line);
    const quantity = Math.max(0, Number(input.value) || 0);

    window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(async () => {
      this.setBusy(true);
      await Cart.change(line, quantity);
      this.setBusy(false);
    }, 350);
  }

  async onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const remove = target.closest('[data-cart-remove]');
    if (!remove) return;

    event.preventDefault();
    this.setBusy(true);
    await Cart.change(Number(remove.getAttribute('data-cart-remove')), 0);
    this.setBusy(false);
  }
}

if (!customElements.get('cart-items')) {
  customElements.define('cart-items', CartItems);
}

/* --------------------------------------------------------------------------
   Express checkout deferral
   The cart drawer's express-checkout markup ships inside an inert
   <template> (see cart-drawer.liquid) rather than live in the DOM. Shopify's
   checkout SDK is discovered by a client-side scan for the rendered button,
   not by the Liquid tag being present in the source — so leaving it inert
   until the drawer is actually opened keeps that SDK off every page load
   for a shopper who has items in cart but never opens the drawer.
   -------------------------------------------------------------------------- */

function activateExpressCheckout(root) {
  const template = root?.querySelector('template[data-express-checkout-template]');
  if (!template) return;
  template.replaceWith(template.content.cloneNode(true));
}

document.addEventListener('drawer:open', (event) => {
  if (event.target instanceof Element && event.target.id === 'cart-drawer') {
    activateExpressCheckout(event.target);
  }
});

// Cart.render() replaces the drawer's footer wholesale on every add/change,
// which brings back a fresh, un-activated template even if the shopper had
// already revealed the button. Only re-activate while the drawer is open —
// re-activating it behind a closed drawer would defeat the whole deferral.
document.addEventListener('cart:updated', () => {
  const drawer = document.getElementById('cart-drawer');
  if (drawer?.open) activateExpressCheckout(drawer);
});

/* --------------------------------------------------------------------------
   <product-form>
   Quick add from a product card. Wraps a real <form action="/cart/add">, so
   with JavaScript unavailable the button still posts and the shopper lands on
   the cart page — the add never depends on this class running.

   The add is only reported once the cart API has confirmed it. Nothing is
   announced, opened, or counted on the click itself: an optimistic update
   that later fails tells the shopper they bought something they did not.
   -------------------------------------------------------------------------- */

class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.button = this.querySelector('[type="submit"]');
    this.onSubmit = this.onSubmit.bind(this);
    this.form?.addEventListener('submit', this.onSubmit);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.onSubmit);
  }

  /** @param {SubmitEvent} event */
  async onSubmit(event) {
    event.preventDefault();
    if (this.button?.hasAttribute('aria-disabled')) return;

    const id = this.form?.querySelector('[name="id"]')?.value;
    if (!id) return;

    // The PDP has a quantity stepper; a product card does not. Default to 1
    // rather than assuming either shape.
    const quantity = Number(this.form?.querySelector('[name="quantity"]')?.value) || 1;

    // FormData picks up more than this.form's own descendants: both the
    // gift-card recipient fields (buy-buttons.liquid, nested inside the
    // form) and selling-plan-selector.liquid's radios (outside it,
    // associated purely via form="…") are form-associated elements per the
    // HTML spec, so a single FormData(this.form) call sees all of them.
    const formData = this.form ? new FormData(this.form) : null;
    let extra;

    // Gift card recipient fields. The checkbox IS the
    // `properties[__shopify_send_gift_card_to_recipient]` field, so its
    // presence in FormData already means "checked" — no gift-card purchase
    // reaches here with anything extra to send.
    const sendAsGift = formData?.get('properties[__shopify_send_gift_card_to_recipient]');
    if (sendAsGift) {
      const recipient = {};
      ['email', 'name', 'message', 'send_on'].forEach((key) => {
        const value = formData?.get(`recipient[${key}]`);
        if (value) recipient[key] = value;
      });
      extra = { properties: { __shopify_send_gift_card_to_recipient: true }, recipient };
    }

    // Selling plan (selling-plan-selector.liquid). Blank value means
    // "one-time purchase" was picked — nothing extra to send for that case.
    const sellingPlan = formData?.get('selling_plan');
    if (sellingPlan) {
      extra = { ...extra, selling_plan: sellingPlan };
    }

    // aria-disabled rather than disabled: a disabled button loses focus, and
    // the shopper's place on the page goes with it.
    this.button?.setAttribute('aria-disabled', 'true');
    this.toggleAttribute('aria-busy', true);

    const cart = await Cart.add(id, quantity, extra);

    this.button?.removeAttribute('aria-disabled');
    this.toggleAttribute('aria-busy', false);

    if (!cart) return;

    announce(this.dataset.successMessage || '');

    // Opening the drawer is the confirmation. Only on success, and only when
    // the merchant is running the drawer rather than the cart page.
    const cartDrawer = document.getElementById('cart-drawer');

    // This form can itself be inside a drawer — quick view, most often.
    // Two drawers open at once fight over the same focus trap and the same
    // Escape listener, and the cart drawer sliding in on top of an
    // unrelated one reads as a glitch, not a confirmation. So that drawer
    // closes first, and the cart drawer opens only once its own slide-out
    // transition has actually finished — not layered underneath it.
    // Excluded: the cart drawer's own upsell cards render a <product-form>
    // too, and closing the cart drawer to then reopen itself would be a
    // pointless flicker on an already-open drawer.
    const ownDrawer = this.closest('loam-drawer');

    if (ownDrawer && ownDrawer !== cartDrawer && ownDrawer.open) {
      ownDrawer.hide();
      const delay = PREFERS_REDUCED_MOTION.matches ? 0 : DRAWER_TRANSITION_MS;
      window.setTimeout(() => cartDrawer?.show?.(), delay);
    } else {
      cartDrawer?.show?.();
    }
  }
}

if (!customElements.get('product-form')) {
  customElements.define('product-form', ProductForm);
}


/* --------------------------------------------------------------------------
   Cart note. Delegated from the document because the textarea sits inside the
   footer region that is replaced on every cart update, so a listener bound
   directly to it would not survive the first change.
   -------------------------------------------------------------------------- */

let noteDebounce = null;
document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.hasAttribute('data-cart-note')) return;
  window.clearTimeout(noteDebounce);
  noteDebounce = window.setTimeout(() => Cart.updateNote(target.value), 600);
});

/* ==========================================================================
   Localization
   The selects live inside real <form> elements with a submit button, so
   changing market works with no JavaScript. When this module is running the
   button is hidden by CSS and changing the select submits directly.
   ========================================================================== */

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.hasAttribute('data-localization-select')) {
    return;
  }
  target.form?.submit();
});

/* ==========================================================================
   <hero-media>
   Inserts the hero <video> only once the viewport is wide enough to warrant
   it. Rendering the <video> in Liquid and hiding it with CSS would still
   cost the request on a phone, which is exactly the cost the build spec
   forbids above the fold on mobile.

   Also never loads video under reduced motion — an autoplaying loop is
   motion, whatever else it is.
   ========================================================================== */

class HeroMedia extends HTMLElement {
  connectedCallback() {
    this.src = this.dataset.videoSrc;
    if (!this.src) return;

    const minWidth = Number(this.dataset.videoWidth) || 750;
    this.query = window.matchMedia(`(min-width: ${minWidth}px)`);
    this.onChange = this.onChange.bind(this);
    this.query.addEventListener('change', this.onChange);
    this.onChange();
  }

  disconnectedCallback() {
    this.query?.removeEventListener('change', this.onChange);
    this.teardown();
  }

  onChange() {
    if (this.query?.matches && !PREFERS_REDUCED_MOTION.matches) this.mount();
    else this.teardown();
  }

  mount() {
    if (this.video) return;

    const video = document.createElement('video');
    video.src = this.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    video.preload = 'metadata';
    video.className = 'hero__video';

    // Only reveal the video once it can actually paint, so the poster is
    // never replaced by a black box.
    video.addEventListener(
      'loadeddata',
      () => {
        video.classList.add('is-ready');
      },
      { once: true }
    );

    this.appendChild(video);
    this.video = video;

    const attempt = video.play();
    if (attempt?.catch) {
      attempt.catch((error) => {
        // Autoplay refusal is normal (low power mode, data saver). The
        // poster stays; nothing to recover from.
        console.warn('[Loam] Hero video autoplay declined:', error?.message || error);
        this.teardown();
      });
    }
  }

  teardown() {
    if (!this.video) return;
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.remove();
    this.video = null;
  }
}

if (!customElements.get('hero-media')) {
  customElements.define('hero-media', HeroMedia);
}

/* ==========================================================================
   <marquee-strip>
   Duplicates its track until it is at least twice the viewport width, then
   animates by exactly -50%. Duplicating in JS rather than Liquid is what
   makes the loop seamless at any content length: the number of copies
   depends on rendered width, which Liquid cannot measure.

   The duplicate is aria-hidden and inert, so the messages are announced once
   and the copies never take a tab stop.
   ========================================================================== */

class MarqueeStrip extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-marquee-track]');
    if (!this.track || this.track.children.length === 0) return;

    // Clones are filtered out before capturing the originals. The real
    // editor re-renders a section from Liquid, so its markup is clean — but
    // anything that restores a previously-mutated DOM (an app, a snapshot,
    // a test harness) would otherwise have its clones treated as source
    // content and the track would double on every re-initialisation.
    this.reset();
    this.originals = Array.from(this.track.children).filter(
      (el) => el.dataset.marqueeClone === undefined && el.dataset.marqueeMirror === undefined
    );

    this.build = this.build.bind(this);
    this.onMotionChange = this.onMotionChange.bind(this);

    this.build();

    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.build);
      this.resizeObserver.observe(this);
    }
    PREFERS_REDUCED_MOTION.addEventListener('change', this.onMotionChange);

    if (this.dataset.pauseOnHover === 'true') {
      this.addEventListener('pointerenter', () => this.setAttribute('data-paused', 'true'));
      this.addEventListener('pointerleave', () => this.removeAttribute('data-paused'));
      // Keyboard users get the same courtesy: focusing a link inside the
      // strip stops it moving under them.
      this.addEventListener('focusin', () => this.setAttribute('data-paused', 'true'));
      this.addEventListener('focusout', () => this.removeAttribute('data-paused'));
    }
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    PREFERS_REDUCED_MOTION.removeEventListener('change', this.onMotionChange);
  }

  onMotionChange() {
    this.build();
  }

  build() {
    if (!this.track) return;

    if (PREFERS_REDUCED_MOTION.matches) {
      this.reset();
      this.removeAttribute('data-animate');
      return;
    }

    this.reset();

    // Both reads happen up front, before any writes, so the repeat count is
    // computed once instead of re-measuring scrollWidth after every
    // appendChild — that interleaved read/write is what forces a synchronous
    // layout recalculation on each pass.
    const target = this.offsetWidth * 2;
    const baseWidth = this.track.scrollWidth || 1;
    const repeats = Math.min(Math.max(Math.ceil(target / baseWidth), 1), 20);

    for (let i = 0; i < repeats; i += 1) {
      this.originals.forEach((node) => {
        const copy = node.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.dataset.marqueeClone = '';
        copy.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
        this.track.appendChild(copy);
      });
    }

    // The -50% translate only lands seamlessly if the track is an exact
    // doubling, so mirror whatever we ended up with once more.
    Array.from(this.track.children).forEach((node) => {
      if (node.dataset.marqueeMirror !== undefined) return;
      const copy = node.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.dataset.marqueeMirror = '';
      copy.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
      this.track.appendChild(copy);
    });

    this.setAttribute('data-animate', 'true');
  }

  reset() {
    if (!this.track) return;
    this.track
      .querySelectorAll('[data-marquee-clone], [data-marquee-mirror]')
      .forEach((node) => node.remove());
  }
}

if (!customElements.get('marquee-strip')) {
  customElements.define('marquee-strip', MarqueeStrip);
}

/* ==========================================================================
   <count-up>
   Animates an impact stat from zero to its value when it scrolls into view.

   The finished value is already in the DOM when this runs — the element's
   own text content — so the animation is purely decorative. Under reduced
   motion, or with no IntersectionObserver, nothing happens at all and the
   number simply stands there, which is the correct outcome rather than a
   degraded one.

   The numeric part is animated and any prefix or suffix the merchant typed
   is reapplied each frame, so "2.1M" counts the 2.1 and keeps the M. The
   element is aria-hidden during the count and restored afterwards, so a
   screen reader is never read a stream of intermediate numbers.
   ========================================================================== */

class CountUp extends HTMLElement {
  connectedCallback() {
    this.finalText = this.textContent;
    // NOT this.prefix / this.suffix: Element.prototype.prefix is a
    // read-only getter (the XML namespace prefix), so assigning it throws
    // in a module's strict mode and takes the whole element down with it.
    // Custom elements inherit the entire Element surface — check before
    // claiming a property name on `this`.
    this.valuePrefix = this.dataset.prefix || '';
    this.valueSuffix = this.dataset.suffix || '';

    const raw = (this.dataset.countTo || '').replace(/[^0-9.]/g, '');
    this.target = parseFloat(raw);

    if (!Number.isFinite(this.target) || this.target === 0) return;
    if (PREFERS_REDUCED_MOTION.matches) return;
    if (!('IntersectionObserver' in window)) return;

    // Decimal places are taken from the merchant's own value, so 2.1 counts
    // in tenths and 12400 counts in whole numbers.
    const dot = raw.indexOf('.');
    this.decimals = dot === -1 ? 0 : raw.length - dot - 1;

    this.observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          this.run();
        });
      },
      { threshold: 0.4 }
    );
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    // Never leave a half-counted number behind if the section is removed
    // mid-animation.
    if (this.finalText) this.textContent = this.finalText;
    this.removeAttribute('aria-hidden');
  }

  run() {
    const duration = 900;
    const start = performance.now();
    this.setAttribute('aria-hidden', 'true');

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast at first, settling into the final value.
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = (this.target * eased).toFixed(this.decimals);
      this.textContent = `${this.valuePrefix}${value}${this.valueSuffix}`;

      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        // Snap to the merchant's exact string — never to a rounded
        // reconstruction of it, which would drop thousands separators.
        this.textContent = this.finalText;
        this.removeAttribute('aria-hidden');
      }
    };

    this.frame = requestAnimationFrame(step);
  }
}

if (!customElements.get('count-up')) {
  customElements.define('count-up', CountUp);
}

/* ==========================================================================
   <video-player>
   Click to play. Nothing but the poster loads until the visitor asks for the
   film — which keeps a multi-megabyte video off the connection of everyone
   who scrolled past, and keeps a YouTube or Vimeo iframe (and its cookies)
   from existing at all unless someone opts in.

   Focus moves to the player once it is mounted, so a keyboard user who
   pressed the button is not left with focus on a control that no longer
   exists.
   ========================================================================== */

class VideoPlayer extends HTMLElement {
  connectedCallback() {
    this.onClick = this.onClick.bind(this);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.teardown();
  }

  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('[data-video-play]')) return;
    event.preventDefault();
    this.mount();
  }

  mount() {
    if (this.mounted) return;

    const frame = this.querySelector('.video-section__frame');
    if (!frame) return;

    const externalSrc = this.dataset.externalSrc;
    const videoSrc = this.dataset.videoSrc;

    let player;

    if (videoSrc) {
      player = document.createElement('video');
      player.src = videoSrc;
      player.controls = true;
      player.autoplay = true;
      player.playsInline = true;
      player.preload = 'metadata';
    } else if (externalSrc) {
      player = document.createElement('iframe');
      player.src = externalSrc;
      player.title = this.getAttribute('data-title') || 'Video';
      player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      player.allowFullscreen = true;
      // No referrer leaks to the embed host beyond the origin.
      player.referrerPolicy = 'strict-origin-when-cross-origin';
    } else {
      return;
    }

    this.querySelector('[data-video-play]')?.remove();
    frame.appendChild(player);
    this.mounted = player;

    // The button that had focus is gone; put focus somewhere real.
    player.setAttribute('tabindex', '-1');
    player.focus?.({ preventScroll: true });

    if (player instanceof HTMLVideoElement) {
      const attempt = player.play();
      attempt?.catch?.((error) => {
        // Controls are visible either way, so the visitor can still start it.
        console.warn('[Loam] Video autoplay declined:', error?.message || error);
      });
    }
  }

  teardown() {
    if (!this.mounted) return;
    if (this.mounted instanceof HTMLVideoElement) {
      this.mounted.pause();
      this.mounted.removeAttribute('src');
      this.mounted.load();
    }
    this.mounted.remove();
    this.mounted = null;
  }
}

if (!customElements.get('video-player')) {
  customElements.define('video-player', VideoPlayer);
}

/* ==========================================================================
   PRODUCT
   ========================================================================== */

/* --------------------------------------------------------------------------
   <product-gallery>
   Every image is in the DOM and visible at once — a stacked grid, not a
   single stage with thumbnails — so there is nothing to show or hide here.
   The one job left is variant sync: when the picker selects a variant with
   its own featured media, scroll that image into view rather than swap
   anything. Lightbox open/close is handled entirely by <loam-drawer>, one
   per image; this element does not intercept clicks at all.
   -------------------------------------------------------------------------- */

class ProductGallery extends HTMLElement {
  /** @param {string|number} mediaId */
  show(mediaId) {
    const target = this.querySelector(`[data-media-id="${CSS.escape(String(mediaId))}"]`);
    target?.scrollIntoView({
      behavior: PREFERS_REDUCED_MOTION.matches ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}

/* --------------------------------------------------------------------------
   <variant-picker>
   Owns option selection. On change it resolves the variant and updates the
   hidden id, the URL, the gallery and the button state straight from the
   variant table, then asks the Section Rendering API for the price and
   low-stock regions.

   Money is deliberately NOT formatted here. Re-implementing Liquid's `money`
   filter in JavaScript is how themes end up printing the wrong currency
   symbol, decimal separator or placement for a market, so the price comes
   back rendered by Shopify.
   -------------------------------------------------------------------------- */

class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.section = this.dataset.section || '';
    this.productUrl = this.dataset.url || '';
    this.variants = this.readVariants();

    this.onChange = this.onChange.bind(this);
    this.addEventListener('change', this.onChange);

    this.markAvailability();
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.onChange);
    this.controller?.abort();
  }

  /** @returns {Array<object>} */
  readVariants() {
    const node = this.querySelector('[data-variant-data]');
    if (!node) return [];
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      console.warn('[Loam] Variant data could not be parsed:', error);
      return [];
    }
  }

  /** @returns {Array<string>} selected value of each option, in order */
  get selection() {
    return [...this.querySelectorAll('.variant-picker__option')].map(
      (group) => group.querySelector('input:checked')?.value ?? ''
    );
  }

  /** @returns {object|undefined} */
  get variant() {
    const chosen = this.selection;
    return this.variants.find((v) =>
      chosen.every((value, index) => !value || v.options[index] === value)
    );
  }

  /* Re-mark every value against the CURRENT selection of the other options,
     which is finer than the coarse pass the server can do. Unavailable values
     stay visible and focusable: §9.7 is explicit that hiding a combination is
     what makes a picker feel broken. */
  markAvailability() {
    const chosen = this.selection;

    this.querySelectorAll('.variant-picker__option').forEach((group, index) => {
      group.querySelectorAll('input').forEach((input) => {
        const probe = [...chosen];
        probe[index] = input.value;

        const match = this.variants.find((v) =>
          probe.every((value, i) =>
            i === index ? v.options[i] === value : !value || v.options[i] === value
          )
        );
        const usable = Boolean(match && match.available);

        input.toggleAttribute('data-unavailable', !usable);
        const label = this.querySelector('label[for="' + input.id + '"]');
        label?.classList.toggle('variant-picker__value--unavailable', !usable);
      });

      const selected = group.querySelector('input:checked');
      const readout = group.querySelector('[data-selected-for]');
      if (readout && selected) readout.textContent = selected.value;
    });
  }

  async onChange() {
    this.markAvailability();

    const variant = this.variant;
    const root = this.closest('.section') ?? document;

    const idField = root.querySelector('[data-variant-id]');
    const button = root.querySelector('[data-add-button]');
    const label = root.querySelector('[data-add-label]');

    if (idField) {
      idField.value = variant?.id ?? '';
      idField.toggleAttribute('disabled', !variant?.available);
    }

    if (button && label) {
      const usable = Boolean(variant && variant.available);
      button.toggleAttribute('disabled', !usable);
      label.textContent = usable
        ? button.dataset.labelAdd
        : variant
          ? button.dataset.labelSoldOut
          : button.dataset.labelUnavailable;
    }

    if (!variant) return;

    // Quick view fetches this same buy box into a drawer over a collection
    // or homepage URL. Rewriting THAT page's address with a product variant
    // query string would break its back button — so only a quick view skips
    // the URL sync a section actually on the page still wants.
    const inQuickView = root.hasAttribute('data-quick-view');

    if (!inQuickView) {
      // Keep the URL shareable and the back button honest.
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(variant.id));
      window.history.replaceState({}, '', url.toString());
    }

    // Two gallery shapes exist in the theme: main-product.liquid's full
    // stacked grid (<product-gallery>, every image already in the DOM —
    // sync scrolls the right one into view) and the single-media slot
    // quick-view.liquid and featured-product.liquid both use
    // (`[data-media-target]` — sync swaps its one image directly, since
    // there's nothing to scroll within).
    const gallery = root.querySelector('product-gallery');
    const mediaTarget = root.querySelector('[data-media-target]');

    if (gallery && variant.featured_image?.id) {
      gallery.show(variant.featured_image.id);
    } else if (mediaTarget && variant.featured_image?.src) {
      const src = variant.featured_image.src;
      const image = mediaTarget.querySelector('img');
      if (image) {
        image.src = src;
        image.srcset = '';
      } else {
        // The slot opened on a video/3D model (no <img> to update in place)
        // — a variant with its own image still needs to show, so the rich
        // media is replaced rather than left stuck on screen.
        mediaTarget.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'image-fallback__img';
        img.src = src;
        img.alt = variant.featured_image.alt ?? '';
        mediaTarget.appendChild(img);
      }
    }

    document.dispatchEvent(
      new CustomEvent('variant:change', { detail: { variant }, bubbles: true })
    );

    await this.refreshRegions(variant.id, root);
  }

  /**
   * Swap the server-rendered price and low-stock regions.
   * @param {number} variantId
   * @param {Element|Document} root
   */
  async refreshRegions(variantId, root) {
    if (!this.productUrl || !this.section) return;

    // A fast clicker can outrun the network. Abort the in-flight request so a
    // stale response cannot land after a newer one and show the wrong price.
    this.controller?.abort();
    this.controller = new AbortController();

    try {
      const url = this.productUrl + '?variant=' + variantId + '&section_id=' + this.section;
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');

      ['[data-price-target]', '[data-low-stock]'].forEach((selector) => {
        const next = parsed.querySelector(selector);
        const current = root.querySelector(selector);
        if (next && current) current.innerHTML = next.innerHTML;
      });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('[Loam] Variant details could not be refreshed:', error);
    }
  }
}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPicker);
}

/* --------------------------------------------------------------------------
   <gift-card-recipient-form>
   The recipient fields render open and enabled in the raw HTML, so a no-JS
   shopper can just fill them in — the checkbox itself IS the
   `properties[__shopify_send_gift_card_to_recipient]` field, and an
   unchecked checkbox is simply absent from form data. This element only
   adds the nicer, JS-only behaviour: collapse the fields until the box is
   checked, and only require the recipient email once they're in play.
   -------------------------------------------------------------------------- */

class GiftCardRecipientForm extends HTMLElement {
  connectedCallback() {
    this.checkbox = this.querySelector('[data-recipient-toggle]');
    this.fields = this.querySelector('[data-recipient-fields]');
    this.email = this.querySelector('[data-recipient-email]');

    this.onChange = this.onChange.bind(this);
    this.checkbox?.addEventListener('change', this.onChange);
    this.sync();
  }

  disconnectedCallback() {
    this.checkbox?.removeEventListener('change', this.onChange);
  }

  onChange() {
    this.sync();
  }

  sync() {
    const on = !!this.checkbox?.checked;
    this.fields?.toggleAttribute('hidden', !on);
    if (this.email) this.email.required = on;
  }
}

if (!customElements.get('gift-card-recipient-form')) {
  customElements.define('gift-card-recipient-form', GiftCardRecipientForm);
}

/* --------------------------------------------------------------------------
   <sticky-atc>
   Revealed only once the real Add to Cart has left the viewport (§9.7). It
   forwards to that button rather than owning a second form.
   -------------------------------------------------------------------------- */

class StickyAtc extends HTMLElement {
  connectedCallback() {
    this.buyBlock = document.querySelector('[data-buy-block]');
    this.button = this.querySelector('[data-sticky-add]');

    this.onClick = this.onClick.bind(this);
    this.button?.addEventListener('click', this.onClick);

    this.onVariantChange = this.onVariantChange.bind(this);
    document.addEventListener('variant:change', this.onVariantChange);

    if (!this.buyBlock) return;

    this.observer = new IntersectionObserver(
      ([entry]) => this.toggleAttribute('hidden', entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' }
    );
    this.observer.observe(this.buyBlock);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.button?.removeEventListener('click', this.onClick);
    document.removeEventListener('variant:change', this.onVariantChange);
  }

  onClick() {
    // Forwarding keeps one form, one variant id, one source of truth for
    // availability. A second form here is how the wrong variant gets added.
    this.buyBlock?.querySelector('[data-add-button]')?.click();
  }

  /** @param {CustomEvent} event */
  onVariantChange(event) {
    const variant = event.detail?.variant;
    if (!variant) return;

    const name = this.querySelector('[data-sticky-variant]');
    if (name) name.textContent = variant.title;

    const label = this.querySelector('[data-sticky-label]');
    const source = this.buyBlock?.querySelector('[data-add-label]');
    if (label && source) label.textContent = source.textContent;

    this.button?.toggleAttribute('disabled', !variant.available);
  }
}

if (!customElements.get('sticky-atc')) {
  customElements.define('sticky-atc', StickyAtc);
}

/* --------------------------------------------------------------------------
   <pickup-availability>
   store_availabilities belongs to the variant, not the product, so this
   fetches its own tiny section — once on load for the starting variant,
   again on every variant:change — rather than trying to pre-render every
   variant's pickup state into the initial page. Same reasoning
   sticky-atc listens for variant:change rather than owning a second
   source of truth: one event, several elements react to it independently.
   -------------------------------------------------------------------------- */

class PickupAvailability extends HTMLElement {
  connectedCallback() {
    this.rootUrl = this.dataset.rootUrl || '';

    this.onVariantChange = this.onVariantChange.bind(this);
    document.addEventListener('variant:change', this.onVariantChange);

    this.load(this.dataset.variantId);
  }

  disconnectedCallback() {
    document.removeEventListener('variant:change', this.onVariantChange);
    this.controller?.abort();
  }

  /** @param {CustomEvent} event */
  onVariantChange(event) {
    const variant = event.detail?.variant;
    if (variant?.id) this.load(variant.id);
  }

  /** @param {string|number} variantId */
  async load(variantId) {
    if (!this.rootUrl || !variantId) return;

    this.controller?.abort();
    this.controller = new AbortController();

    try {
      const url = `${this.rootUrl}variants/${variantId}/?section_id=pickup-availability`;
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = parsed.querySelector('[data-pickup-availability]');
      // Nothing announced on either branch: this row is not a promise the
      // shopper is owed an update about, only a fact that may or may not
      // apply to what they have selected.
      this.innerHTML = next ? next.innerHTML : '';
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('[Loam] Pickup availability could not be loaded:', error);
      this.innerHTML = '';
    }
  }
}

if (!customElements.get('pickup-availability')) {
  customElements.define('pickup-availability', PickupAvailability);
}

/* --------------------------------------------------------------------------
   <quick-view-trigger>
   Fetches `sections/quick-view.liquid` for one product into the shared
   `#quick-view-drawer` shell. The drawer opens immediately on click — a
   product card has nothing worth dimming yet on a first open, so there is
   no content to protect from a second click the way the cart guards
   itself — and the fetched markup replaces the empty body once it lands.
   -------------------------------------------------------------------------- */

class QuickViewTrigger extends HTMLElement {
  connectedCallback() {
    this.url = this.dataset.url || '';
    this.errorMessage = this.dataset.errorMessage || '';
    this.button = this.querySelector('button');

    this.onClick = this.onClick.bind(this);
    this.button?.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.onClick);
    this.controller?.abort();
  }

  async onClick() {
    const drawer = document.getElementById('quick-view-drawer');
    const body = drawer?.querySelector('[data-quick-view-body]');
    if (!this.url || !drawer || !body || typeof drawer.show !== 'function') return;

    drawer.opener = this.button;
    drawer.show();
    body.setAttribute('aria-busy', 'true');

    // A shopper who quick-views a second product before the first response
    // lands must not see the first product's buy box flash in afterward.
    this.controller?.abort();
    this.controller = new AbortController();

    try {
      // Not string concatenation: `this.url` is `product.url`, and a product
      // reached through `recommendations.products` (related-products,
      // complementary-products — both live only on the PDP) already carries
      // Shopify's own recommendation-tracking query string
      // (`?pr_prod_strat=...&pr_seq=uniform`). `url + '?section_id=quick-view'`
      // on that kind of URL produces a second `?`, which the request line
      // treats as part of the LAST real parameter's value rather than a new
      // one — so `section_id` never actually reaches Shopify, the fetch
      // silently returns the full product page instead of the quick-view
      // section, that page has no `[data-quick-view]` anywhere in it, and
      // the drawer opens to a permanently empty body. `URL` + `searchParams`
      // handles both "no query string yet" and "already has one" the same
      // way, which string-building cannot.
      const url = new URL(this.url, window.location.origin);
      url.searchParams.set('section_id', 'quick-view');

      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const content = parsed.querySelector('[data-quick-view]');
      if (!content) throw new Error('Quick view content missing from response');

      body.replaceChildren(content);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('[Loam] Quick view could not be loaded:', error);
      body.replaceChildren();
      announce(this.errorMessage);
    } finally {
      body.removeAttribute('aria-busy');
    }
  }
}

if (!customElements.get('quick-view-trigger')) {
  customElements.define('quick-view-trigger', QuickViewTrigger);
}

/* The sticky bar mirrors the price region, which is swapped in after the
   variant request resolves — so it listens for the same signal the picker
   uses rather than trying to time it. */
document.addEventListener('variant:change', () => {
  window.requestAnimationFrame(() => {
    const live = document.querySelector('[data-price-target]');
    const mirror = document.querySelector('[data-sticky-price]');
    if (live && mirror) mirror.innerHTML = live.innerHTML;
  });
});

/* --------------------------------------------------------------------------
   <share-button>
   Native share sheet where the browser has one, clipboard copy where it does
   not. The markup starts as a plain link, so with no JavaScript it is still a
   usable link to the page rather than a button that does nothing.
   -------------------------------------------------------------------------- */

class ShareButton extends HTMLElement {
  connectedCallback() {
    this.link = this.querySelector('.share__link');
    this.label = this.querySelector('[data-share-label]');
    if (!this.link) return;

    this.original = this.label?.textContent ?? '';
    this.onClick = this.onClick.bind(this);
    this.link.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.link?.removeEventListener('click', this.onClick);
    window.clearTimeout(this.resetTimer);
  }

  /** @param {MouseEvent} event */
  async onClick(event) {
    const url = this.dataset.url;
    if (!url) return;

    if (navigator.share) {
      event.preventDefault();
      try {
        await navigator.share({ title: this.dataset.title || document.title, url });
      } catch {
        // The shopper dismissed the sheet. Not an error, not worth reporting.
      }
      return;
    }

    // No clipboard API: let the click fall through to the plain link.
    if (!navigator.clipboard) return;
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(url);
      this.flash(this.dataset.copied || '');
    } catch (error) {
      console.warn('[Loam] Copy failed:', error);
    }
  }

  /** @param {string} message */
  flash(message) {
    if (!this.label || !message) return;
    this.label.textContent = message;
    announce(message);
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      if (this.label) this.label.textContent = this.original;
    }, 2400);
  }
}

if (!customElements.get('share-button')) {
  customElements.define('share-button', ShareButton);
}

/* ==========================================================================
   COLLECTION
   ========================================================================== */

/* --------------------------------------------------------------------------
   <facet-filters>
   Progressive enhancement over a real GET form. Without this class the form
   submits, the page reloads, and filtering still works — Shopify's faceted
   URLs do the work either way. With it, the results are fetched through the
   Section Rendering API and swapped in place, which is what keeps the
   shopper's scroll position instead of throwing them back to the top of the
   collection on every refinement (§9.5, §9.6).

   The query string is always built with FormData from the live form, never
   assembled by hand. Hand-built filter URLs are where the other applied
   filters and the chosen sort quietly get dropped.
   -------------------------------------------------------------------------- */

class FacetFilters extends HTMLElement {
  connectedCallback() {
    this.section = this.dataset.section || '';
    this.resultsSelector = this.dataset.results || '[data-collection-results]';
    this.form = this.querySelector('[data-facet-form]');

    this.onChange = this.onChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onPopState = this.onPopState.bind(this);
    this.onDocumentClick = this.onDocumentClick.bind(this);

    this.addEventListener('change', this.onChange);
    this.addEventListener('click', this.onClick);
    this.form?.addEventListener('submit', this.onSubmit);
    window.addEventListener('popstate', this.onPopState);
    // <details name="..."> already closes one filter group when a different
    // one opens — this only has to handle the case native exclusivity does
    // not: a click that lands outside every group (the product grid, a
    // chip, blank page), which should close whatever is open the same way
    // a native <select>'s dropdown does.
    document.addEventListener('click', this.onDocumentClick);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.onChange);
    this.removeEventListener('click', this.onClick);
    this.form?.removeEventListener('submit', this.onSubmit);
    window.removeEventListener('popstate', this.onPopState);
    document.removeEventListener('click', this.onDocumentClick);
    this.controller?.abort();
    window.clearTimeout(this.priceDebounce);
  }

  /** @returns {string} the query string for the current form state */
  get query() {
    if (!this.form) return '';
    const data = new FormData(this.form);

    // Empty price inputs must not become `filter.v.price.gte=`, which Shopify
    // reads as a real bound and which then filters everything out.
    for (const [key, value] of [...data.entries()]) {
      if (typeof value === 'string' && value.trim() === '') data.delete(key);
    }

    return new URLSearchParams(data).toString();
  }

  /** @param {Event} event */
  onChange(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('[data-facet-form]')) return;

    // Typing in a price field fires on every keystroke; wait for a pause.
    // Left open on change — closing mid-typing on the first keystroke would
    // fight the shopper still entering the second bound.
    if (target.matches('.facet-price__input')) {
      window.clearTimeout(this.priceDebounce);
      this.priceDebounce = window.setTimeout(() => this.apply(this.query), 500);
      return;
    }

    this.apply(this.query);
    // A checkbox choosing a value is the one-shot case a <select> models:
    // pick, and the dropdown closes. Reopening for a second checkbox is one
    // click away, same as reopening a <select> is. Focus moves back to the
    // trigger rather than being left on the checkbox this just hid — a
    // <details> that closes does not blur what was focused inside it, so
    // without this a keyboard/screen-reader user's focus would silently
    // land on a control that no longer renders.
    const group = target.closest('details.facets__group');
    if (group) {
      group.removeAttribute('open');
      group.querySelector('summary')?.focus();
    }
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const link = event.target instanceof Element && event.target.closest('[data-facet-link]');
    if (!link) return;

    // Chips and "clear all" are real links to a Shopify-built URL. Intercept
    // them so removing a filter behaves like applying one.
    event.preventDefault();
    const url = new URL(link.href, window.location.origin);
    this.apply(url.searchParams.toString());
  }

  /** Closes any open filter group when a click lands outside every one. */
  onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    this.querySelectorAll('details.facets__group[open]').forEach((group) => {
      if (!group.contains(target)) group.removeAttribute('open');
    });
  }

  /** @param {SubmitEvent} event */
  onSubmit(event) {
    event.preventDefault();
    this.apply(this.query);
  }

  /* Back and forward have to re-render, or the URL and the grid disagree. */
  onPopState() {
    this.apply(window.location.search.replace(/^\?/, ''), { push: false });
  }

  /**
   * @param {string} query
   * @param {{push?: boolean}} [options]
   */
  async apply(query, options = {}) {
    const push = options.push !== false;
    if (!this.section) return;

    this.controller?.abort();
    this.controller = new AbortController();
    this.setBusy(true);

    try {
      const url = `${window.location.pathname}?${query}`;
      const response = await fetch(`${url}${query ? '&' : ''}section_id=${this.section}`, {
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      this.swap(parsed);

      if (push) window.history.pushState({ query }, '', url);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('[Loam] Filters could not be applied:', error);
      announce(this.dataset.errorMessage || '');
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * Replace the results, the chips and the counts — but NOT the whole form.
   * Replacing the form would destroy the element the shopper is interacting
   * with, losing focus and, on a select, closing the dropdown mid-choice.
   * @param {Document} parsed
   */
  swap(parsed) {
    const nextResults = parsed.querySelector(this.resultsSelector);
    const currentResults = this.querySelector(this.resultsSelector);
    if (nextResults && currentResults) currentResults.innerHTML = nextResults.innerHTML;

    ['[data-result-count]', '.facets__active'].forEach((selector) => {
      const next = parsed.querySelector(selector);
      const current = this.querySelector(selector);
      if (next && current) current.innerHTML = next.innerHTML;
      else if (next && !current) this.querySelector('.facets__bar')?.after(next.cloneNode(true));
      else if (!next && current) current.remove();
    });

    // Counts and disabled states change as the result set narrows, so each
    // group's contents are refreshed — but only for groups the shopper is not
    // currently inside, so an open dropdown does not collapse under them.
    parsed.querySelectorAll('[data-facet-group]').forEach((nextGroup, index) => {
      const currentGroup = this.querySelectorAll('[data-facet-group]')[index];
      if (!currentGroup || currentGroup.contains(document.activeElement)) return;
      const nextPanel = nextGroup.querySelector('.facets__panel');
      const currentPanel = currentGroup.querySelector('.facets__panel');
      if (nextPanel && currentPanel) currentPanel.innerHTML = nextPanel.innerHTML;
    });

    const count = this.querySelector('[data-result-count]');
    if (count) announce(count.textContent.trim());
  }

  /** @param {boolean} busy */
  setBusy(busy) {
    this.querySelector(this.resultsSelector)?.toggleAttribute('aria-busy', busy);
  }
}

if (!customElements.get('facet-filters')) {
  customElements.define('facet-filters', FacetFilters);
}


/* ==========================================================================
   SEARCH
   ========================================================================== */

/* --------------------------------------------------------------------------
   <predictive-search>
   Progressive enhancement over the header's plain GET search form, same
   relationship <facet-filters> has to collection filtering: without this
   class the form still submits to routes.search_url and main-search.liquid
   still answers it (§4's "search works with JavaScript unavailable"
   promise), so a fetch failure here degrades to nothing worse than "no
   dropdown yet" rather than a broken search.

   Fetches predictive-search.liquid through the Section Rendering API on a
   debounced keystroke rather than Shopify's raw /search/suggest.json, for
   the same reason cart and facet updates go through Section Rendering
   elsewhere in this file (§4): the result markup — price formatting,
   image-fallback, material tags if they ever get added here — comes from
   the theme's own Liquid, not reconstructed from JSON in JS.
   -------------------------------------------------------------------------- */

class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-predictive-search-results]');
    this.enabled = this.dataset.enabled === 'true';
    if (!this.input || !this.results || !this.enabled) return;

    this.onInput = this.onInput.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.input.addEventListener('input', this.onInput);
    this.addEventListener('focusout', this.onFocusOut);
  }

  disconnectedCallback() {
    this.input?.removeEventListener('input', this.onInput);
    this.removeEventListener('focusout', this.onFocusOut);
    window.clearTimeout(this.debounce);
    this.controller?.abort();
  }

  onInput() {
    window.clearTimeout(this.debounce);
    const query = this.input.value.trim();

    if (query.length < 2) {
      this.controller?.abort();
      this.close();
      return;
    }

    this.debounce = window.setTimeout(() => this.search(query), 300);
  }

  /** A click or tab that leaves the whole element closes the dropdown. */
  onFocusOut() {
    window.requestAnimationFrame(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  close() {
    this.results.hidden = true;
    this.results.replaceChildren();
  }

  /** @param {string} query */
  async search(query) {
    this.controller?.abort();
    this.controller = new AbortController();
    this.results.setAttribute('aria-busy', 'true');

    try {
      const url = new URL(this.dataset.url, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('resources[type]', 'product,collection,page,article');
      url.searchParams.set('resources[limit]', '4');
      url.searchParams.set('resources[limit_scope]', 'each');
      url.searchParams.set('resources[options][unavailable_products]', 'last');
      url.searchParams.set('section_id', 'predictive-search');

      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = parsed.querySelector('[data-predictive-search-results]');
      if (!next) throw new Error('Predictive search content missing from response');

      // The query can outrun the response (a fast typist, a slow request),
      // so the query that started this request is checked against the
      // input's current value before the swap — an AbortController only
      // guards against an in-flight request being superseded, not a
      // stale-but-already-finished one that lost the race after resolving.
      if (this.input.value.trim() !== query) return;

      this.results.replaceChildren(...next.childNodes);
      this.results.hidden = false;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('[Loam] Predictive search failed:', error);
      this.close();
    } finally {
      this.results.removeAttribute('aria-busy');
    }
  }
}

if (!customElements.get('predictive-search')) {
  customElements.define('predictive-search', PredictiveSearch);
}

/* ==========================================================================
   FORM CONTROLS
   ========================================================================== */

/* --------------------------------------------------------------------------
   <theme-select>
   Progressive enhancement over a real <select> — same relationship every
   other enhanced control in this file has to its plain-HTML fallback. The
   select inside keeps working (value, form submission, the no-JS case)
   whether or not this runs; what this adds is the one thing CSS genuinely
   cannot reach. `.select`/`.select-wrap` (base.css) already restyle the
   *closed* control with `appearance: none` and a chevron, but the popup a
   browser paints for an *open* native select is OS chrome — no stylesheet
   touches it, in any browser.

   Follows the WAI-ARIA "select-only combobox" pattern: focus never leaves
   the trigger button, the listbox is a plain (non-focusable) popup, and the
   currently-highlighted option is communicated with aria-activedescendant
   rather than by moving focus into the list. Choosing an option sets the
   real select's value and dispatches a real `change` event on it, so every
   existing listener — <facet-filters>' sort handler, the localization
   form's submit-on-change — keeps working unchanged; neither had to know
   this exists.
   -------------------------------------------------------------------------- */

class ThemeSelect extends HTMLElement {
  connectedCallback() {
    if (this.trigger) return; // already built — a stray reconnect, not a fresh mount

    this.select = this.querySelector('select');
    if (!this.select) return;

    this.onTriggerClick = this.onTriggerClick.bind(this);
    this.onTriggerKeydown = this.onTriggerKeydown.bind(this);
    this.onOptionClick = this.onOptionClick.bind(this);
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.onSelectChange = this.onSelectChange.bind(this);

    this.build();

    this.select.addEventListener('change', this.onSelectChange);
    document.addEventListener('click', this.onDocumentClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocumentClick);
  }

  build() {
    const select = this.select;
    const wrap = this.querySelector('.select-wrap');
    const labelText = (document.querySelector(`label[for="${select.id}"]`)?.textContent || '').trim();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'theme-select__trigger select';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (labelText) trigger.setAttribute('aria-label', labelText);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'theme-select__label';
    trigger.appendChild(labelSpan);

    // Reuse the same chevron the no-JS fallback already renders rather than
    // building a second one — one icon, one place it's drawn (icon.liquid).
    const chevron = wrap?.querySelector('.icon')?.cloneNode(true);
    if (chevron) trigger.appendChild(chevron);

    const listbox = document.createElement('ul');
    listbox.className = 'theme-select__listbox';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;

    const listId = `${select.id || 'theme-select'}-listbox`;
    listbox.id = listId;
    trigger.setAttribute('aria-controls', listId);

    this.optionEls = Array.from(select.options).map((option, index) => {
      const li = document.createElement('li');
      li.className = 'theme-select__option';
      li.id = `${listId}-${index}`;
      li.setAttribute('role', 'option');
      li.textContent = option.textContent.trim();
      li.dataset.value = option.value;
      if (option.disabled) li.setAttribute('aria-disabled', 'true');
      listbox.appendChild(li);
      return li;
    });

    this.trigger = trigger;
    this.listbox = listbox;
    this.updateTriggerLabel();

    trigger.addEventListener('click', this.onTriggerClick);
    trigger.addEventListener('keydown', this.onTriggerKeydown);
    listbox.addEventListener('click', this.onOptionClick);

    // The native select's own wrapper (label + select + its static chevron)
    // is the entire control until this line — hiding it, not the select
    // alone, is what keeps the old chevron from doubling up with this one.
    if (wrap) wrap.hidden = true;

    this.append(trigger, listbox);
  }

  updateTriggerLabel() {
    const selected = this.select.options[this.select.selectedIndex];
    const labelEl = this.trigger.querySelector('.theme-select__label');
    if (labelEl) labelEl.textContent = selected ? selected.textContent.trim() : '';

    this.optionEls.forEach((li, index) => {
      li.setAttribute('aria-selected', String(index === this.select.selectedIndex));
    });
  }

  /** The select changed from outside this element — keep the trigger honest. */
  onSelectChange() {
    this.updateTriggerLabel();
  }

  onTriggerClick() {
    if (this.listbox.hidden) this.open();
    else this.close();
  }

  open() {
    if (!this.listbox.hidden) return;
    this.listbox.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');

    // Flip above the trigger when the panel would otherwise run off the
    // bottom of the viewport and there is more room above than below —
    // the same overflow-avoidance a native <select> gives for free.
    const triggerRect = this.trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const opensUp = spaceBelow < this.listbox.offsetHeight && spaceAbove > spaceBelow;
    this.listbox.classList.toggle('theme-select__listbox--up', opensUp);

    const active = this.optionEls.find((li) => li.getAttribute('aria-selected') === 'true') || this.optionEls[0];
    this.setActive(active);
  }

  close() {
    if (this.listbox.hidden) return;
    this.listbox.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');
  }

  /** @param {HTMLLIElement} [option] */
  setActive(option) {
    this.activeOption?.classList.remove('is-active');
    if (!option) return;
    option.classList.add('is-active');
    option.scrollIntoView({ block: 'nearest' });
    this.trigger.setAttribute('aria-activedescendant', option.id);
    this.activeOption = option;
  }

  /** @param {HTMLLIElement} option */
  choose(option) {
    if (this.select.value !== option.dataset.value) {
      this.select.value = option.dataset.value;
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.updateTriggerLabel();
    this.close();
    this.trigger.focus();
  }

  /** @param {KeyboardEvent} event */
  onTriggerKeydown(event) {
    if (this.listbox.hidden) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
      return;
    }

    const enabled = this.optionEls.filter((li) => li.getAttribute('aria-disabled') !== 'true');
    const currentIndex = enabled.indexOf(this.activeOption);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.setActive(enabled[Math.min(currentIndex + 1, enabled.length - 1)] ?? enabled[0]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.setActive(enabled[Math.max(currentIndex - 1, 0)] ?? enabled[0]);
        break;
      case 'Home':
        event.preventDefault();
        this.setActive(enabled[0]);
        break;
      case 'End':
        event.preventDefault();
        this.setActive(enabled[enabled.length - 1]);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.activeOption) this.choose(this.activeOption);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
      default:
    }
  }

  /** @param {MouseEvent} event */
  onOptionClick(event) {
    const option = event.target instanceof Element ? event.target.closest('.theme-select__option') : null;
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    this.choose(option);
  }

  /** @param {MouseEvent} event */
  onDocumentClick(event) {
    if (event.target instanceof Element && !this.contains(event.target)) this.close();
  }
}

if (!customElements.get('theme-select')) {
  customElements.define('theme-select', ThemeSelect);
}

/* ==========================================================================
   Product discovery
   Two rows that live below the fold on the product page and cost nothing
   until the shopper approaches them.
   ========================================================================== */

/* --------------------------------------------------------------------------
   <lazy-section>
   Fetches its own section back from Shopify and swaps the result in, once the
   element nears the viewport. Used where the server cannot render the content
   on the first pass — the recommendations API needs a product_id and a limit
   in the request, which a normal page load does not carry.

   Deferring to IntersectionObserver rather than fetching on connect is the
   point: these rows sit well below the fold and have no business competing
   with the product image for bandwidth while the LCP is still resolving.

   A failure leaves the element exactly as it was — empty — so a row that
   cannot load is a row that is not there, never a heading over blank space.
   -------------------------------------------------------------------------- */

class LazySection extends HTMLElement {
  connectedCallback() {
    const url = this.dataset.url;
    if (!url || this.dataset.loaded === 'true') return;

    // No IntersectionObserver (or the element is already on screen in a
    // browser that lacks it): load straight away rather than never.
    if (!('IntersectionObserver' in window)) {
      this.load(url);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.observer?.disconnect();
        this.load(url);
      },
      { rootMargin: '400px 0px' }
    );

    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  /** @param {string} url */
  async load(url) {
    this.dataset.loaded = 'true';

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(response.statusText);

      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = parsed.querySelector(this.tagName.toLowerCase());
      if (next) this.innerHTML = next.innerHTML;
    } catch (error) {
      // Nothing is announced. This row was never promised to the shopper, so
      // its absence is not a failure they need to hear about.
      console.warn(`[Loam] ${this.dataset.name || 'section'} could not load:`, error);
    }
  }
}

if (!customElements.get('lazy-section')) {
  customElements.define('lazy-section', LazySection);
}

/* --------------------------------------------------------------------------
   Recently viewed
   The ids live in this browser and nowhere else. Every read and write is
   wrapped: localStorage throws outright in some private-browsing modes and
   under a blocked-cookies setting, and a shopper with storage disabled must
   still get a working product page.
   -------------------------------------------------------------------------- */

const RECENTLY_VIEWED_KEY = 'loam:recently-viewed';
const RECENTLY_VIEWED_MAX = 12;

/** @returns {string[]} */
function readRecentlyViewed() {
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** @param {string} id */
function recordRecentlyViewed(id) {
  if (!id) return;
  try {
    // Newest first, no duplicates, capped — otherwise the list grows without
    // bound and the id: query eventually outgrows the search route.
    const next = [id, ...readRecentlyViewed().filter((seen) => seen !== id)];
    window.localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(next.slice(0, RECENTLY_VIEWED_MAX))
    );
  } catch {
    // Storage unavailable. The row simply never populates.
  }
}

const viewedProduct = document.querySelector('[data-recently-viewed-id]');
if (viewedProduct instanceof HTMLElement) {
  recordRecentlyViewed(viewedProduct.dataset.recentlyViewedId || '');
}

/* --------------------------------------------------------------------------
   <recently-viewed>
   A <lazy-section> that builds its own URL first. The current product is
   dropped before the query is built rather than after it is rendered: asking
   for it and then hiding it wastes a result slot, so a shopper who has seen
   four products would only ever be shown three.
   -------------------------------------------------------------------------- */

class RecentlyViewed extends LazySection {
  connectedCallback() {
    const base = this.dataset.url;
    if (!base) return;

    const currentId = this.dataset.currentId || '';
    const limit = Number(this.dataset.limit) || 4;

    const ids = readRecentlyViewed()
      .filter((id) => id !== currentId)
      .slice(0, limit);

    // Nothing seen yet: the section stays empty and renders nothing (§9.4).
    if (ids.length === 0) return;

    const query = ids.map((id) => `id:${id}`).join(' OR ');
    this.dataset.url = `${base}&q=${encodeURIComponent(query)}`;

    super.connectedCallback();
  }
}

if (!customElements.get('recently-viewed')) {
  customElements.define('recently-viewed', RecentlyViewed);
}


/* ==========================================================================
   Customer accounts
   ========================================================================== */

/* --------------------------------------------------------------------------
   <country-selector>
   Fills the province select from the country select, using the provinces
   Shopify already put in a data attribute on each country <option>. No
   request, no list of countries in the theme, and nothing to fall out of date
   when a country changes its subdivisions.

   The province field is hidden when the selected country has none — an empty
   select labelled "Province" is a field the shopper cannot satisfy and cannot
   skip. It is hidden with the `hidden` attribute rather than a class, so it
   leaves the accessibility tree too and its now-empty select is not
   focusable.

   With the module unavailable the country select still submits and the
   province select submits empty, which is what Shopify expects for a country
   with no provinces and what the customer can correct on the next screen for
   one that has them.
   -------------------------------------------------------------------------- */

class CountrySelector extends HTMLElement {
  connectedCallback() {
    this.country = this.querySelector('[data-country-select]');
    this.province = this.querySelector('[data-province-select]');
    this.container = document.getElementById(this.dataset.provinceContainer || '');

    if (!this.country || !this.province) return;

    // Shopify's country_option_tags cannot mark an option selected, so the
    // saved value arrives on data-default and is applied here.
    const current = this.country.dataset.default;
    if (current) this.country.value = current;

    this.onChange = this.onChange.bind(this);
    this.country.addEventListener('change', this.onChange);
    this.render();
  }

  disconnectedCallback() {
    this.country?.removeEventListener('change', this.onChange);
  }

  onChange() {
    // A different country invalidates whatever province was saved, so the
    // remembered value is dropped rather than silently re-applied to a list
    // it does not belong to.
    if (this.province) this.province.dataset.default = '';
    this.render();
  }

  render() {
    const option = this.country?.selectedOptions?.[0];
    if (!option || !this.province) return;

    let provinces = [];
    try {
      provinces = JSON.parse(option.dataset.provinces || '[]');
    } catch {
      provinces = [];
    }

    this.province.innerHTML = '';

    if (!Array.isArray(provinces) || provinces.length === 0) {
      this.province.disabled = true;
      this.container?.setAttribute('hidden', '');
      return;
    }

    provinces.forEach(([value, label]) => {
      const node = document.createElement('option');
      node.value = value;
      node.textContent = label;
      this.province.appendChild(node);
    });

    this.province.disabled = false;
    this.container?.removeAttribute('hidden');

    const saved = this.province.dataset.default;
    if (saved) this.province.value = saved;
  }
}

if (!customElements.get('country-selector')) {
  customElements.define('country-selector', CountrySelector);
}

/* --------------------------------------------------------------------------
   Confirm before a destructive submit.
   Delegated, because address rows are re-rendered on every save. The confirm
   is the browser's own: a themed modal here would need focus management and
   a keyboard trap for a single yes/no, and would fail closed if the module
   had not loaded — leaving a delete button that deletes with no confirmation
   at all. With no JavaScript the form still posts, which is the same
   behaviour Shopify's own account pages have.
   -------------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest('[data-confirm]');
  if (!trigger) return;

  const message = trigger.getAttribute('data-confirm');
  if (message && !window.confirm(message)) event.preventDefault();
});


/* ==========================================================================
   Compare
   Client-side only, like recently-viewed above: comparison is not the cart
   and the server never needs it back, so localStorage is the right tool
   rather than a rule §16 is warning against. Every reader and writer goes
   through Compare.*, and every UI piece — every toggle button on the page,
   the tray, the drawer's table — reacts to the same `compare:change` event
   rather than keeping its own copy of the list, so none of them can drift
   out of sync with what is actually stored.
   ========================================================================== */

const COMPARE_KEY = 'loam:compare';
const COMPARE_MAX = 3;

const Compare = {
  /** @returns {Array<object>} */
  read() {
    try {
      const raw = window.localStorage.getItem(COMPARE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  /** @param {Array<object>} list */
  write(list) {
    try {
      window.localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
    } catch {
      // Private browsing or storage disabled: compare simply does not
      // persist, but toggling still dispatches below so the UI stays honest
      // about what is selected for the rest of this page view.
    }
    document.dispatchEvent(new CustomEvent('compare:change', { detail: { list } }));
  },

  /** @param {string} handle */
  has(handle) {
    return this.read().some((item) => item.handle === handle);
  },

  /**
   * @param {object} item
   * @returns {'added'|'removed'|'full'}
   */
  toggle(item) {
    const list = this.read();
    const index = list.findIndex((existing) => existing.handle === item.handle);

    if (index > -1) {
      list.splice(index, 1);
      this.write(list);
      return 'removed';
    }

    if (list.length >= COMPARE_MAX) return 'full';

    list.push(item);
    this.write(list);
    return 'added';
  },

  /** @param {string} handle */
  remove(handle) {
    this.write(this.read().filter((item) => item.handle !== handle));
  },

  clear() {
    this.write([]);
  },
};

/* --------------------------------------------------------------------------
   <compare-toggle>
   The per-card button. Reads its product's data once from its own
   data-compare attribute — captured server-side in card-product.liquid,
   using the merchant's real money format, never re-implemented here — and
   otherwise only ever talks to Compare.
   -------------------------------------------------------------------------- */

class CompareToggle extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.item = this.readItem();

    this.onClick = this.onClick.bind(this);
    this.onCompareChange = this.onCompareChange.bind(this);

    this.button?.addEventListener('click', this.onClick);
    document.addEventListener('compare:change', this.onCompareChange);

    this.sync();
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.onClick);
    document.removeEventListener('compare:change', this.onCompareChange);
  }

  /** @returns {object} */
  readItem() {
    try {
      return JSON.parse(this.dataset.compare || '{}');
    } catch {
      return {};
    }
  }

  onClick() {
    if (!this.item?.handle) return;
    const result = Compare.toggle(this.item);

    if (result === 'full') {
      const message = this.dataset.fullMessage || '';
      // announce() covers a screen reader; it is a visually-hidden live
      // region by definition, so a sighted shopper needs a real, visible
      // message too — <compare-tray> shows this event's detail for a few
      // seconds. Both fire from one click rather than picking one audience.
      announce(message);
      document.dispatchEvent(new CustomEvent('compare:full', { detail: { message } }));
      return;
    }

    announce((result === 'added' ? this.dataset.addedMessage : this.dataset.removedMessage) || '');
  }

  onCompareChange() {
    this.sync();
  }

  /* Every instance of this product's toggle on the page — the same card
     rendered in a grid and, say, an upsell row — has to agree, which is why
     this reads Compare.has() fresh on every change rather than trusting its
     own last click. */
  sync() {
    if (!this.button || !this.item?.handle) return;
    this.button.setAttribute('aria-pressed', String(Compare.has(this.item.handle)));
  }
}

if (!customElements.get('compare-toggle')) {
  customElements.define('compare-toggle', CompareToggle);
}

/* --------------------------------------------------------------------------
   <compare-tray>
   The persistent bottom bar. Starts `hidden` in the markup so a shopper who
   has never used the feature never sees it flash in; this only removes the
   attribute once there is something in storage to show.
   -------------------------------------------------------------------------- */

class CompareTray extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('[data-compare-list]');
    this.countEl = this.querySelector('[data-compare-count]');
    this.notice = this.querySelector('[data-compare-notice]');
    this.openButton = this.querySelector('[data-drawer-toggle]');

    this.onCompareChange = this.onCompareChange.bind(this);
    this.onCompareFull = this.onCompareFull.bind(this);
    this.onClick = this.onClick.bind(this);

    document.addEventListener('compare:change', this.onCompareChange);
    document.addEventListener('compare:full', this.onCompareFull);
    this.addEventListener('click', this.onClick);

    this.render(Compare.read());
  }

  disconnectedCallback() {
    document.removeEventListener('compare:change', this.onCompareChange);
    document.removeEventListener('compare:full', this.onCompareFull);
    this.removeEventListener('click', this.onClick);
    window.clearTimeout(this.noticeTimer);
  }

  /** @param {CustomEvent} event */
  onCompareChange(event) {
    this.render(event.detail?.list ?? Compare.read());
  }

  /**
   * Show the "up to 3" message where a sighted shopper can actually see it.
   * The tray is guaranteed visible when this fires — hitting the cap is
   * only possible with 3 items already in it.
   * @param {CustomEvent} event
   */
  onCompareFull(event) {
    if (!this.notice) return;
    const message = event.detail?.message;
    if (!message) return;

    this.notice.textContent = message;
    this.notice.hidden = false;

    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (this.notice) this.notice.hidden = true;
    }, 4000);
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const remove = target.closest('[data-compare-remove]');
    if (remove) {
      Compare.remove(remove.getAttribute('data-compare-remove') || '');
      return;
    }

    if (target.closest('[data-compare-clear]')) Compare.clear();
  }

  /** @param {Array<object>} list */
  render(list) {
    this.toggleAttribute('hidden', list.length === 0);
    if (this.countEl) this.countEl.textContent = String(list.length);
    this.openButton?.toggleAttribute('disabled', list.length === 0);

    if (!this.list) return;
    // Built with the DOM API rather than innerHTML: chip text comes from
    // whatever a merchant has named their products, which is trusted
    // catalogue data but not worth an escaping mistake to save a few lines.
    this.list.replaceChildren();

    list.forEach((item) => {
      const chip = document.createElement('li');
      chip.className = 'compare-tray__chip';

      const title = document.createElement('span');
      title.className = 'compare-tray__chip-title';
      title.textContent = item.title || '';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'compare-tray__chip-remove icon-button';
      remove.setAttribute('data-compare-remove', item.handle || '');
      remove.setAttribute('aria-label', `${this.dataset.removeLabel || ''} ${item.title || ''}`.trim());
      remove.textContent = '×';

      chip.append(title, remove);
      this.list.appendChild(chip);
    });
  }
}

if (!customElements.get('compare-tray')) {
  customElements.define('compare-tray', CompareTray);
}

/* --------------------------------------------------------------------------
   <compare-table>
   Lives inside compare-drawer.liquid. Unlike quick view, nothing here is
   fetched: every field the table needs was already captured into JSON on
   each product card when it was added, so this builds straight from
   Compare.read() with the DOM API — no template-string HTML, so there is
   nothing here that needs escaping.
   -------------------------------------------------------------------------- */

class CompareTable extends HTMLElement {
  connectedCallback() {
    this.onCompareChange = this.onCompareChange.bind(this);
    document.addEventListener('compare:change', this.onCompareChange);
    this.render(Compare.read());
  }

  disconnectedCallback() {
    document.removeEventListener('compare:change', this.onCompareChange);
  }

  /** @param {CustomEvent} event */
  onCompareChange(event) {
    this.render(event.detail?.list ?? Compare.read());
  }

  /** @param {Array<object>} list */
  render(list) {
    this.replaceChildren();

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = this.dataset.emptyMessage || '';
      this.appendChild(empty);
      return;
    }

    const rows = [
      'image',
      'title',
      'price',
      'material',
      'available',
      'link',
    ];

    const table = document.createElement('table');
    table.className = 'compare-table';

    rows.forEach((key) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';

      const labels = {
        title: this.dataset.labelProduct,
        price: this.dataset.labelPrice,
        material: this.dataset.labelMaterial,
        available: this.dataset.labelAvailability,
      };
      if (labels[key]) th.textContent = labels[key];
      tr.appendChild(th);

      list.forEach((item) => {
        const td = document.createElement('td');
        td.appendChild(this.cell(key, item));
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    this.appendChild(table);
  }

  /**
   * One table cell's content, as a real node rather than a string.
   * @param {string} key
   * @param {object} item
   * @returns {Node}
   */
  cell(key, item) {
    if (key === 'image') {
      if (!item.image) return document.createDocumentFragment();
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 96;
      img.height = 120;
      return img;
    }

    if (key === 'title' || key === 'link') {
      const a = document.createElement('a');
      a.href = item.url || '#';
      a.className = key === 'link' ? 'button button--secondary button--full' : 'link';
      a.textContent = key === 'link' ? this.dataset.labelView || '' : item.title || '';
      return a;
    }

    const span = document.createElement('span');
    if (key === 'price') span.textContent = item.price || '';
    else if (key === 'material') span.textContent = item.material || '—';
    else if (key === 'available') {
      span.textContent = item.available
        ? this.dataset.labelInStock || ''
        : this.dataset.labelSoldOut || '';
    }
    return span;
  }
}

if (!customElements.get('compare-table')) {
  customElements.define('compare-table', CompareTable);
}
