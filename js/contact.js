/* Jesus Punkt — Formulare (Kontakt, Spendenbescheinigung) · no dependencies
   Every form[data-brz-form] submits to the SAME Brizy endpoint as the current
   jesus-punkt.de site (WordPress admin-ajax `brizy_submit_form`; protocol:
   form_id + data = JSON array of {name, value, label, type, required} — verified
   against the Brizy plugin source). The form's data-brz-form attribute carries
   its form_id; field tokens ride data-brz-name on each input.
   The endpoint sends no CORS headers, so the POST goes out in no-cors mode:
   delivery is confirmable, the JSON response is not readable — client-side
   validation must catch every invalid case before sending. */
(function () {
  'use strict';

  /* DECISION 2026-07-10: WordPress stays the form backend. At domain cutover this
     host changes to the WP's new address (e.g. alt.jesus-punkt.de) — the ONE line
     to touch; see docs/domain-migration.md §2. */
  var ENDPOINT = 'https://jesus-punkt.de/wp-admin/admin-ajax.php?nonce=&action=brizy_submit_form';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- success modal (one per page) ---------- */
  var overlay = document.getElementById('fm-success');
  function showSuccess() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
  }
  function hideSuccess() {
    overlay.classList.remove('is-visible');
    setTimeout(function () { overlay.classList.remove('is-open'); }, 250);
  }
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('[data-fm-close]')) hideSuccess();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) hideSuccess();
    });
  }

  function setError(input, on) {
    var group = input.closest('.form-group');
    if (group) group.classList.toggle('has-error', on);
  }

  document.querySelectorAll('form[data-brz-form]').forEach(function (form) {
    var formId = form.getAttribute('data-brz-form');

    function validate() {
      var ok = true;
      form.querySelectorAll('input[required], textarea[required]').forEach(function (input) {
        var bad = !input.value.trim() ||
                  (input.type === 'email' && !EMAIL_RE.test(input.value.trim()));
        setError(input, bad);
        if (bad) ok = false;
      });
      return ok;
    }

    form.querySelectorAll('input[required], textarea[required]').forEach(function (input) {
      input.addEventListener('input', function () { setError(input, false); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.classList.remove('has-failed');

      /* honeypot: bots fill it — pretend success, send nothing */
      var hp = form.querySelector('.form-group--hp input');
      if (hp && hp.value) { showSuccess(); form.reset(); return; }

      if (!validate()) return;

      var fields = [];
      form.querySelectorAll('[data-brz-name]').forEach(function (el) {
        fields.push({
          name: el.getAttribute('data-brz-name'),
          value: el.value,
          label: el.getAttribute('data-brz-label'),
          type: el.getAttribute('data-brz-type'),
          required: el.hasAttribute('required')
        });
      });

      var body = new FormData();
      body.append('form_id', formId);
      body.append('data', JSON.stringify(fields));

      form.classList.add('is-sending');
      fetch(ENDPOINT, { method: 'POST', body: body, mode: 'no-cors' })
        .then(function () {
          form.classList.remove('is-sending');
          form.reset();
          showSuccess();
        })
        .catch(function () {
          form.classList.remove('is-sending');
          form.classList.add('has-failed');
        });
    });
  });
})();
