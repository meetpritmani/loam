/*
  rpl-recently-viewed.js — two jobs:
  1. On a product page, record the view in localStorage (handle + timestamp,
     capped at 12, 30-day expiry).
  2. Wherever a [data-recently-viewed] grid exists, read that list and fetch
     each product's card individually via sections/product-card-fetch.liquid's
     stable ?section_id=product-card-fetch endpoint — the server has no idea
     what a given visitor viewed, so this can only be assembled client-side.

  Loaded from sections/recently-viewed.liquid, which is the only place this
  is needed — if that section isn't on the page, nothing here runs.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  var STORAGE_KEY = 'rpl:recently-viewed';
  var MAX_ITEMS = 12;
  var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  function currentHandle() {
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function readList() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      var now = Date.now();
      return list.filter(function (entry) {
        return entry && entry.handle && now - entry.viewedAt < MAX_AGE_MS;
      });
    } catch (error) {
      return [];
    }
  }

  function writeList(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      /* Storage disabled/full — recently-viewed just won't persist. */
    }
  }

  function trackView() {
    var onProductPage = document.querySelector('.rpl-section-main-product [data-product-gallery]');
    var handle = currentHandle();
    if (!onProductPage || !handle) return;

    var list = readList().filter(function (entry) {
      return entry.handle !== handle;
    });
    list.unshift({ handle: handle, viewedAt: Date.now() });
    writeList(list.slice(0, MAX_ITEMS));
  }

  function renderGrid(root) {
    var grid = root.querySelector('[data-recently-viewed-grid]');
    if (!grid) return;

    var count = parseInt(root.getAttribute('data-count'), 10) || 8;
    var hideIfEmpty = root.getAttribute('data-hide-if-empty') === 'true';
    var excludeHandle = currentHandle();

    var handles = readList()
      .filter(function (entry) {
        return entry.handle !== excludeHandle;
      })
      .slice(0, count)
      .map(function (entry) {
        return entry.handle;
      });

    if (handles.length === 0) {
      root.hidden = hideIfEmpty;
      return;
    }

    var fetches = handles.map(function (handle) {
      return fetch('/products/' + handle + '?section_id=product-card-fetch')
        .then(function (response) {
          return response.ok ? response.text() : '';
        })
        .then(function (html) {
          if (!html) return '';
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var wrapper = doc.querySelector('.shopify-section');
          return wrapper ? wrapper.innerHTML : '';
        })
        .catch(function () {
          return '';
        });
    });

    Promise.all(fetches).then(function (htmlList) {
      var html = htmlList.join('');
      if (!html.trim()) {
        root.hidden = hideIfEmpty;
        return;
      }
      grid.innerHTML = html;
      root.hidden = false;
      RPL.initReveal(grid);
    });
  }

  function boot(root) {
    var scope = root || document;
    trackView();
    var containers = scope.querySelectorAll('[data-recently-viewed]');
    Array.prototype.forEach.call(containers, renderGrid);
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
