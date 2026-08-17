/*
  rpl-facets.js — AJAX collection filtering/sorting.

  Loaded only from sections/main-collection.liquid. The <form> there already
  works with JavaScript disabled (a real GET submit reloads the page with the
  right query params); this only intercepts changes to auto-submit, and
  fetches the section fresh via the Section Rendering API
  (?section_id=...) instead of hand-building filtered results in JS.

  Every entry point — a filter checkbox, the sort <select>, a price input, an
  active-filter pill's "remove" link, "Clear all" — funnels through the same
  refresh() function, so there's exactly one code path that talks to the
  network and touches the DOM.
*/
(function () {
  'use strict';

  if (!window.RPL) return;
  var RPL = window.RPL;

  function getForm() {
    return document.querySelector('[data-facets-form]');
  }

  function getSectionWrapper() {
    var form = getForm();
    if (!form) return null;
    return document.getElementById('shopify-section-' + form.getAttribute('data-section-id'));
  }

  function refresh(url, pushState) {
    var wrapper = getSectionWrapper();
    var form = getForm();
    if (!wrapper || !form) return;

    var sectionId = form.getAttribute('data-section-id');
    var fetchUrl = new URL(url, window.location.href);
    fetchUrl.searchParams.set('section_id', sectionId);

    var wasOpen = false;
    var openFacets = wrapper.querySelector('.rpl-facets');
    if (openFacets) wasOpen = openFacets.hasAttribute('open');

    wrapper.setAttribute('aria-busy', 'true');

    fetch(fetchUrl.toString(), { headers: { Accept: 'text/html' } })
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.getElementById('shopify-section-' + sectionId);
        var current = getSectionWrapper();
        if (!fresh || !current) return;

        current.replaceWith(fresh);
        fresh.removeAttribute('aria-busy');

        if (wasOpen) {
          var freshFacets = fresh.querySelector('.rpl-facets');
          if (freshFacets) freshFacets.setAttribute('open', '');
        }

        if (pushState !== false) {
          var cleanUrl = new URL(url, window.location.href);
          cleanUrl.searchParams.delete('section_id');
          window.history.pushState({ rplFacets: true }, '', cleanUrl);
        }

        var status = fresh.querySelector('[role="status"]');
        if (status) RPL.announce(status.textContent.trim());

        RPL.initReveal(fresh);
      })
      .catch(function () {
        var wrapperNow = getSectionWrapper();
        if (wrapperNow) wrapperNow.removeAttribute('aria-busy');
        /* Network failure: fall back to a real navigation, which works
           without any of the above. */
        window.location.href = url;
      });
  }

  function submitForm(form) {
    var url = form.action + '?' + new URLSearchParams(new FormData(form)).toString();
    refresh(url);
  }

  var submitDebounced = RPL.debounce(submitForm, 400);

  document.addEventListener('change', function (event) {
    var control = event.target.closest('[data-facets-auto-submit]');
    if (!control) return;
    var form = control.closest('[data-facets-form]');
    if (!form) return;

    if (control.type === 'number') {
      submitDebounced(form);
    } else {
      submitForm(form);
    }
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-facets-form]');
    if (!form) return;
    event.preventDefault();
    submitForm(form);
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-facets-link]');
    if (!link) return;
    event.preventDefault();
    refresh(link.href);
  });

  window.addEventListener('popstate', function () {
    if (!getForm()) return;
    refresh(window.location.href, false);
  });
})();
