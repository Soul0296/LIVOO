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