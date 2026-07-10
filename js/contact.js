/* Jesus Punkt — Kontaktformular · no dependencies
   Submits to the SAME Brizy form endpoint as the current jesus-punkt.de site
   (WordPress admin-ajax `brizy_submit_form`; protocol: form_id + data = JSON
   array of {name, value, label, type, required} — verified against the Brizy
   plugin source). The endpoint sends no CORS headers, so the POST goes out in
   no-cors mode: delivery is confirmable, the JSON response is not readable —
   client-side validation must catch every invalid case before sending. */
(function () {
  'use strict';

  var ENDPOINT = 'https://jesus-punkt.de/wp-admin/admin-ajax.php?nonce=&action=brizy_submit_form';
  var FORM_ID = 'zhlgpfbejuyehftgwpexkcwcbegjxutqzoab';

  var form = document.getElementById('contact-form');
  if (!form) return;

  /* ---------- validation ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(input, on) {
    var group = input.closest('.form-group');
    if (group) group.classList.toggle('has-error', on);
  }

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

  /* ---------- success modal ---------- */
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

  /* ---------- submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    form.classList.remove('has-failed');

    /* honeypot: bots fill it — pretend success, send nothing */
    var hp = document.getElementById('cf-website');
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
    body.append('form_id', FORM_ID);
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
})();
