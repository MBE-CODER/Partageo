/* =====================================================================
   core.js — Socle commun de Partageo
   ---------------------------------------------------------------------
   Toute l'appli vit dans un seul objet global « Partageo » (noté P dans
   chaque fichier).

   Pourquoi pas des modules ES (import / export) ? Parce que Chrome les
   bloque quand on ouvre index.html par double-clic (protocole file://).
   Les scripts classiques, chargés dans l'ordre, marchent partout.
   ===================================================================== */
window.Partageo = window.Partageo || {};

(function (P) {
  'use strict';

  /** Identifiant court et unique, ex. uid('g') → "g_lq3k9x2a7f". */
  P.uid = function (prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /** Texte normalisé pour comparer : minuscules, sans accents ni espaces en trop.
      "  Maârif " → "maarif" */
  P.normalize = function (str) {
    return String(str == null ? '' : str)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
  };

  /** Date du jour au format AAAA-MM-JJ, en heure locale (et non UTC). */
  P.today = function () {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  /** Accord simple : plural(3, 'personne', 'personnes') → "3 personnes". */
  P.plural = function (n, one, many) {
    return n + ' ' + (n > 1 ? many : one);
  };

  /** Nombre à la française : 0.5 → "0,5". */
  P.fmtNum = function (n) {
    return String(Math.round(n * 100) / 100).replace('.', ',');
  };

  /** "2026-10-28" → "Aujourd'hui", "Hier" ou "Mardi 28 octobre". */
  P.formatDay = function (iso) {
    const p = String(iso).split('-').map(Number);
    const date = new Date(p[0], p[1] - 1, p[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - date) / 86400000);
    if (diff === 0) return 'Aujourd\'hui';
    if (diff === 1) return 'Hier';
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    if (date.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    const txt = date.toLocaleDateString('fr-FR', opts);
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };

  /** Catégories de dépenses (l'id est enregistré, le libellé est affiché). */
  P.CATEGORIES = [
    { id: 'resto', label: 'Restauration', icon: '🍽️' },
    { id: 'courses', label: 'Courses', icon: '🛒' },
    { id: 'transport', label: 'Transport', icon: '🚗' },
    { id: 'logement', label: 'Logement', icon: '🏠' },
    { id: 'hebergement', label: 'Hébergement', icon: '🏨' },
    { id: 'loisirs', label: 'Loisirs', icon: '🎟️' },
    { id: 'cadeaux', label: 'Cadeaux', icon: '🎁' },
    { id: 'autre', label: 'Autre', icon: '📦' }
  ];

  P.category = function (id) {
    return P.CATEGORIES.find(function (c) { return c.id === id; }) || P.CATEGORIES[P.CATEGORIES.length - 1];
  };

  /* -------------------------------------------------------------------
     Mini-cadre de tests, utilisable dans la console du navigateur (F12) :
         Partageo.tests.run()
     Chaque fichier enregistre ses tests avec Partageo.tests.add(...).
     ------------------------------------------------------------------- */
  const suites = [];

  P.tests = {
    add: function (name, fn) {
      suites.push({ name: name, fn: fn });
    },

    run: function () {
      let ok = 0;
      let ko = 0;

      suites.forEach(function (suite) {
        const t = {
          // Compare deux valeurs (même structure JSON)
          eq: function (actual, expected, msg) {
            const a = JSON.stringify(actual);
            const e = JSON.stringify(expected);
            if (a === e) {
              ok++;
            } else {
              ko++;
              console.error('✗ [' + suite.name + '] ' + msg + '\n   attendu : ' + e + '\n   obtenu  : ' + a);
            }
          },
          // Vérifie qu'une condition est vraie
          ok: function (cond, msg) {
            t.eq(!!cond, true, msg);
          }
        };

        try {
          suite.fn(t);
        } catch (err) {
          ko++;
          console.error('✗ [' + suite.name + '] erreur inattendue', err);
        }
      });

      const resume = ko === 0
        ? '✅ ' + ok + ' vérifications réussies'
        : '❌ ' + ko + ' échec(s), ' + ok + ' réussite(s)';
      console.log('%c' + resume, 'font-weight:bold;font-size:14px');
      return ko === 0;
    }
  };
})(window.Partageo);
