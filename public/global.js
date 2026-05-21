/* ============================================================
   LIVOO — global.js (version corrigée)
   Thème, langue, menu burger, animations
   ============================================================ */

// ── 1. THÈME ─────────────────────────────────────────────────
function getTheme() {
  return localStorage.getItem('livoo_theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('livoo_theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── 2. LANGUE ────────────────────────────────────────────────
function getLang() {
  return localStorage.getItem('livoo_lang') || 'fr';
}

function applyLang(lang) {
  localStorage.setItem('livoo_lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-fr]').forEach(el => {
    const text = lang === 'fr' ? el.getAttribute('data-fr') : el.getAttribute('data-en');
    if (text !== null) el.innerHTML = text;
  });

  document.querySelectorAll('[data-fr-placeholder]').forEach(el => {
    el.placeholder = lang === 'fr'
      ? el.getAttribute('data-fr-placeholder')
      : el.getAttribute('data-en-placeholder');
  });

  const btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = lang === 'fr' ? 'EN' : 'FR';
}

function toggleLang() {
  const current = getLang();
  applyLang(current === 'fr' ? 'en' : 'fr');
}

// ── 3. MENU BURGER ────────────────────────────────────────────
function toggleMenu() {
  const nav = document.getElementById('navLinks');
  const overlay = document.getElementById('nav-overlay');
  if (!nav) return;
  const isOpen = nav.classList.toggle('show');
  if (overlay) overlay.classList.toggle('show', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMenu() {
  const nav = document.getElementById('navLinks');
  const overlay = document.getElementById('nav-overlay');
  if (nav) nav.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// ── 4. ANIMATIONS SCROLL ─────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.anim').forEach(el => observer.observe(el));
}

// ── 5. INITIALISATION ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getTheme());
  applyLang(getLang());
  initScrollAnimations();

  // Fermer menu en cliquant sur un lien
  document.querySelectorAll('#navLinks a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });
});

// ── 6. API LIVOO ─────────────────────────────────────────────
async function livooApi(path, options = {}) {
  const token = localStorage.getItem('livoo_token');
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Erreur Livoo');
  }
  return data;
}

function saveLivooSession(data) {
  if (data.token) localStorage.setItem('livoo_token', data.token);
  if (data.user) {
    localStorage.setItem('livoo_user', JSON.stringify(data.user));
    localStorage.setItem('userConnected', 'true');
    localStorage.setItem('userPhone', data.user.telephone || '');
    localStorage.setItem('userRole', data.user.role || '');
  }
}

function getLivooUser() {
  try {
    return JSON.parse(localStorage.getItem('livoo_user') || 'null');
  } catch (_error) {
    return null;
  }
}

function clearLivooSession() {
  localStorage.removeItem('livoo_token');
  localStorage.removeItem('livoo_user');
  localStorage.removeItem('userConnected');
  localStorage.removeItem('userPhone');
  localStorage.removeItem('userRole');
}
