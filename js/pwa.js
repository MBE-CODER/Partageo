/* =====================================================================
   pwa.js — Installation sur l'écran d'accueil et mode hors ligne
   ---------------------------------------------------------------------
   Le service worker et le manifeste ne fonctionnent qu'en http(s) ou
   localhost. En double-clic (file://), on ne les charge pas du tout :
   l'appli marche normalement, sans erreur dans la console.
   ===================================================================== */
(function (P) {
  'use strict';

  const DISMISS_KEY = 'partageo:install-hint-ferme';
  const canPWA = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);

  if (canPWA) {
    // Manifeste ajouté seulement ici (en file://, Chrome afficherait une erreur)
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Partageo : mode hors ligne indisponible', err);
      });
    });
  }

  /* ------------------------- Proposition d'installation ------------------------- */

  let deferredPrompt = null; // fourni par Chrome / Edge / Samsung Internet (Android, ordinateur)

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // on affichera notre propre bouton, plus discret
    deferredPrompt = e;
    if (P.app && location.hash.replace(/^#\/?/, '') === '') P.app.render();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    P.ui.toast('Partageo est installée sur ton écran d\'accueil 🎉');
    if (P.app) P.app.render();
  });

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  /** Carte « Installer Partageo » pour l'accueil (vide si inutile). */
  function installHint() {
    if (!canPWA || isStandalone() || isDismissed()) return '';

    let body;
    if (deferredPrompt) {
      body = '<p>Ajoute Partageo à ton écran d\'accueil : elle s\'ouvre comme une vraie appli, même sans internet.</p>' +
        '<button type="button" class="btn btn-primary" data-action="install">📲 Installer</button>';
    } else if (isIOS) {
      // Safari sur iPhone ne propose pas de bouton : on explique la marche à suivre
      body = '<p>Pour installer Partageo : touche <strong>Partager</strong> <span aria-hidden="true">⬆️</span> ' +
        'puis <strong>« Sur l\'écran d\'accueil »</strong>.</p>';
    } else {
      return '';
    }

    return '<section class="install-card">' + body +
      '<button type="button" class="icon-btn icon-btn-sm install-close" data-action="dismiss-install"' +
      ' aria-label="Masquer ce message">✕</button></section>';
  }

  function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      P.app.render();
    });
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* tant pis */ }
    P.app.render();
  }

  P.pwa = { installHint: installHint, install: install, dismiss: dismiss };
})(window.Partageo);
