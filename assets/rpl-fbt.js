/*
  rpl-fbt.js — "frequently bought together": running total + combined
  add-to-cart for sections/frequently-bought-together.liquid.

  formatMoney() below is the one place in this theme that reformats a price
  in JS rather than toggling a Liquid-rendered block (the technique used
  everywhere else — see rpl-product.js and cart-drawer.liquid). That's
  deliberate, not an inconsistency: a running total across several
  independently-selectable items is arithmetic that can only happen after
  the shopper checks boxes and picks variants, so there's no way to
  pre-render it server-side. The cents summed here already come from
  Liquid (`variant.price`), which Shopify resolves in the visitor's
  presentment currency before render — this only sums and formats what the
  server already computed, it doesn't do currency conversion itself.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  function formatMoney(cents, format) {
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var match = placeholderRegex.exec(format);
    var kind = match ? match[1] : 'amount';

    function withDelimiters(number, precision, thousands, decimal) {
      number = (number / 100).toFixed(precision);
      var parts = number.split('.');
      var dollars = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands);
      return parts[1] ? dollars + decimal + parts[1] : dollars;
    }

    var value;
    switch (kind) {
      case 'amount_no_decimals':
        value = withDelimiters(cents, 0, ',', '.');
        break;
      case 'amount_with_comma_separator':
        value = withDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = withDelimiters(cents, 0, '.', ',');
        break;
      default:
        value = withDelimiters(cents, 2, ',', '.');
    }
    return format.replace(placeholderRegex, value);
  }

  function initFbt(root) {
    if (root.hasAttribute('data-rpl-bound')) return;
    root.setAttribute('data-rpl-bound', 'true');

    var moneyFormat = root.getAttribute('data-money-format') || '${{amount}}';
    var addUrl = root.getAttribute('data-cart-add-url');
    var cartUrl = root.getAttribute('data-cart-url');
    var totalEl = root.querySelector('[data-fbt-total]');
    var addAllButton = root.querySelector('[data-fbt-add-all]');
    var errorEl = root.querySelector('[data-fbt-error]');

    function priceForItem(item) {
      var select = item.querySelector('[data-fbt-variant-select]');
      var priceEl = item.querySelector('[data-fbt-price]');
      var cents = select
        ? parseInt(select.selectedOptions[0].getAttribute('data-price'), 10)
        : parseInt(priceEl.getAttribute('data-price'), 10);
      if (priceEl && select) {
        priceEl.setAttribute('data-price', cents);
        priceEl.textContent = formatMoney(cents, moneyFormat);
      }
      return cents || 0;
    }

    function updateTotal() {
      var items = root.querySelectorAll('[data-fbt-item]');
      var total = 0;
      Array.prototype.forEach.call(items, function (item) {
        var checkbox = item.querySelector('[data-fbt-checkbox]');
        var cents = priceForItem(item);
        if (checkbox.checked) total += cents;
      });
      if (totalEl) totalEl.textContent = formatMoney(total, moneyFormat);
    }

    root.addEventListener('change', function (event) {
      if (event.target.closest('[data-fbt-checkbox], [data-fbt-variant-select]')) {
        updateTotal();
      }
    });

    if (addAllButton) {
      addAllButton.addEventListener('click', function () {
        var items = [];
        Array.prototype.forEach.call(root.querySelectorAll('[data-fbt-item]'), function (item) {
          var checkbox = item.querySelector('[data-fbt-checkbox]');
          if (!checkbox.checked) return;
          var idField = item.querySelector('[data-fbt-name="id"]');
          if (!idField || !idField.value) return;
          items.push({ id: parseInt(idField.value, 10), quantity: 1 });
        });
        if (items.length === 0 || !addUrl) return;

        if (errorEl) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }
        addAllButton.disabled = true;

        fetch(addUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: items }),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              var first = result.data.description || (result.data[0] && result.data[0].description);
              throw new Error(first || result.data.message || 'Error');
            }
            if (typeof RPL.refreshCartDrawer === 'function' && document.getElementById('CartDrawer')) {
              return RPL.refreshCartDrawer(addAllButton);
            }
            if (cartUrl) window.location.href = cartUrl;
          })
          .catch(function (error) {
            RPL.announce(error.message, true);
            if (errorEl) {
              errorEl.textContent = error.message;
              errorEl.hidden = false;
            }
          })
          .finally(function () {
            addAllButton.disabled = false;
          });
      });
    }
  }

  function boot(root) {
    var scope = root || document;
    var sections = scope.querySelectorAll('[data-fbt]');
    Array.prototype.forEach.call(sections, initFbt);
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
