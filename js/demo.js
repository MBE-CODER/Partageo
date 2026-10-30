/* =====================================================================
   demo.js — Groupe de démonstration « Voyage Chefchaouen »
   ---------------------------------------------------------------------
   4 participants : Youssef (moi), un couple qui compte pour 2, une maman
   avec son enfant qui comptent pour 1,5 (1 + 0,5), et Mehdi ;
   10 dépenses utilisant les 4 modes de répartition, 1 remboursement.
   Les dates sont relatives à aujourd'hui : la démo a toujours l'air récente.
   Aucun numéro de téléphone : on ne risque pas d'écrire à un inconnu.
   ===================================================================== */
(function (P) {
  'use strict';

  /** Date d'il y a n jours, au format AAAA-MM-JJ. */
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Construit le groupe complet (sans l'enregistrer). */
  function build() {
    const y = P.uid('m');   // Youssef (moi)
    const so = P.uid('m');  // Sara & Omar (couple : 2 parts)
    const ka = P.uid('m');  // Kenza & Adam (maman + enfant : 1,5 part)
    const m = P.uid('m');   // Mehdi
    const tous = [y, so, ka, m];

    // Raccourci pour écrire une dépense en une ligne
    let n = 0;
    function exp(jour, title, dh, payer, category, mode, beneficiaries, values) {
      n++;
      return {
        id: P.uid('e'),
        title: title,
        amount: P.money.parse(dh),
        payerId: payer,
        date: daysAgo(jour),
        category: category,
        split: { mode: mode, beneficiaries: beneficiaries, values: values || {} },
        // createdAt croissant : garde l'ordre de saisie à l'intérieur d'une journée
        createdAt: new Date(Date.now() - (100 - n) * 60000).toISOString()
      };
    }
    const poids = {};
    poids[y] = 1; poids[so] = 2; poids[ka] = 1.5; poids[m] = 1;

    const courses = {};
    courses[y] = 8000; courses[so] = 15240; courses[ka] = 5000; courses[m] = 3000; // 312,40 DH au total

    const tapis = {};
    tapis[ka] = 50; tapis[y] = 25; tapis[so] = 25;

    return {
      id: P.uid('g'),
      name: 'Voyage Chefchaouen',
      emoji: '🏔️',
      color: '#5B8DEF',
      currency: 'MAD',
      createdAt: new Date().toISOString(),
      meId: y,
      members: [
        { id: y, name: 'Youssef', weight: 1, phone: '' },
        { id: so, name: 'Sara & Omar', weight: 2, phone: '' },
        { id: ka, name: 'Kenza & Adam', weight: 1.5, phone: '' },
        { id: m, name: 'Mehdi', weight: 1, phone: '' }
      ],
      expenses: [
        exp(3, 'Essence aller', '450', y, 'transport', 'weight', tous, poids),
        exp(3, 'Péage autoroute', '87,50', y, 'transport', 'weight', tous, poids),
        exp(3, 'Riad 2 nuits', '1800', so, 'hebergement', 'weight', tous, poids),
        exp(3, 'Tajine et thé à la menthe', '365', ka, 'resto', 'weight', tous, poids),
        exp(2, 'Petit-déjeuner au riad', '120', m, 'resto', 'weight', tous, poids),
        exp(2, 'Courses Marjane', '312,40', so, 'courses', 'exact', tous, courses),
        exp(2, 'Guide randonnée Akchour', '400', y, 'loisirs', 'equal', [y, so, m]),
        exp(1, 'Petit taxi médina', '40', so, 'transport', 'equal', [so, ka]),
        exp(1, 'Tapis souvenir', '600', ka, 'cadeaux', 'percent', [ka, y, so], tapis),
        exp(0, 'Glaces', '45', m, 'resto', 'equal', [ka, m])
      ],
      settlements: [
        { id: P.uid('s'), fromId: m, toId: y, amount: 10000, date: daysAgo(1), createdAt: new Date().toISOString() }
      ]
    };
  }

  /** Ajoute le groupe de démo en tête de liste et renvoie son id. */
  function create() {
    const g = build();
    P.store.insertGroup(g);
    return g.id;
  }

  P.demo = { build: build, create: create };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('demo', function (t) {
    const g = build();
    const invalid = g.expenses.filter(function (e) { return P.split.validate(e, g) !== null; });
    t.eq(invalid.map(function (e) { return e.title; }), [], 'toutes les dépenses de la démo sont valides');

    const modes = {};
    g.expenses.forEach(function (e) { modes[e.split.mode] = true; });
    t.eq(Object.keys(modes).sort(), ['equal', 'exact', 'percent', 'weight'], 'la démo utilise les 4 modes');

    const b = P.settle.balances(g);
    const somme = Object.keys(b).reduce(function (s, id) { return s + b[id].net; }, 0);
    t.eq(somme, 0, 'démo : somme des soldes = 0');
  });
})(window.Partageo);
