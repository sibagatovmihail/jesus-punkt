/* Jesus Punkt — header, fullscreen nav, sermon carousel · no dependencies */
(function () {
  'use strict';

  /* page locale (set on <html lang> by the i18n build; German is the default) */
  var LANG = (document.documentElement.lang || 'de').slice(0, 2);
  var UI_I18N = {
    de: { open: 'Menü öffnen', close: 'Menü schließen', show: ' anzeigen' },
    en: { open: 'Open menu', close: 'Close menu', show: ' — show' },
    uk: { open: 'Відкрити меню', close: 'Закрити меню', show: ' — показати' }
  };
  var UI = UI_I18N[LANG] || UI_I18N.de;

  /* ---------- Fixed header: solid once scrolled ---------- */
  var header = document.querySelector('.header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Nav pill: sliding hover highlight ---------- */
  var pill = document.querySelector('.nav-pill');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (pill && !reduceMotion.matches) {
    var glider = document.createElement('span');
    glider.className = 'nav-pill__glider';
    glider.setAttribute('aria-hidden', 'true');
    pill.prepend(glider);

    var moveTo = function (link) {
      glider.style.left = link.offsetLeft + 'px';
      glider.style.width = link.offsetWidth + 'px';
    };
    var show = function (link) {
      if (!pill.classList.contains('has-glider')) {
        /* first entry: appear in place, no slide-in from 0 */
        glider.style.transition = 'none';
        moveTo(link);
        void glider.offsetWidth; /* flush so the next transition animates */
        glider.style.transition = '';
        pill.classList.add('has-glider');
      } else {
        moveTo(link);
      }
    };
    var hide = function () { pill.classList.remove('has-glider'); };

    pill.querySelectorAll('.nav-pill__link').forEach(function (link) {
      link.addEventListener('mouseenter', function () { show(link); });
      link.addEventListener('focus', function () { show(link); });
      link.addEventListener('blur', hide);
    });
    /* the language button glides like any other pill item — the glider targets
       its wrapper (a direct pill child), so offsetLeft is pill-relative */
    var langGlide = pill.querySelector('.nav-pill__lang');
    if (langGlide) {
      var langGlideBtn = langGlide.querySelector('.nav-pill__lang-btn');
      langGlideBtn.addEventListener('mouseenter', function () { show(langGlide); });
      langGlideBtn.addEventListener('focus', function () { show(langGlide); });
      langGlideBtn.addEventListener('blur', hide);
    }
    pill.addEventListener('mouseleave', hide);
  }

  /* ---------- Language dropdown in the nav pill ---------- */
  var langWrap = document.querySelector('.nav-pill__lang');
  if (langWrap) {
    var langBtn = langWrap.querySelector('.nav-pill__lang-btn');
    var langCode = langWrap.querySelector('.nav-pill__lang-code');
    if (langCode) langCode.textContent = LANG.toUpperCase();

    var setLangOpen = function (open) {
      langWrap.classList.toggle('is-open', open);
      langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    langBtn.addEventListener('click', function () {
      setLangOpen(!langWrap.classList.contains('is-open'));
    });
    langWrap.addEventListener('mouseenter', function () { setLangOpen(true); });
    langWrap.addEventListener('mouseleave', function () { setLangOpen(false); });
    document.addEventListener('click', function (e) {
      if (!langWrap.contains(e.target)) setLangOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setLangOpen(false);
    });
  }

  /* ---------- Appearance reveals (scroll-triggered, once) ---------- */
  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    var revealTargets = document.querySelectorAll([
      '.section-head',
      '.hero__copy > div',
      '.hero__actions',
      '.page-hero__inner > div',
      '[data-ct]:not(.carousel__track)', /* dynamic slots reveal as blocks — data.js replaces their children */
      '.carousel',                       /* the track itself is owned by the carousel's inline transform */
      '.sermons__foot',
      '.groups__copy > div',
      '.info-card',
      '.card'
    ].join(', '));
    var revealDone = function (el) {
      el.classList.remove('reveal', 'is-in');
      el.style.removeProperty('--rv-d');
    };
    var io = new IntersectionObserver(function (entries) {
      var batches = []; /* siblings entering together stagger by parent */
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var batch = null;
        for (var i = 0; i < batches.length; i++) {
          if (batches[i].parent === el.parentElement) batch = batches[i];
        }
        if (!batch) { batch = { parent: el.parentElement, n: 0 }; batches.push(batch); }
        var delay = batch.n++ * 70;
        el.style.setProperty('--rv-d', delay + 'ms');
        el.classList.add('is-in');
        setTimeout(function () { revealDone(el); }, delay + 700);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    revealTargets.forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* ---------- Werte wheel (pinned scroll section) ---------- */
  var werte = document.querySelector('.werte');
  if (werte && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var wheel = werte.querySelector('.wheel');
    var items = wheel ? Array.prototype.slice.call(wheel.querySelectorAll('.wheel__item')) : [];
    var panel = werte.querySelector('.werte__panel');
    var LINES_I18N = {
      de: [
        'Wir leben, was wir sagen.',
        'Wir sind am Puls der Zeit.',
        'Wir geben Gott unser Bestes, nachdem er sein Bestes für uns gegeben hat.',
        'Wir schaffen eine liebevolle „Welcome Home“-Atmosphäre.',
        'Die Freude an Gott ist unsere Stärke.',
        'Wir segnen, weil wir gesegnet sind.',
        'Wir lieben Menschen.'
      ],
      en: [
        'We live what we say.',
        'We keep our finger on the pulse of the times.',
        'We give God our best — after he gave his best for us.',
        'We create a loving “Welcome Home” atmosphere.',
        'The joy of the Lord is our strength.',
        'We bless because we are blessed.',
        'We love people.'
      ],
      uk: [
        'Ми живемо тим, що говоримо.',
        'Ми тримаємо руку на пульсі часу.',
        'Ми віддаємо Богові найкраще — адже Він віддав найкраще за нас.',
        'Ми створюємо атмосферу любові «Welcome Home».',
        'Радість у Господі — наша сила.',
        'Ми благословляємо, бо самі благословенні.',
        'Ми любимо людей.'
      ]
    };
    /* CMS-baked lines (deploy injects #werte-lines from data/content/werte.json) win
       over the built-in copy — local dev without the bake keeps working */
    var linesEl = document.getElementById('werte-lines');
    if (linesEl) {
      try { LINES_I18N = JSON.parse(linesEl.textContent); } catch (e) { /* keep built-in */ }
    }
    var LINES = LINES_I18N[LANG] || LINES_I18N.de;
    if (wheel && items.length === 7 && panel) {
      var numEl = panel.querySelector('.werte__panel-num');
      var nameEl = panel.querySelector('.werte__panel-name');
      var lineEl = panel.querySelector('.werte__panel-line p');
      var active = -1;
      var switchTimer;

      var applyPanel = function (idx) {
        numEl.textContent = '0' + (idx + 1);
        nameEl.textContent = items[idx].querySelector('.bubble__name').textContent;
        lineEl.textContent = LINES[idx];
      };

      /* phone close-ranks: the active bubble sits in the centre, the other six
         re-space to 60° so the ring stays complete (next value straight above).
         Angles are tracked unwrapped so every morph takes the shortest path. */
      var mqPhone = window.matchMedia('(max-width: 48rem)');
      var curAngles = items.map(function (_, i) { return i * 51.4286; });
      var applyAngles = function (idx) {
        items.forEach(function (it, i) {
          if (!mqPhone.matches) {
            it.style.removeProperty('--angle'); /* back to the CSS calc(--i * 51.4286deg) */
            curAngles[i] = i * 51.4286;
            return;
          }
          var k = (i - idx + 7) % 7;
          if (k === 0) return; /* active: centred via translateY(0), angle irrelevant */
          /* target = visual slot (k-1)·60° compensated for the current ring turn */
          var delta = ((k - 1) * 60 + idx * 51.4286 - curAngles[i]) % 360;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          curAngles[i] += delta;
          it.style.setProperty('--angle', curAngles[i] + 'deg');
        });
      };
      mqPhone.addEventListener('change', function () { if (active >= 0) applyAngles(active); });

      var setActive = function (idx) {
        if (idx === active) return;
        var isInit = active === -1;
        active = idx;
        wheel.style.setProperty('--wheel-turn', (-idx * 51.4286) + 'deg');
        items.forEach(function (it, i) {
          var dist = Math.min(Math.abs(i - idx), 7 - Math.abs(i - idx));
          it.style.setProperty('--d', dist); /* ring distance drives the ripple + falloff */
          it.classList.toggle('is-active', i === idx);
        });
        applyAngles(idx);
        if (isInit) { applyPanel(idx); return; } /* no crossfade dip on page load */
        panel.classList.add('is-switching');
        clearTimeout(switchTimer);
        switchTimer = setTimeout(function () {
          applyPanel(idx);
          panel.classList.remove('is-switching');
        }, 180);
      };

      /* Safari's toolbar show/hide changes window.innerHeight mid-scroll — recomputing the
         runway against that live value made the wheel/pin geometry jump when scrolling back
         up past the toolbar's reappear point. Cache it (page load = toolbar expanded, so this
         matches the stable `svh` the CSS pin height uses) and only refresh on real viewport
         changes (width moving = rotation), not the chrome bar's height-only churn. */
      var werteVW = window.innerWidth;
      var werteVH = window.innerHeight;
      window.addEventListener('resize', function () {
        if (window.innerWidth !== werteVW) {
          werteVW = window.innerWidth;
          werteVH = window.innerHeight;
        }
      });

      var onWerteScroll = function () {
        var rect = werte.getBoundingClientRect();
        var runway = rect.height - werteVH;
        if (runway <= 0) { setActive(0); return; }
        var progress = Math.min(1, Math.max(0, -rect.top / runway));
        setActive(Math.min(6, Math.floor(progress * 7)));
      };
      window.addEventListener('scroll', onWerteScroll, { passive: true });
      onWerteScroll();

      /* tap a value to bring it into focus: jump the pinned scroll position
         into that value's segment — invisible while pinned, only the wheel turns */
      items.forEach(function (it, i) {
        it.setAttribute('role', 'button');
        it.setAttribute('tabindex', '0');
        it.setAttribute('aria-label', it.querySelector('.bubble__name').textContent + UI.show);
        var focusValue = function () {
          var rect = werte.getBoundingClientRect();
          var runway = rect.height - werteVH;
          if (runway <= 0) return;
          var top = rect.top + window.scrollY;
          window.scrollTo({ top: top + runway * ((i + 0.5) / 7), behavior: 'instant' });
        };
        it.addEventListener('click', focusValue);
        it.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusValue(); }
        });
      });
    }
  }

  /* ---------- Fullscreen slide-down navigation ---------- */
  var burger = document.getElementById('burger');
  var panel = document.getElementById('nav-panel');

  function setNav(open) {
    panel.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? UI.close : UI.open);
  }

  if (burger && panel) {
    burger.addEventListener('click', function () {
      setNav(!panel.classList.contains('is-open'));
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        setNav(false);
        burger.focus();
      }
    });
  }

  /* ---------- Carousels (full-bleed) — one init per .carousel[id] ---------- */
  function setupCarousel(carousel) {
    var track = carousel.querySelector('.carousel__track');
    var prevBtn = document.querySelector('[data-carousel-prev="' + carousel.id + '"]');
    var nextBtn = document.querySelector('[data-carousel-next="' + carousel.id + '"]');
    if (!track || !prevBtn || !nextBtn) return;
    var index = 0;

    function metrics() {
      var items = track.children;
      if (!items.length) return null;
      var itemW = items[0].getBoundingClientRect().width;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      // the track box equals the container width — overflow bleeds to the screen edge
      var usable = track.getBoundingClientRect().width;
      var perView = Math.max(1, Math.round((usable + gap) / (itemW + gap)));
      return { step: itemW + gap, max: Math.max(0, items.length - perView) };
    }

    function render() {
      var m = metrics();
      if (!m) return;
      index = Math.min(index, m.max);
      track.style.transform = 'translateX(' + (-index * m.step) + 'px)';
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= m.max;
    }

    prevBtn.addEventListener('click', function () { index = Math.max(0, index - 1); render(); });
    nextBtn.addEventListener('click', function () {
      var m = metrics();
      if (m) { index = Math.min(m.max, index + 1); render(); }
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 120);
    });

    carousel._render = render;
    render();
  }
  document.querySelectorAll('.carousel[id]').forEach(setupCarousel);
  window.JPCarousel = {
    refresh: function (track) {
      var c = track.closest('.carousel');
      if (c && c._render) c._render();
    }
  };

  /* ---------- Galleries (scroll-snap sliders) ---------- */
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    var track = gallery.querySelector('.gallery__track');
    var prev = gallery.querySelector('[data-gallery-prev]');
    var next = gallery.querySelector('[data-gallery-next]');
    if (!track || !prev || !next) return;
    var behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    function step() {
      var item = track.firstElementChild;
      if (!item) return 0;
      return item.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: behavior }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: behavior }); });
  });
})();
