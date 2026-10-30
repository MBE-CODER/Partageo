/* =====================================================================
   settle.js — Soldes et remboursements optimisés
   ---------------------------------------------------------------------
   1. Solde de chacun :
        solde = ce qu'il a payé − sa part des dépenses
              + remboursements envoyés − remboursements reçus
      Solde > 0 : on lui doit de l'argent.  Solde < 0 : il doit de l'argent.
      La somme de tous les soldes vaut toujours 0.

   2. Qui rembourse qui, avec le moins de virements possible :
      a) d'abord les « paires exactes » (Omar doit 90, Sara attend 90 → 1 virement) ;
      b) puis la méthode gloutonne : le plus gros débiteur rembourse le plus
         gros créancier, et on recommence.
      Résultat : au plus (nombre de personnes − 1) virements.

      Compromis : trouver le minimum ABSOLU est un problème très coûteux
      (NP-difficile). Cette méthode donne le minimum dans la grande majorité
      des cas réels, instantanément.

   Tests dans la console : Partageo.tests.run()
   ===================================================================== */
(function (P) {
  'use strict';

  /**
   * Soldes de chaque membre du groupe.
   * Renvoie { id: { paid, owed, sent, received, net } } (tout en centimes).
   */
  function balances(group) {
    const b = {};
    group.members.forEach(function (m) {
      b[m.id] = { paid: 0, owed: 0, sent: 0, received: 0, net: 0 };
    });

    group.expenses.forEach(function (e) {
      if (b[e.payerId]) b[e.payerId].paid += e.amount;
      const shares = P.split.sharesOf(e, group);
      Object.keys(shares).forEach(function (id) {
        if (b[id]) b[id].owed += shares[id];
      });
    });

    group.settlements.forEach(function (s) {
      if (b[s.fromId]) b[s.fromId].sent += s.amount;
      if (b[s.toId]) b[s.toId].received += s.amount;
    });

    Object.keys(b).forEach(function (id) {
      const x = b[id];
      x.net = x.paid - x.owed + x.sent - x.received;
    });
    return b;
  }

  /**
   * Liste minimale de virements pour remettre tout le monde à zéro.
   *   nets  : { id: solde en centimes }
   *   order : ordre des membres (pour départager les égalités → résultat stable)
   * Renvoie [{ fromId, toId, amount }]
   */
  function settle(nets, order) {
    order = order || Object.keys(nets);
    const rank = function (id) { return order.indexOf(id); };

    let debtors = order
      .filter(function (id) { return nets[id] < 0; })
      .map(function (id) { return { id: id, amt: -nets[id] }; });
    let creditors = order
      .filter(function (id) { return nets[id] > 0; })
      .map(function (id) { return { id: id, amt: nets[id] }; });

    const transfers = [];

    // a) Paires exactes : un seul virement règle deux personnes d'un coup
    debtors.forEach(function (d) {
      const c = creditors.find(function (x) { return x.amt > 0 && x.amt === d.amt; });
      if (c) {
        transfers.push({ fromId: d.id, toId: c.id, amount: d.amt });
        c.amt = 0;
        d.amt = 0;
      }
    });

    // b) Méthode gloutonne : plus gros débiteur → plus gros créancier
    const biggestFirst = function (a, b) { return b.amt - a.amt || rank(a.id) - rank(b.id); };
    for (;;) {
      debtors = debtors.filter(function (x) { return x.amt > 0; }).sort(biggestFirst);
      creditors = creditors.filter(function (x) { return x.amt > 0; }).sort(biggestFirst);
      if (!debtors.length || !creditors.length) break;

      const d = debtors[0];
      const c = creditors[0];
      const amount = Math.min(d.amt, c.amt);
      transfers.push({ fromId: d.id, toId: c.id, amount: amount });
      d.amt -= amount;
      c.amt -= amount;
    }
    return transfers;
  }

  /** Raccourci : les virements à faire pour un groupe. */
  function transfersFor(group) {
    const b = balances(group);
    const nets = {};
    Object.keys(b).forEach(function (id) { nets[id] = b[id].net; });
    return settle(nets, group.members.map(function (m) { return m.id; }));
  }

  P.settle = { balances: balances, settle: settle, transfersFor: transfersFor };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('settle', function (t) {
    // Applique des virements à des soldes et vérifie que tout revient à 0
    function apply(nets, transfers) {
      const n = Object.assign({}, nets);
      transfers.forEach(function (tr) { n[tr.fromId] += tr.amount; n[tr.toId] -= tr.amount; });
      return Object.keys(n).every(function (id) { return n[id] === 0; });
    }

    t.eq(settle({ a: 5000, b: -5000 }), [{ fromId: 'b', toId: 'a', amount: 5000 }], '2 personnes : 1 virement');

    t.eq(settle({ a: 0, b: 0 }), [], 'tout le monde à zéro : aucun virement');

    // A a payé 300 DH pour 3 → B et C lui doivent 100 chacun
    t.eq(settle({ a: 20000, b: -10000, c: -10000 }, ['a', 'b', 'c']),
      [{ fromId: 'b', toId: 'a', amount: 10000 }, { fromId: 'c', toId: 'a', amount: 10000 }],
      '1 payeur pour 3');

    // Paires exactes : 3 virements, alors que la méthode gloutonne seule en ferait 4
    // (c→a 40, d→b 30, puis e doit payer à la fois a et b)
    const nets = { a: 5000, b: 4000, c: -4000, d: -3000, e: -2000 };
    const tr = settle(nets, ['a', 'b', 'c', 'd', 'e']);
    t.ok(apply(nets, tr), 'paires exactes : soldes remis à zéro');
    t.eq(tr.length, 3, 'paires exactes : 3 virements au lieu de 4');

    // 300 cas aléatoires : tout revient à zéro, au plus n−1 virements
    let allZero = true;
    let maxOk = true;
    for (let k = 0; k < 300; k++) {
      const n = 2 + Math.floor(Math.random() * 8);
      const ids = Array.from({ length: n }, function (_, i) { return 'm' + i; });
      const rnd = {};
      let total = 0;
      ids.slice(1).forEach(function (id) {
        rnd[id] = Math.floor(Math.random() * 200001) - 100000;
        total += rnd[id];
      });
      rnd[ids[0]] = -total; // la somme vaut 0
      const res = settle(rnd, ids);
      if (!apply(rnd, res)) allZero = false;
      if (res.length > n - 1) maxOk = false;
    }
    t.ok(allZero, 'aléatoire : soldes toujours remis à zéro (300 cas)');
    t.ok(maxOk, 'aléatoire : jamais plus de n−1 virements');

    // Groupe complet : dépenses + remboursement déjà effectué
    const g = {
      members: [{ id: 'y', name: 'Youssef', weight: 1 }, { id: 's', name: 'Sara', weight: 2 }, { id: 'o', name: 'Omar', weight: 1 }],
      expenses: [
        { amount: 40000, payerId: 'y', split: { mode: 'weight', beneficiaries: ['y', 's', 'o'], values: { y: 1, s: 2, o: 1 } } },
        { amount: 10001, payerId: 's', split: { mode: 'equal', beneficiaries: ['y', 's', 'o'] } }
      ],
      settlements: [{ fromId: 'o', toId: 'y', amount: 5000 }]
    };
    const b = balances(g);
    t.eq(b.y.net + b.s.net + b.o.net, 0, 'groupe : somme des soldes = 0');
    t.eq(b.y.net, 40000 - 10000 - 3334 - 5000, 'groupe : solde de Youssef');
    const nets2 = { y: b.y.net, s: b.s.net, o: b.o.net };
    t.ok(apply(nets2, transfersFor(g)), 'groupe : les virements proposés soldent tout');
  });
})(window.Partageo);
