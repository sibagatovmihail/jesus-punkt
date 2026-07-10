/* Jesus Punkt — Cookie consent (DSGVO + TTDSG) · no dependencies
   Granular banner + settings modal, pattern shared with viasmedia/akkermann.
   Analytics (GA4) loads ONLY after explicit opt-in AND when GA_ID is set.
   Locale comes from <html lang> (the i18n build sets it per tree).
   Public API: window.jpConsent = { openSettings, revoke }
   Elements with [data-cc-settings] (Datenschutz page) open the modal. */
(function () {
  'use strict';

  var STORAGE_KEY = 'jp-consent';
  var GA_ID = ''; /* TODO: set the GA4 measurement ID once the church has one — empty = analytics never loads */
  var BASE = new URL('..', document.currentScript.src).pathname;
  var PRIVACY_URL = BASE + 'datenschutz/'; /* German-only page, linked from every locale */

  var LANG = (document.documentElement.lang || 'de').slice(0, 2);

  var STRINGS = {
    de: {
      bannerTitle: 'Diese Website verwendet Cookies',
      bannerBody: 'Wir setzen technisch notwendige Speicherung sowie — mit Ihrer Einwilligung — Analyse-Cookies (Google Analytics) ein, um die Nutzung unserer Website zu verstehen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TTDSG. Ihre Einwilligung ist freiwillig und jederzeit widerrufbar. Details in der <a href="' + PRIVACY_URL + '" class="cc-link">Datenschutzerklärung</a>.',
      settings: 'Einstellungen',
      decline: 'Ablehnen',
      acceptAll: 'Alle akzeptieren',
      modalTitle: 'Cookie-Einstellungen',
      modalClose: 'Schließen',
      necessaryName: 'Notwendig',
      necessaryDesc: 'Ermöglichen grundlegende Funktionen wie das Speichern Ihrer Cookie-Entscheidung. Ohne sie kann die Website nicht richtig funktionieren.',
      alwaysActive: 'Immer aktiv',
      analyticsName: 'Analyse (Google Analytics)',
      analyticsDesc: 'Hilft uns zu verstehen, wie Besucher die Website nutzen. IP-Adressen werden anonymisiert. Anbieter: Google Ireland Ltd. Mehr in der <a href="' + PRIVACY_URL + '" class="cc-link">Datenschutzerklärung</a>.',
      analyticsLabel: 'Analyse-Cookies',
      save: 'Auswahl speichern',
      ariaBanner: 'Cookie-Einstellungen',
      ariaModal: 'Cookie-Einstellungen verwalten'
    },
    en: {
      bannerTitle: 'This website uses cookies',
      bannerBody: 'We use technically necessary storage and — with your consent — analytics cookies (Google Analytics) to understand how our website is used. The legal basis is Art. 6(1)(a) GDPR, § 25(1) TTDSG. Your consent is voluntary and can be withdrawn at any time. Details in our <a href="' + PRIVACY_URL + '" class="cc-link">privacy policy</a> (German).',
      settings: 'Settings',
      decline: 'Decline',
      acceptAll: 'Accept all',
      modalTitle: 'Cookie settings',
      modalClose: 'Close',
      necessaryName: 'Necessary',
      necessaryDesc: 'Enable core functionality such as saving your cookie decision. The website cannot work properly without them.',
      alwaysActive: 'Always active',
      analyticsName: 'Analytics (Google Analytics)',
      analyticsDesc: 'Helps us understand how visitors use the website. IP addresses are anonymised. Provider: Google Ireland Ltd. More in our <a href="' + PRIVACY_URL + '" class="cc-link">privacy policy</a> (German).',
      analyticsLabel: 'Analytics cookies',
      save: 'Save selection',
      ariaBanner: 'Cookie settings',
      ariaModal: 'Manage cookie settings'
    },
    uk: {
      bannerTitle: 'Цей сайт використовує cookie',
      bannerBody: 'Ми використовуємо технічно необхідне збереження даних, а також — за вашою згодою — аналітичні cookie (Google Analytics), щоб розуміти, як користуються нашим сайтом. Правова основа: ст. 6 (1)(a) GDPR, § 25 (1) TTDSG. Згода добровільна, її можна будь-коли відкликати. Деталі — у <a href="' + PRIVACY_URL + '" class="cc-link">політиці конфіденційності</a> (німецькою).',
      settings: 'Налаштування',
      decline: 'Відхилити',
      acceptAll: 'Прийняти всі',
      modalTitle: 'Налаштування cookie',
      modalClose: 'Закрити',
      necessaryName: 'Необхідні',
      necessaryDesc: 'Забезпечують базові функції, як-от збереження вашого рішення щодо cookie. Без них сайт не працюватиме належно.',
      alwaysActive: 'Завжди активні',
      analyticsName: 'Аналітика (Google Analytics)',
      analyticsDesc: 'Допомагає нам розуміти, як відвідувачі користуються сайтом. IP-адреси анонімізуються. Постачальник: Google Ireland Ltd. Більше — у <a href="' + PRIVACY_URL + '" class="cc-link">політиці конфіденційності</a>.',
      analyticsLabel: 'Аналітичні cookie',
      save: 'Зберегти вибір',
      ariaBanner: 'Налаштування cookie',
      ariaModal: 'Керувати налаштуваннями cookie'
    }
  };
  var s = STRINGS[LANG] || STRINGS.de;

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function saveConsent(analytics) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: analytics, ts: Date.now() })); } catch (e) {}
  }

  /* GA4 loader — a no-op until GA_ID is configured; never loads without consent */
  function loadGA() {
    if (!GA_ID || window._gaLoaded) return;
    window._gaLoaded = true;
    var el = document.createElement('script');
    el.async = true;
    el.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(el);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function createBanner() {
    var el = document.createElement('div');
    el.id = 'cc-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', s.ariaBanner);
    el.innerHTML =
      '<div class="cc-inner">' +
        '<div class="cc-text">' +
          '<div><p class="cc-title">' + s.bannerTitle + '</p></div>' +
          '<div><p class="cc-body">' + s.bannerBody + '</p></div>' +
        '</div>' +
        '<div class="cc-actions">' +
          '<button class="cc-btn cc-btn--ghost" id="cc-settings-btn">' + s.settings + '</button>' +
          '<button class="cc-btn cc-btn--outline" id="cc-decline-btn">' + s.decline + '</button>' +
          '<button class="cc-btn cc-btn--accent" id="cc-accept-btn">' + s.acceptAll + '</button>' +
        '</div>' +
      '</div>';
    return el;
  }

  function createModal() {
    var el = document.createElement('div');
    el.id = 'cc-modal-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', s.ariaModal);
    el.innerHTML =
      '<div class="cc-modal">' +
        '<div class="cc-modal__header">' +
          '<div><p class="cc-modal__title">' + s.modalTitle + '</p></div>' +
          '<button class="cc-modal__close" id="cc-modal-close" aria-label="' + s.modalClose + '">' +
            '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="cc-modal__body">' +
          '<div class="cc-category">' +
            '<div class="cc-category__info">' +
              '<div><p class="cc-category__name">' + s.necessaryName + '</p></div>' +
              '<div><p class="cc-category__desc">' + s.necessaryDesc + '</p></div>' +
            '</div>' +
            '<div class="cc-toggle cc-toggle--locked" aria-label="' + s.alwaysActive + '"><span class="cc-toggle__label">' + s.alwaysActive + '</span></div>' +
          '</div>' +
          '<div class="cc-category">' +
            '<div class="cc-category__info">' +
              '<div><p class="cc-category__name">' + s.analyticsName + '</p></div>' +
              '<div><p class="cc-category__desc">' + s.analyticsDesc + '</p></div>' +
            '</div>' +
            '<label class="cc-toggle" aria-label="' + s.analyticsLabel + '">' +
              '<input type="checkbox" id="cc-analytics-toggle" class="cc-toggle__input">' +
              '<span class="cc-toggle__track"><span class="cc-toggle__thumb"></span></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="cc-modal__footer">' +
          '<button class="cc-btn cc-btn--outline" id="cc-save-btn">' + s.save + '</button>' +
          '<button class="cc-btn cc-btn--accent" id="cc-accept-all-btn">' + s.acceptAll + '</button>' +
        '</div>' +
      '</div>';
    return el;
  }

  function hideBanner(banner) {
    banner.classList.add('cc-banner--hidden');
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
  }

  function closeModal(overlay) {
    overlay.classList.remove('cc-modal-overlay--visible');
    setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
  }

  function showModal(banner) {
    if (document.getElementById('cc-modal-overlay')) return;
    var overlay = createModal();
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('cc-modal-overlay--visible'); });

    var analyticsToggle = overlay.querySelector('#cc-analytics-toggle');
    var consent = getConsent();
    if (consent && consent.analytics) analyticsToggle.checked = true;

    overlay.querySelector('#cc-modal-close').addEventListener('click', function () { closeModal(overlay); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(overlay); });

    overlay.querySelector('#cc-save-btn').addEventListener('click', function () {
      var allow = analyticsToggle.checked;
      saveConsent(allow);
      if (allow) loadGA();
      closeModal(overlay);
      if (banner) hideBanner(banner);
    });
    overlay.querySelector('#cc-accept-all-btn').addEventListener('click', function () {
      saveConsent(true);
      loadGA();
      closeModal(overlay);
      if (banner) hideBanner(banner);
    });
  }

  function init() {
    /* Datenschutz page: settings buttons work regardless of consent state */
    document.querySelectorAll('[data-cc-settings]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showModal(document.getElementById('cc-banner'));
      });
    });

    var consent = getConsent();
    if (consent !== null) {
      if (consent.analytics) loadGA();
      return;
    }

    var banner = createBanner();
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('cc-banner--visible'); });

    banner.querySelector('#cc-accept-btn').addEventListener('click', function () {
      saveConsent(true);
      loadGA();
      hideBanner(banner);
    });
    banner.querySelector('#cc-decline-btn').addEventListener('click', function () {
      saveConsent(false);
      hideBanner(banner);
    });
    banner.querySelector('#cc-settings-btn').addEventListener('click', function () {
      showModal(banner);
    });
  }

  window.jpConsent = {
    openSettings: function () { showModal(document.getElementById('cc-banner')); },
    revoke: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
