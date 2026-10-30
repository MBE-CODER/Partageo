/* =====================================================================
   split.js — Calcul de la part de chacun dans une dépense
   ---------------------------------------------------------------------
   4 modes de répartition :
     equal   : parts égales entre les bénéficiaires
     weight  : selon des poids (couple = 2, enfant = 0,5…)
     exact   : montants exacts saisis (en centimes), somme = total
     percent : pourcentages saisis, somme = 100 %
   Aucun lien avec l'affichage : tout est testable dans la console.
   ===================================================================== */
(function (P) {
  'use strict';

  const MAX_AMOUNT = 100000000 * 100; // 100 millions de DH : au-delà, c'est sûrement une faute de frappe

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  /**
   * Calcule la part de chaque bénéficiaire.
   *   amount  : total en centimes
   *   split   : { mode, beneficiaries: [ids], values: { id: valeur } }
   *   members : les membres du groupe (leur ORDRE sert à départager les centimes)
   * Renvoie { shares: { id: centimes }, error: texte ou null, remaining: nombre }
   *   remaining = ce qu'il reste à répartir (centimes en mode exact, centièmes de % en mode percent)
   */
  function compute(amount, split, members) {
    const values = split.values || {};
    // On suit l'ordre du groupe → résultat identique quel que soit l'ordre des cases cochées
    const ids = members
      .map(function (m) { return m.id; })
      .filter(function (id) { return split.beneficiaries.indexOf(id) !== -1; });

    const result = { shares: {}, error: null, remaining: 0 };
    if (ids.length === 0) {
      result.error = 'Choisis au moins une personne concernée.';
      return result;
    }

    let parts;

    if (split.mode === 'exact') {
      parts = ids.map(function (id) { return Math.max(0, Math.round(values[id] || 0)); });
      result.remaining = amount - sum(parts);
      if (result.remaining > 0) {
        result.error = 'Il reste ' + P.money.format(result.remaining) + ' à répartir.';
      } else if (result.remaining < 0) {
        result.error = 'Les montants dépassent le total de ' + P.money.format(-result.remaining) + '.';
      }
    } else if (split.mode === 'percent') {
      const pcts = ids.map(function (id) { return Math.max(0, Number(values[id]) || 0); });
      const totalPct = Math.round(sum(pcts) * 100); // en centièmes de % (100 % → 10000)
      result.remaining = 10000 - totalPct;
      if (result.remaining !== 0) {
        result.error = 'Les pourcentages font ' + P.fmtNum(totalPct / 100) + ' % au lieu de 100 %.';
        // Aperçu approximatif pendant la saisie
        parts = pcts.map(function (p) { return Math.round(amount * p / 100); });
      } else {
        parts = P.money.allocate(amount, pcts);
      }
    } else if (split.mode === 'weight') {
      const weights = ids.map(function (id) {
        const m = members.find(function (x) { return x.id === id; });
        const v = values[id] != null ? Number(values[id]) : m.weight;
        return Math.max(0, v || 0);
      });
      if (sum(weights) <= 0) {
        result.error = 'Donne au moins une part à quelqu\'un.';
        parts = weights.map(function () { return 0; });
      } else {
        parts = P.money.allocate(amount, weights);
      }
    } else {
      // equal (mode par défaut)
      parts = P.money.allocate(amount, ids.map(function () { return 1; }));
    }

    ids.forEach(function (id, i) { result.shares[id] = parts[i]; });
    return result;
  }

  /**
   * Vérifie une dépense complète avant de l'enregistrer.
   * Renvoie null si tout va bien, sinon { error, field } (field = où mettre le focus).
   */
  function validate(expense, group) {
    if (!Number.isInteger(expense.amount) || expense.amount <= 0) {
      return { error: 'Indique un montant supérieur à 0.', field: 'amount' };
    }
    if (expense.amount > MAX_AMOUNT) {
      return { error: 'Ce montant semble bien grand… Vérifie la saisie.', field: 'amount' };
    }
    if (!group.members.some(function (m) { return m.id === expense.payerId; })) {
      return { error: 'Qui a payé ? Choisis le payeur.', field: 'payer' };
    }
    const r = compute(expense.amount, expense.split, group.members);
    if (r.error) return { error: r.error, field: 'split' };
    return null;
  }

  /** Parts d'une dépense enregistrée (raccourci). */
  function sharesOf(expense, group) {
    return compute(expense.amount, expense.split, group.members).shares;
  }

  P.split = { compute: compute, validate: validate, sharesOf: sharesOf };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('split', function (t) {
    const members = [
      { id: 'a', name: 'Youssef', weight: 1 },
      { id: 'b', name: 'Sara', weight: 2 },
      { id: 'c', name: 'Omar', weight: 0.5 }
    ];
    const tous = ['a', 'b', 'c'];

    t.eq(compute(10000, { mode: 'equal', beneficiaries: tous }, members).shares,
      { a: 3334, b: 3333, c: 3333 }, 'égal : 100 DH pour 3');

    t.eq(compute(10000, { mode: 'equal', beneficiaries: ['c', 'a', 'b'] }, members).shares,
      { a: 3334, b: 3333, c: 3333 }, 'égal : l\'ordre des cases ne change rien');

    t.eq(compute(35000, { mode: 'weight', beneficiaries: tous, values: {} }, members).shares,
      { a: 10000, b: 20000, c: 5000 }, 'parts : poids des membres par défaut');

    const ex = compute(10000, { mode: 'exact', beneficiaries: ['a', 'b'], values: { a: 7000, b: 3000 } }, members);
    t.eq([ex.shares, ex.error], [{ a: 7000, b: 3000 }, null], 'montants exacts corrects');

    const exKo = compute(10000, { mode: 'exact', beneficiaries: ['a', 'b'], values: { a: 7000, b: 2000 } }, members);
    t.eq(exKo.remaining, 1000, 'montants exacts : il manque 10 DH');
    t.ok(exKo.error, 'montants exacts incomplets → erreur');

    const pc = compute(10000, { mode: 'percent', beneficiaries: tous, values: { a: 50, b: 25, c: 25 } }, members);
    t.eq([pc.shares, pc.error], [{ a: 5000, b: 2500, c: 2500 }, null], 'pourcentages 50/25/25');

    const pc3 = compute(100, { mode: 'percent', beneficiaries: tous, values: { a: 33.33, b: 33.33, c: 33.34 } }, members);
    t.eq(sum(Object.values(pc3.shares)), 100, 'pourcentages décimaux : somme = total');

    t.ok(compute(10000, { mode: 'percent', beneficiaries: tous, values: { a: 50, b: 40 } }, members).error,
      'pourcentages ≠ 100 → erreur');

    t.ok(compute(10000, { mode: 'equal', beneficiaries: [] }, members).error, 'aucun bénéficiaire → erreur');

    const g = { members: members };
    t.eq(validate({ amount: 0, payerId: 'a', split: { mode: 'equal', beneficiaries: tous } }, g).field, 'amount', 'montant 0 refusé');
    t.eq(validate({ amount: 500, payerId: '', split: { mode: 'equal', beneficiaries: tous } }, g).field, 'payer', 'payeur obligatoire');
    t.eq(validate({ amount: 500, payerId: 'a', split: { mode: 'equal', beneficiaries: tous } }, g), null, 'dépense valide');
  });
})(window.Partageo);
