/* Jesus Punkt — header, fullscreen nav, sermon carousel · no dependencies */
(function () {
  'use strict';

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
    pill.addEventListener('mouseleave', hide);
  }

  /* ---------- Werte wheel (pinned scroll section) ---------- */
  var werte = document.querySelector('.werte');
  if (werte && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var wheel = werte.querySelector('.wheel');
    var items = wheel ? Array.prototype.slice.call(wheel.querySelectorAll('.wheel__item')) : [];
    var panel = werte.querySelector('.werte__panel');
    var LINES = [
      'Wir leben, was wir sagen.',
      'Wir sind am Puls der Zeit.',
      'Wir geben Gott unser Bestes, nachdem er sein Bestes für uns gegeben hat.',
      'Wir schaffen eine liebevolle „Welcome Home“-Atmosphäre.',
      'Die Freude an Gott ist unsere Stärke.',
      'Wir segnen, weil wir gesegnet sind.',
      'Wir lieben Menschen.'
    ];
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
      var setActive = function (idx) {
        if (idx === active) return;
        var isInit = active === -1;
        active = idx;
        wheel.style.setProperty('--wheel-turn', (-idx * 51.4286) + 'deg');
        items.forEach(function (it, i) { it.classList.toggle('is-active', i === idx); });
        if (isInit) { applyPanel(idx); return; } /* no crossfade dip on page load */
        panel.classList.add('is-switching');
        clearTimeout(switchTimer);
        switchTimer = setTimeout(function () {
          applyPanel(idx);
          panel.classList.remove('is-switching');
        }, 180);
      };

      var onWerteScroll = function () {
        var rect = werte.getBoundingClientRect();
        var runway = rect.height - window.innerHeight;
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
        it.setAttribute('aria-label', it.querySelector('.bubble__name').textContent + ' anzeigen');
        var focusValue = function () {
          var rect = werte.getBoundingClientRect();
          var runway = rect.height - window.innerHeight;
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
    burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
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
