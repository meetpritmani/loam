/*
  rpl-product.js — product page enhancements: thumbnail gallery,
  variant-driven price/availability/SKU/media updates, mobile sticky ATC.

  Loaded only from sections/main-product.liquid. Everything here reads
  server-rendered data (the embedded product JSON, and per-variant hidden
  price/label blocks already rendered by Liquid) rather than reconstructing
  money formatting or translated strings in JS — see the comments in
  main-product.liquid for why.

  No-JS baseline this enhances rather than replaces: without this file, every
  product image is already visible (no gallery interaction needed), the
  <select> already posts the right variant id, and the price/availability/SKU
  already reflect the server-selected variant.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  function initProductForm(root) {
    var gallery = root.querySelector('[data-product-gallery]');
    var jsonScript = root.querySelector('[data-product-json]');
    var select = root.querySelector('[data-product-variant-select]');
    if (!jsonScript) return;

    var variants;
    try {
      variants = JSON.parse(jsonScript.textContent);
    } catch (error) {
      return;
    }

    /* ------------------------------------------------------------------
       Gallery — thumbnail-driven, ARIA tablist/tabpanel pattern
       ------------------------------------------------------------------ */

    function setActiveMedia(mediaId, announce) {
      if (!gallery) return;
      var slide = gallery.querySelector('[data-media-id="' + mediaId + '"]');
      if (!slide) return;

      var slides = gallery.querySelectorAll('[data-media-id]');
      Array.prototype.forEach.call(slides, function (el) {
        el.removeAttribute('data-media-active');
      });
      slide.setAttribute('data-media-active', '');

      var tabs = gallery.querySelectorAll('[data-media-target]');
      Array.prototype.forEach.call(tabs, function (tab) {
        var isActive = tab.getAttribute('data-media-target') === String(mediaId);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      if (announce) {
        var index = 1;
        for (var i = 0; i < slides.length; i++) {
          if (slides[i] === slide) {
            index = i + 1;
            break;
          }
        }
        var template = gallery.getAttribute('data-image-available-template');
        if (template) {
          RPL.announce(template.replace('__INDEX__', index));
        }
      }
    }

    if (gallery) {
      var thumbList = gallery.querySelector('[data-product-thumbnails]');
      if (thumbList) {
        thumbList.addEventListener('click', function (event) {
          var tab = event.target.closest('[data-media-target]');
          if (!tab) return;
          setActiveMedia(tab.getAttribute('data-media-target'), true);
          tab.focus();
        });

        thumbList.addEventListener('keydown', function (event) {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          var tabs = Array.prototype.slice.call(thumbList.querySelectorAll('[data-media-target]'));
          var current = event.target.closest('[data-media-target]');
          var index = tabs.indexOf(current);
          if (index === -1) return;
          event.preventDefault();
          var nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
          var next = tabs[nextIndex];
          setActiveMedia(next.getAttribute('data-media-target'), true);
          next.focus();
        });
      }
    }

    /* ------------------------------------------------------------------
       Variant change — price / availability / SKU / media / URL
       ------------------------------------------------------------------ */

    function findVariant(id) {
      for (var i = 0; i < variants.length; i++) {
        if (String(variants[i].id) === String(id)) return variants[i];
      }
      return null;
    }

    function setAvailability(variant) {
      var buttons = root.querySelectorAll('[data-product-submit]');
      Array.prototype.forEach.call(buttons, function (button) {
        var unavailable = button.querySelector('[data-submit-text-unavailable]');
        var available = button.querySelector('[data-submit-text-available]');
        var soldout = button.querySelector('[data-submit-text-soldout]');
        if (!unavailable || !available || !soldout) return;

        if (!variant) {
          unavailable.hidden = false;
          available.hidden = true;
          soldout.hidden = true;
          button.disabled = true;
        } else if (variant.available) {
          unavailable.hidden = true;
          available.hidden = false;
          soldout.hidden = true;
          button.disabled = false;
        } else {
          unavailable.hidden = true;
          available.hidden = true;
          soldout.hidden = false;
          button.disabled = true;
        }
      });
    }

    function setPrice(variant) {
      var priceContainer = root.querySelector('[data-product-price]');
      if (!priceContainer) return;
      var blocks = priceContainer.querySelectorAll('[data-price-variant]');
      var activeBlock = null;
      Array.prototype.forEach.call(blocks, function (block) {
        var key = variant ? String(variant.id) : 'unavailable';
        var match = block.getAttribute('data-price-variant') === key;
        block.hidden = !match;
        if (match) activeBlock = block;
      });

      var stickyPrice = root.querySelector('[data-sticky-atc-price]');
      if (stickyPrice && activeBlock) {
        stickyPrice.innerHTML = activeBlock.innerHTML;
      }
    }

    function setSku(variant) {
      var skuEl = root.querySelector('[data-product-sku]');
      if (!skuEl) return;
      var valueEl = skuEl.querySelector('[data-sku-value]');
      var sku = variant && variant.sku;
      if (valueEl) valueEl.textContent = sku || '';
      skuEl.hidden = !sku;
    }

    function setMedia(variant) {
      if (!variant || !variant.featured_media) return;
      setActiveMedia(variant.featured_media.id, false);
    }

    function setUrl(variant) {
      if (!variant || !window.history || !window.history.replaceState) return;
      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url);
    }

    function onVariantChange() {
      if (!select) return;
      var variant = findVariant(select.value);
      setAvailability(variant);
      setPrice(variant);
      setSku(variant);
      setMedia(variant);
      setUrl(variant);
    }

    if (select) {
      select.addEventListener('change', onVariantChange);
    }

    /* ------------------------------------------------------------------
       Sticky mobile add-to-cart bar
       ------------------------------------------------------------------ */

    var stickyBar = root.querySelector('[data-sticky-atc]');
    var stickySubmit = root.querySelector('[data-sticky-atc-submit]');
    var mainSubmit = root.querySelector('.rpl-product-form [data-product-submit]');

    if (stickyBar && mainSubmit && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            stickyBar.hidden = entry.isIntersecting;
          });
        },
        { rootMargin: '0px 0px -50% 0px' }
      );
      observer.observe(mainSubmit);
    }

    if (stickySubmit) {
      stickySubmit.addEventListener('click', function () {
        var form = mainSubmit ? mainSubmit.closest('form') : null;
        if (form && typeof form.requestSubmit === 'function') {
          form.requestSubmit(mainSubmit);
        } else if (form) {
          form.submit();
        }
      });
    }

    /* Initial price/SKU sync for the sticky bar (main markup already
       reflects the server-selected variant; this only mirrors it there). */
    if (select) onVariantChange();
  }

  function boot(root) {
    var scope = root || document;
    var sections = scope.querySelectorAll('.rpl-section-main-product');
    Array.prototype.forEach.call(sections, function (section) {
      initProductForm(section);
    });
    if (scope.matches && scope.matches('.rpl-section-main-product')) {
      initProductForm(scope);
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
