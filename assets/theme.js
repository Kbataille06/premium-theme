/* ============================================================
   CHROMAONE THEME — Main JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initContentProtection();
  initCountdown();
  initMobileNav();
  initShopGallery();
  initBundle();
  initVariantSelects();
  initReviewsCarousel();
  initTriedCarousel();
  initMarquees();
  initCartQty();
  initCartDrawer();
  initVideoMute();
  initSlideshow();
});

/* ── Hero slideshow ──────────────────────────────────────── */
function initSlideshow() {
  document.querySelectorAll('[data-slideshow]').forEach(sshow => {
    const slides = [...sshow.querySelectorAll('[data-slide]')];
    if (slides.length < 2) return;
    const prev = sshow.querySelector('[data-slide-prev]');
    const next = sshow.querySelector('[data-slide-next]');
    const dotsWrap = sshow.querySelector('[data-slide-dots]');
    let current = 0, timer = null;

    const dots = slides.map((_, i) => {
      const d = document.createElement('button');
      d.className = 'slideshow__dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', 'Slide ' + (i + 1));
      d.addEventListener('click', () => { go(i); restart(); });
      dotsWrap && dotsWrap.appendChild(d);
      return d;
    });

    const go = (i) => {
      slides[current].classList.remove('is-active');
      dots[current] && dots[current].classList.remove('is-active');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      dots[current] && dots[current].classList.add('is-active');
    };

    const autoplay = sshow.dataset.autoplay === 'true';
    const interval = (parseInt(sshow.dataset.interval, 10) || 6) * 1000;
    const start = () => { if (autoplay) timer = setInterval(() => go(current + 1), interval); };
    const restart = () => { clearInterval(timer); start(); };

    prev && prev.addEventListener('click', () => { go(current - 1); restart(); });
    next && next.addEventListener('click', () => { go(current + 1); restart(); });
    sshow.addEventListener('mouseenter', () => clearInterval(timer));
    sshow.addEventListener('mouseleave', restart);
    start();
  });
}

/* ── Mute / unmute des vidéos "See it in action" ────────── */
function initVideoMute() {
  const buttons = document.querySelectorAll('[data-video-mute]');
  if (!buttons.length) return;

  // Affiche la bonne icône selon l'état réel de la vidéo (classe .is-on = son actif)
  const syncIcon = (btn, video) => {
    btn.classList.toggle('is-on', !video.muted);
  };

  buttons.forEach(btn => {
    const item0 = btn.closest('.video-carousel__item');
    const video0 = item0 && item0.querySelector('video');
    if (video0) syncIcon(btn, video0); // état initial correct

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = btn.closest('.video-carousel__item');
      const video = item && item.querySelector('video');
      if (!video) return;

      const willUnmute = video.muted;

      if (willUnmute) {
        // Coupe le son de toutes les autres vidéos avant d'activer celle-ci
        document.querySelectorAll('.video-carousel__video').forEach(v => {
          if (v !== video) {
            v.muted = true;
            const b = v.closest('.video-carousel__item').querySelector('[data-video-mute]');
            if (b) syncIcon(b, v);
          }
        });
      }

      video.muted = !video.muted;
      // Le clic est un geste utilisateur → autorise la lecture avec son
      if (!video.muted) { video.play().catch(() => {}); }

      syncIcon(btn, video);
    });
  });
}

