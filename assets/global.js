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

const CART_SECTIONS = 'cart-drawer,cart-count';

function cartRoute(path) {
  const root = window.Shopify?.routes?.root || '/';
  return root + path;
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
          sections: CART_SECTIONS,
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
   * Only the inner regions are replaced. The <loam-drawer> element itself is
   * left alone: replacing it while open would tear down the focus trap and
   * the scroll lock mid-interaction.
   * @param {Record<string,string>|undefined} sections
   */
  render(sections) {
    if (!sections) return;
    const parser = new DOMParser();

    const drawerHtml = sections['cart-drawer'];
    if (drawerHtml) {
      const parsed = parser.parseFromString(drawerHtml, 'text/html');
      ['[data-cart-body]', '[data-cart-footer]'].forEach((selector) => {
        const next = parsed.querySelector(selector);
        const current = document.querySelector(selector);
        if (next && current) current.innerHTML = next.innerHTML;
      });
    }

    const countHtml = sections['cart-count'];
    if (countHtml) {
      const parsed = parser.parseFromString(countHtml, 'text/html');
      const next = parsed.querySelector('.cart-count');
      if (next) {
        document.querySelectorAll('.cart-count').forEach((node) => {
          node.replaceWith(next.cloneNode(true));
        });
      }
    }
  },

  /**
   * @param {number|string} id variant id
   * @param {number} quantity
   */
  add(id, quantity) {
    return this.post(cartRoute('cart/add.js'), { id, quantity });
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

    // aria-disabled rather than disabled: a disabled button loses focus, and
    // the shopper's place on the page goes with it.
    this.button?.setAttribute('aria-disabled', 'true');
    this.toggleAttribute('aria-busy', true);

    const cart = await Cart.add(id, quantity);

    this.button?.removeAttribute('aria-disabled');
    this.toggleAttribute('aria-busy', false);

    if (!cart) return;

    announce(this.dataset.successMessage || '');

    // Opening the drawer is the confirmation. Only on success, and only when
    // the merchant is running the drawer rather than the cart page.
    document.getElementById('cart-drawer')?.show?.();
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

    const target = this.offsetWidth * 2;
    let guard = 0;
    // Cap the copies: a single very long message can already exceed the
    // target, and an unbounded loop here would hang the page.
    while (this.track.scrollWidth < target && guard < 20) {
      this.originals.forEach((node) => {
        const copy = node.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.dataset.marqueeClone = '';
        copy.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
        this.track.appendChild(copy);
      });
      guard += 1;
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
   Thumbnail switching. Every media item is in the DOM from the start and
   toggled with `hidden`, rather than swapping one <img>'s src — swapping src
   re-downloads on every click and flashes an empty box on a slow connection.
   -------------------------------------------------------------------------- */

class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.onClick = this.onClick.bind(this);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }

  /** @param {string|number} mediaId */
  show(mediaId) {
    const id = String(mediaId);
    let matched = false;

    this.querySelectorAll('[data-media-id]').forEach((item) => {
      const isTarget = item.getAttribute('data-media-id') === id;
      item.toggleAttribute('hidden', !isTarget);
      if (isTarget) matched = true;
    });

    // A variant can point at media that is not in this gallery, or at none at
    // all. Leaving every item hidden would blank the gallery, so fall back to
    // the first item instead of showing nothing.
    if (!matched) {
      this.querySelector('[data-media-id]')?.removeAttribute('hidden');
      return;
    }

    this.querySelectorAll('[data-media-target]').forEach((thumb) => {
      const isTarget = thumb.getAttribute('data-media-target') === id;
      thumb.classList.toggle('is-active', isTarget);
      if (isTarget) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const thumb = event.target instanceof Element && event.target.closest('[data-media-target]');
    if (!thumb) return;
    event.preventDefault();
    this.show(thumb.getAttribute('data-media-target'));
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

    // Keep the URL shareable and the back button honest.
    const url = new URL(window.location.href);
    url.searchParams.set('variant', String(variant.id));
    window.history.replaceState({}, '', url.toString());

    if (variant.featured_media?.id) {
      root.querySelector('product-gallery')?.show(variant.featured_media.id);
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
