/*
  rpl-customer.js — progressive enhancement for the customer address forms.

  Loaded only on templates/customers/addresses. Two jobs:

  1. Link the province field to the selected country, using the
     `data-provinces` payload Shopify already puts on each option from
     `country_option_tags`. No legacy shopify_common.js dependency.
  2. Confirm destructive address deletions.

  With JavaScript disabled the province input stays a plain text field and the
  delete form posts without a confirmation — both still correct.
*/
(function () {
  'use strict';

  function buildProvinceField(root) {
    var countrySelect = root.querySelector('[data-address-country]');
    var provinceWrapper = root.querySelector('[data-address-province-wrapper]');
    var provinceInput = root.querySelector('[data-address-province]');
    if (!countrySelect || !provinceWrapper || !provinceInput) return;

    var initialValue = provinceInput.value;

    function render() {
      var option = countrySelect.options[countrySelect.selectedIndex];
      var raw = option ? option.getAttribute('data-provinces') : null;
      var provinces = [];

      if (raw) {
        try {
          provinces = JSON.parse(raw);
        } catch (error) {
          provinces = [];
        }
      }

      if (provinces.length === 0) {
        provinceWrapper.hidden = true;
        provinceInput.value = '';
        return;
      }

      provinceWrapper.hidden = false;

      // Swap the text input for a select the first time we have a list.
      if (provinceInput.tagName !== 'SELECT') {
        var select = document.createElement('select');
        select.className = provinceInput.className.replace('rpl-input', 'rpl-select');
        select.id = provinceInput.id;
        select.name = provinceInput.name;
        select.setAttribute('autocomplete', 'address-level1');
        select.setAttribute('data-address-province', '');
        provinceInput.parentNode.replaceChild(select, provinceInput);
        provinceInput = select;
      }

      provinceInput.innerHTML = '';
      provinces.forEach(function (pair) {
        var opt = document.createElement('option');
        opt.value = pair[0];
        opt.textContent = pair[1];
        if (pair[0] === initialValue || pair[1] === initialValue) opt.selected = true;
        provinceInput.appendChild(opt);
      });
    }

    countrySelect.addEventListener('change', function () {
      initialValue = '';
      render();
    });

    render();
  }

  function init() {
    document.querySelectorAll('[data-address-form]').forEach(buildProvinceField);

    document.addEventListener('submit', function (event) {
      var form = event.target.closest('[data-address-delete]');
      if (!form) return;
      var message = form.getAttribute('data-address-delete');
      if (message && !window.confirm(message)) event.preventDefault();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