/* ── Cart drawer (pop-up latéral AJAX) ──────────────────── */
function initCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  const open = () => {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  // Re-render le contenu du drawer via l'API Section Rendering
  async function refresh() {
    try {
      const res = await fetch('/?sections=cart-drawer');
      const data = await res.json();
      const sec = document.getElementById('shopify-section-cart-drawer');
      if (sec && data['cart-drawer'] != null) sec.innerHTML = data['cart-drawer'];
      syncCartCount();
    } catch (e) { /* silencieux */ }
  }

  // Met à jour le compteur du header depuis le drawer
  function syncCartCount() {
    const c = drawer.querySelector('.cart-drawer__count');
    if (!c) return;
    const count = parseInt(c.textContent.trim(), 10) || 0;
    document.querySelectorAll('.header__cart-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
  }

  async function addToCart(form, btn) {
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.dataset.loading = '1'; }
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      if (res.ok) { await refresh(); open(); }
    } finally {
      if (btn) { btn.disabled = false; delete btn.dataset.loading; if (original) btn.textContent = original; }
    }
  }

  async function changeQty(key, qty) {
    try {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      await refresh();
    } catch (e) {}
  }

  // Intercepte l'ajout au panier (tous les formulaires produit)
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[action*="/cart/add"]');
    if (!form) return;
    // Laisse passer les boutons de paiement express (PayPal, Shop Pay…)
    if (e.submitter && e.submitter.closest('.shopify-payment-button, [data-shopify="payment-button"]')) return;
    e.preventDefault();
    addToCart(form, form.querySelector('[type="submit"]'));
  });

  // Le panier du header ouvre le drawer
  document.querySelectorAll('.header__cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
  });

  // Clics délégués : fermer, +/-, retirer
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-close]')) { close(); return; }
    const item = e.target.closest('.cart-drawer__item');
    if (!item) return;
    const key = item.getAttribute('data-key');
    if (e.target.closest('[data-cart-plus]')) {
      const cur = parseInt(item.querySelector('.cart-drawer__qty-val').textContent, 10);
      changeQty(key, cur + 1);
    } else if (e.target.closest('[data-cart-minus]')) {
      const cur = parseInt(item.querySelector('.cart-drawer__qty-val').textContent, 10);
      changeQty(key, Math.max(0, cur - 1));
    } else if (e.target.closest('[data-cart-remove]')) {
      changeQty(key, 0);
    }
  });

  // Échap ferme le drawer
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* ── Marquees (remplissage + boucle sans couture) ───────── */
function initMarquees() {
  const marquees = [...document.querySelectorAll('[data-marquee]')];
  if (!marquees.length) return;

  const build = (marquee) => {
    const track = marquee.querySelector('[data-marquee-track]');
    const group = marquee.querySelector('[data-marquee-group]');
    if (!track || !group) return;

    // Retire les copies précédentes (rebuild sur resize)
    track.querySelectorAll('[data-marquee-clone]').forEach(n => n.remove());

    const containerW = marquee.clientWidth || window.innerWidth || 360;
    const groupW = group.scrollWidth;

    // Largeur pas encore mesurable (rendu/polices non prêts) : on attend le 'load'
    if (groupW < 5) return;

    // Nombre de groupes pour couvrir au moins 2× la largeur visible,
    // arrondi à un nombre PAIR (indispensable pour la boucle -50% sans couture)
    let groups = Math.ceil((2 * containerW) / groupW);
    if (groups < 2) groups = 2;
    if (groups % 2 !== 0) groups++;
    if (groups > 30) groups = 30; // garde-fou

    for (let i = 1; i < groups; i++) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('data-marquee-clone', '');
      track.appendChild(clone);
    }

    // Vitesse constante (~100px/s, exact chromabuds) quel que soit le nombre d'éléments
    // distance par boucle = scrollWidth/2 (translateX -50%) → durée = (scrollWidth/2)/100 = scrollWidth/200
    track.style.animationDuration = Math.max(12, track.scrollWidth / 200) + 's';
  };

  const buildAll = () => marquees.forEach(build);

  buildAll();
  // Re-mesure une fois les polices/layout chargés
  window.addEventListener('load', buildAll);
  // Reconstruit au changement de taille (debounce)
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(buildAll, 200); });
}

/* ── Tried Tested carousel (auto-scroll infini) ─────────── */
function initTriedCarousel() {
  document.querySelectorAll('[data-tried-track]').forEach(track => {
    if (!track.children.length) return;

    // Duplique les items pour une boucle sans couture
    const originals = [...track.children];
    originals.forEach(node => {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    let pos = 0;            // accumulateur flottant (évite l'arrondi mobile)
    let hover = false;
    let lastTouch = 0;
    const speed = 1.2;      // px par frame (plus rapide)
    const RESUME_MS = 1500; // reprise auto 1,5s après le dernier toucher

    const step = () => {
      const half = track.scrollWidth / 2;
      const touching = Date.now() - lastTouch < RESUME_MS;
      if (half > 0) {
        if (hover || touching) {
          // l'utilisateur interagit : on garde l'accumulateur synchronisé
          pos = track.scrollLeft;
        } else {
          // défilement auto — reprend TOUJOURS après l'interaction
          pos += speed;
          if (pos >= half) pos -= half;
          track.scrollLeft = pos;
        }
      }
      requestAnimationFrame(step);
    };

    track.addEventListener('mouseenter', () => hover = true);
    track.addEventListener('mouseleave', () => hover = false);
    ['touchstart', 'touchmove', 'touchend'].forEach(ev =>
      track.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true })
    );

    requestAnimationFrame(step);
  });
}

/* ── Protection du contenu (clic droit + raccourcis) ────── */
function initContentProtection() {
  // Bloque le clic droit / menu contextuel
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Bloque les raccourcis d'inspection courants
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (
      k === 'F12' ||                                            // DevTools
      ((e.ctrlKey || e.metaKey) && e.shiftKey && /^[IJC]$/i.test(k)) || // Inspecteur/Console
      ((e.ctrlKey || e.metaKey) && /^[U]$/i.test(k))            // Voir le source
    ) {
      e.preventDefault();
    }
  });
}

/* ── Countdown timer ────────────────────────────────────── */
function initCountdown() {
  document.querySelectorAll('.countdown').forEach(el => {
    const storageKey = 'chromaone_countdown_end';
    const hours = parseInt(el.dataset.hours || 24, 10);
    let endTime = localStorage.getItem(storageKey);
    if (!endTime || Date.now() > parseInt(endTime, 10)) {
      endTime = Date.now() + hours * 3600000;
      localStorage.setItem(storageKey, endTime);
    }
    const h = el.querySelector('[data-hours]'), m = el.querySelector('[data-minutes]'), s = el.querySelector('[data-seconds]');
    const tick = () => {
      const diff = Math.max(0, parseInt(endTime, 10) - Date.now());
      if (h) h.textContent = String(Math.floor(diff / 3600000)).padStart(2, '0');
      if (m) m.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      if (s) s.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    };
    tick();
    setInterval(tick, 1000);
  });
}

