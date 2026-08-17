/*
  rpl-cart.js — AJAX add-to-cart and cart drawer.

  Loaded by sections/cart-drawer.liquid, which is rendered on every page, so
  product forms anywhere in the theme can be enhanced by this file.

  Source of truth for the drawer's HTML stays server-side: every mutation
  (add / change quantity / remove) re-fetches the cart-drawer section via the
  Section Rendering API (`?section_id=cart-drawer`) and swaps the whole
  <rpl-drawer> node for the response. Nothing here hand-builds cart markup,
  so JS and Liquid can't drift apart.

  No-JS baseline this enhances rather than replaces: the product form already
  posts to /cart/add and the header cart icon already links to /cart
  (main-cart.liquid). If this file fails to load, both keep working exactly
  as before.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  var JSON_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  function getDrawer() {
    return document.getElementById('CartDrawer');
  }

  function setBusy(drawer, busy) {
    if (!drawer) return;
    if (busy) {
      drawer.setAttribute('aria-busy', 'true');
    } else {
      drawer.removeAttribute('aria-busy');
    }
  }

  /* The header badge is updated from the freshly-fetched drawer's own
     data-item-count, not from whatever shape today's mutation endpoint
     happens to return — /cart/add.js returns a line item, /cart/change.js
     returns the full cart; reading from the re-rendered section instead of
     branching per endpoint keeps this one code path for all three. */
  function updateHeaderCount(itemCount) {
    var bubbles = document.querySelectorAll('.rpl-header__cart-count');
    Array.prototype.forEach.call(bubbles, function (bubble) {
      bubble.textContent = itemCount;
      bubble.hidden = itemCount === 0;
    });
  }

  /* Re-fetches the cart-drawer section and swaps the whole <rpl-drawer> node.
     Because <rpl-drawer> is a registered custom element, the browser
     auto-upgrades the replacement node — no manual re-init needed.

     `openWith` is the element that should regain focus when the drawer is
     later closed (e.g. the "Add to cart" button). When omitted — the
     quantity-change/remove path, where the drawer is already open — the
     drawer's own opener from before the refresh is carried forward instead,
     since that instance state doesn't survive the node being replaced. */
  function refreshDrawer(openWith) {
    var drawer = getDrawer();
    if (!drawer) return Promise.resolve();
    var url = drawer.getAttribute('data-section-url');
    if (!url) return Promise.resolve();
    var wasOpen = drawer.hasAttribute('data-open');
    var previousOpener = drawer.opener;

    return fetch(url, { headers: { Accept: 'text/html' } })
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.getElementById('CartDrawer');
        var current = getDrawer();
        if (!fresh || !current) return;
        current.replaceWith(fresh);

        var itemCount = parseInt(fresh.getAttribute('data-item-count'), 10) || 0;
        updateHeaderCount(itemCount);

        var opener = openWith !== undefined ? openWith : previousOpener;
        if ((openWith !== undefined || wasOpen) && typeof fresh.open === 'function') {
          fresh.open(opener);
        }
      });
  }

  function showError(message) {
    RPL.announce(message, true);
    var status = document.querySelector('[data-cart-drawer-status]');
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
    var formError = document.querySelector('[data-cart-form-error]');
    if (formError) {
      formError.textContent = message;
      formError.hidden = false;
    }
  }

  function clearFormError() {
    var formError = document.querySelector('[data-cart-form-error]');
    if (formError) {
      formError.hidden = true;
      formError.textContent = '';
    }
  }

  /* ------------------------------------------------------------------
     Add to cart — delegated submit listener on every .rpl-product-form
     ------------------------------------------------------------------ */

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('.rpl-product-form');
    if (!form) return;

    /* rpl-cart.js only loads when settings.cart_type is "drawer" (it ships
       from cart-drawer.liquid, which is only rendered in that case). No
       drawer in the DOM means nothing to enhance — leave the native
       full-page POST to /cart/add alone. */
    var drawer = getDrawer();
    if (!drawer) return;

    event.preventDefault();
    clearFormError();

    var submitter = event.submitter || form.querySelector('[type="submit"]');
    if (submitter) submitter.disabled = true;
    setBusy(drawer, true);

    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.description || result.data.message || 'Error');
        }
        return refreshDrawer(submitter).then(function () {
          RPL.announce(result.data.product_title || '');
        });
      })
      .catch(function (error) {
        showError(error.message);
      })
      .finally(function () {
        if (submitter) submitter.disabled = false;
        setBusy(getDrawer(), false);
      });
  });

  /* ------------------------------------------------------------------
     Quantity change / remove — delegated so it survives drawer replacement
     ------------------------------------------------------------------ */

  function changeLine(line, quantity) {
    var drawer = getDrawer();
    if (!drawer) return;
    var url = drawer.getAttribute('data-cart-change-url');
    if (!url) return;

    setBusy(drawer, true);

    fetch(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ line: line, quantity: quantity }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.description || result.data.message || 'Error');
        }
        return refreshDrawer();
      })
      .catch(function (error) {
        showError(error.message);
        setBusy(getDrawer(), false);
      });
  }

  document.addEventListener('click', function (event) {
    var decrease = event.target.closest('[data-quantity-decrease]');
    var increase = event.target.closest('[data-quantity-increase]');
    var remove = event.target.closest('[data-line-remove]');
    var control = decrease || increase || remove;
    if (!control) return;

    var container = control.closest('.rpl-cart-drawer-item');
    var input = container && container.querySelector('[data-quantity-input]');
    var current = input ? parseInt(input.value, 10) || 0 : 0;
    var line = parseInt(control.getAttribute('data-line'), 10);
    var next = current;

    if (remove) next = 0;
    if (decrease) next = Math.max(0, current - 1);
    if (increase) next = current + 1;

    changeLine(line, next);
  });

  document.addEventListener('change', function (event) {
    var input = event.target.closest('[data-quantity-input]');
    if (!input) return;
    var line = parseInt(input.getAttribute('data-line'), 10);
    var quantity = Math.max(0, parseInt(input.value, 10) || 0);
    changeLine(line, quantity);
  });

  /* ------------------------------------------------------------------
     Cart note — debounced update on the drawer's note field
     ------------------------------------------------------------------ */

  var updateNote = RPL.debounce(function (note) {
    var drawer = getDrawer();
    if (!drawer) return;
    var url = drawer.getAttribute('data-cart-update-url');
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ note: note }),
    });
  }, 500);

  document.addEventListener('input', function (event) {
    var note = event.target.closest('[data-cart-note]');
    if (!note) return;
    updateNote(note.value);
  });
})();
