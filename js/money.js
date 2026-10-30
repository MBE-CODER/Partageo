/* =====================================================================
   money.js — L'argent, toujours en centimes (nombres entiers)
   ---------------------------------------------------------------------
   Pourquoi des centimes ? En JavaScript, 0.1 + 0.2 = 0.30000000000000004.
   En comptant en entiers (450,00 DH → 45000), aucune erreur d'arrondi
   n'est possible.
   ===================================================================== */
(function (P) {
  'use strict';

  // Espace insécable : "1 234,50 DH" n'est jamais coupé en fin de ligne.
  const NBSP = ' ';

  /**
   * Transforme une saisie en centimes. Renvoie NaN si la saisie est invalide.
   *   "1 234,50" → 123450   "85.5" → 8550   "450 dh" → 45000   "1.200" → 120000
   */
  function parse(input) {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? Math.round(input * 100) : NaN;
    }

    const s = String(input == null ? '' : input).toLowerCase()
      .replace(/dirhams?|dhs?|mad/g, '')   // on retire l'unité
      .replace(/[\s  ]/g, '');    // et toutes les espaces
    if (!s) return NaN;

    // Le DERNIER point ou la dernière virgule est le séparateur décimal.
    // Les autres sont des séparateurs de milliers ("1.234,50").
    const decPos = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    let intPart = s;
    let fracPart = '';
    if (decPos !== -1) {
      intPart = s.slice(0, decPos).replace(/[.,]/g, '');
      fracPart = s.slice(decPos + 1);
    }

    // Exactement 3 chiffres après le séparateur : c'est un séparateur de milliers ("1.200" = 1200)
    if (fracPart.length === 3) {
      intPart += fracPart;
      fracPart = '';
    }

    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return NaN;
    if (intPart === '' && fracPart === '') return NaN;
    if (fracPart.length > 2) return NaN;

    return parseInt(intPart || '0', 10) * 100 + parseInt((fracPart + '00').slice(0, 2), 10);
  }

  /**
   * Affiche des centimes au format marocain : 123450 → "1 234,50 DH".
   * Options : unit (afficher "DH", oui par défaut), sign (afficher "+" devant les positifs).
   */
  function format(cents, opts) {
    const o = Object.assign({ unit: true, sign: false }, opts);
    const abs = Math.abs(Math.round(cents || 0));
    const entier = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    const decimales = String(abs % 100).padStart(2, '0');

    let txt = entier + ',' + decimales;
    if (o.unit) txt += NBSP + 'DH';
    if (cents < 0) txt = '−' + txt;
    else if (o.sign && abs > 0) txt = '+' + txt;
    return txt;
  }

  /** Centimes → texte pour un champ de saisie : 123450 → "1234,50", 45000 → "450". */
  function toInput(cents) {
    if (!cents) return '';
    const e = Math.floor(cents / 100);
    const d = cents % 100;
    return d ? e + ',' + String(d).padStart(2, '0') : String(e);
  }

  /**
   * Répartit un total (en centimes) selon des poids, au centime près.
   *   allocate(10000, [1, 1, 1]) → [3334, 3333, 3333]
   *
   * Méthode du « plus grand reste » :
   *  1. chacun reçoit la partie entière de sa part ;
   *  2. les centimes restants vont, un par un, à ceux qui ont le plus grand
   *     reste ; en cas d'égalité, au premier dans l'ordre de la liste.
   * Résultat : toujours le même pour les mêmes données (déterministe), et
   * la somme des parts est TOUJOURS égale au total.
   */
  function allocate(total, weights) {
    if (total < 0) return allocate(-total, weights).map(function (x) { return -x; });

    // Les poids peuvent être décimaux (0,5) : on les passe en entiers (×100)
    const w = weights.map(function (x) { return Math.max(0, Math.round((Number(x) || 0) * 100)); });
    const W = w.reduce(function (a, b) { return a + b; }, 0);
    if (W === 0 || !Number.isInteger(total)) return w.map(function () { return 0; });

    const parts = [];
    const restes = [];
    w.forEach(function (wi) {
      const a = total * wi;
      let q = Math.floor(a / W);
      // Petite sécurité contre les imprécisions de la division
      while (q * W > a) q--;
      while ((q + 1) * W <= a) q++;
      parts.push(q);
      restes.push(a - q * W);
    });

    let reste = total - parts.reduce(function (a, b) { return a + b; }, 0);
    const ordre = w.map(function (_, i) { return i; })
      .sort(function (i, j) { return restes[j] - restes[i] || i - j; });
    for (let k = 0; reste > 0; k++) {
      parts[ordre[k]] += 1;
      reste--;
    }
    return parts;
  }

  P.money = { parse: parse, format: format, toInput: toInput, allocate: allocate };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('money', function (t) {
    t.eq(parse('1 234,50'), 123450, 'parse avec espace et virgule');
    t.eq(parse('85.5'), 8550, 'parse avec point');
    t.eq(parse('450dh'), 45000, 'parse avec unité collée');
    t.eq(parse('1.200'), 120000, 'parse séparateur de milliers');
    t.eq(parse('0,1'), 10, 'parse 0,1');
    t.ok(Number.isNaN(parse('abc')), 'parse texte invalide → NaN');
    t.ok(Number.isNaN(parse('')), 'parse vide → NaN');

    t.eq(format(123450), '1 234,50 DH', 'format avec milliers');
    t.eq(format(-500), '−5,00 DH', 'format négatif');
    t.eq(format(500, { sign: true }), '+5,00 DH', 'format avec signe');

    t.eq(allocate(10000, [1, 1, 1]), [3334, 3333, 3333], '100 DH pour 3');
    t.eq(allocate(100, [2, 1, 0.5]), [57, 29, 14], 'poids 2 / 1 / 0,5');
    t.eq(allocate(1, [1, 1]), [1, 0], 'le centime va au premier en cas d\'égalité');

    // Somme toujours égale au total, sur 200 cas aléatoires
    let toutBon = true;
    for (let i = 0; i < 200; i++) {
      const total = Math.floor(Math.random() * 1000000) + 1;
      const poids = Array.from({ length: 1 + Math.floor(Math.random() * 8) },
        function () { return (1 + Math.floor(Math.random() * 6)) / 2; });
      const somme = allocate(total, poids).reduce(function (a, b) { return a + b; }, 0);
      if (somme !== total) toutBon = false;
    }
    t.ok(toutBon, 'somme des parts = total (200 cas aléatoires)');
  });
})(window.Partageo);