/* ── Mobile nav ─────────────────────────────────────────── */
function initMobileNav() {
  const hamburger = document.querySelector('.header__hamburger');
  const nav = document.getElementById('mobile-nav');
  const overlay = document.querySelector('.mobile-nav__overlay');
  const closeBtn = document.querySelector('.mobile-nav__close');
  if (!hamburger || !nav) return;
  const open = () => { nav.classList.add('open'); overlay && overlay.classList.add('open'); hamburger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; };
  const close = () => { nav.classList.remove('open'); overlay && overlay.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  hamburger.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  overlay && overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
}

/* ── Product gallery (thumbs left) ──────────────────────── */
function initShopGallery() {
  const gallery = document.querySelector('.shop-gallery');
  if (!gallery) return;
  const slides = gallery.querySelectorAll('.shop-gallery__slide');
  const thumbs = gallery.querySelectorAll('.shop-gallery__thumb');
  const activate = id => {
    slides.forEach(s => s.classList.toggle('active', s.dataset.mediaId === id));
    thumbs.forEach(t => t.classList.toggle('active', t.dataset.mediaId === id));
  };
  thumbs.forEach(t => t.addEventListener('click', () => activate(t.dataset.mediaId)));
}

/* ── Bundle selector ────────────────────────────────────── */
function initBundle() {
  const form = document.getElementById('product-form');
  if (!form) return;
  const options = form.querySelectorAll('.bundle__option');
  if (!options.length) return;
  const qtyInput = ensureQtyInput(form);

  const select = (opt) => {
    options.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    const qty = parseInt(opt.dataset.bundleQty || 1, 10);
    qtyInput.value = qty;
  };

  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.preventDefault();
      select(opt);
    });
  });
  // ensure preselected has correct qty
  const pre = form.querySelector('.bundle__option.selected');
  if (pre) qtyInput.value = parseInt(pre.dataset.bundleQty || 1, 10);
}

function ensureQtyInput(form) {
  let input = form.querySelector('input[name="quantity"]');
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'quantity';
    input.value = '1';
    form.appendChild(input);
  }
  return input;
}

/* ── Variant selects (dropdowns) ────────────────────────── */
function initVariantSelects() {
  const form = document.getElementById('product-form');
  if (!form) return;
  const json = document.getElementById('product-variants-json');
  if (!json) return;
  let variants;
  try { variants = JSON.parse(json.textContent); } catch { return; }
  const selects = form.querySelectorAll('.shop-variant__select');
  if (!selects.length) return;
  const variantInput = document.getElementById('product-variant-id');
  const atc = document.getElementById('product-atc-btn');

  const update = () => {
    const chosen = [...selects].map(s => s.value);
    const v = variants.find(variant => {
      return chosen.every((val, i) => variant['option' + (i + 1)] === val);
    });
    if (v && variantInput) {
      variantInput.value = v.id;
      if (atc) { atc.disabled = !v.available; atc.textContent = v.available ? 'AJOUTER AU PANIER' : 'ÉPUISÉ'; }
    }
  };
  selects.forEach(s => s.addEventListener('change', update));
}

/* ── Reviews carousel (arrows) ──────────────────────────── */
function initReviewsCarousel() {
  document.querySelectorAll('[data-reviews-carousel]').forEach(carousel => {
    const track = carousel.querySelector('[data-reviews-track]');
    const prev = carousel.querySelector('[data-reviews-prev]');
    const next = carousel.querySelector('[data-reviews-next]');
    if (!track) return;
    const card = track.firstElementChild;
    const gap = parseFloat(getComputedStyle(track).gap) || 16;
    const step = card ? card.offsetWidth + gap : 300;
    prev && prev.addEventListener('click', () => track.scrollBy({ left: -step, behavior: 'smooth' }));
    next && next.addEventListener('click', () => track.scrollBy({ left: step, behavior: 'smooth' }));
  });
}

/* ── Cart quantity (cart page) ──────────────────────────── */
function initCartQty() {
  document.querySelectorAll('[data-cart-qty-increment], [data-cart-qty-decrement]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cartQtyIncrement || btn.dataset.cartQtyDecrement;
      const input = document.querySelector(`[data-cart-qty-input="${key}"]`);
      if (!input) return;
      let val = parseInt(input.value, 10);
      val = btn.dataset.cartQtyIncrement ? val + 1 : Math.max(0, val - 1);
      input.value = val;
    });
  });
  document.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(`[data-cart-qty-input="${btn.dataset.cartRemove}"]`);
      if (input) { input.value = 0; input.closest('form') && input.closest('form').submit(); }
    });
  });
}
