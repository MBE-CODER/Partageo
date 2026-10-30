/* =====================================================================
   share.js — Messages WhatsApp (récap du groupe, rappels polis)
   ---------------------------------------------------------------------
   On utilise les liens officiels wa.me :
     https://wa.me/212612345678?text=...  → ouvre la conversation avec ce numéro
     https://wa.me/?text=...              → WhatsApp demande de choisir le contact
   Aucun serveur : le message part depuis le téléphone de l'utilisateur.
   ===================================================================== */
(function (P) {
  'use strict';

  /**
   * Numéro au format international sans « + » (format attendu par wa.me).
   *   "06 12 34 56 78" → "212612345678"   "+212 6…" → "212612345678"
   *   "0033 6 12 34 56 78" → "33612345678"  Renvoie "" si le numéro semble invalide.
   */
  function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);                       // 00212… → 212…
    if (d.length === 10 && d[0] === '0') d = '212' + d.slice(1);       // 06… (Maroc) → 2126…
    if (d.length === 9 && /^[5-7]/.test(d)) d = '212' + d;             // 6… sans le 0
    return d.length >= 10 && d.length <= 15 ? d : '';
  }

  function waLink(text, phone) {
    const num = normalizePhone(phone);
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }

  function member(group, id) {
    return group.members.find(function (m) { return m.id === id; }) || { name: '?', phone: '' };
  }

  /** Récap complet du groupe : total, soldes, virements à faire. */
  function recapMessage(group) {
    const fmt = P.money.format;
    const total = group.expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    const b = P.settle.balances(group);
    const transfers = P.settle.transfersFor(group);
    const lines = [];

    lines.push(group.emoji + ' *' + group.name + '* — le récap');
    lines.push('');
    lines.push('💰 Total dépensé : *' + fmt(total) + '* (' + P.plural(group.expenses.length, 'dépense', 'dépenses') + ')');
    lines.push('');
    lines.push('⚖️ *Soldes*');
    group.members.slice()
      .sort(function (x, y) { return b[y.id].net - b[x.id].net; })
      .forEach(function (m) {
        lines.push('• ' + m.name + ' : ' + fmt(b[m.id].net, { sign: true }));
      });
    lines.push('');

    if (transfers.length) {
      lines.push('🤝 *Pour être quittes*');
      transfers.forEach(function (t) {
        lines.push('• ' + member(group, t.fromId).name + ' → ' + member(group, t.toId).name + ' : ' + fmt(t.amount));
      });
    } else {
      lines.push('✅ Tout est réglé, personne ne doit rien à personne !');
    }
    lines.push('');
    lines.push('Merci à tous 🙏');
    return lines.join('\n');
  }

  /** Rappel poli pour un virement { fromId, toId, amount }. */
  function reminderMessage(group, transfer) {
    const debtor = member(group, transfer.fromId);
    const creditor = member(group, transfer.toId);
    const toMe = transfer.toId === group.meId;

    return 'Salam ' + debtor.name + ' 👋\n' +
      'Petit rappel pour « ' + group.name + ' » : d\'après nos comptes, il te reste *' +
      P.money.format(transfer.amount) + '* à ' + (toMe ? 'me rembourser' : 'rembourser à ' + creditor.name) + '.\n' +
      'Aucune urgence, quand tu peux 🙂 Merci !';
  }

  P.share = {
    normalizePhone: normalizePhone,
    recapLink: function (group) { return waLink(recapMessage(group), ''); },
    reminderLink: function (group, transfer) {
      return waLink(reminderMessage(group, transfer), member(group, transfer.fromId).phone);
    },
    recapMessage: recapMessage,
    reminderMessage: reminderMessage
  };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('share', function (t) {
    t.eq(normalizePhone('06 12 34 56 78'), '212612345678', 'numéro marocain 06…');
    t.eq(normalizePhone('+212 6 12 34 56 78'), '212612345678', 'numéro +212');
    t.eq(normalizePhone('00212612345678'), '212612345678', 'numéro 00212');
    t.eq(normalizePhone('0033612345678'), '33612345678', 'numéro français 0033');
    t.eq(normalizePhone('612345678'), '212612345678', 'numéro sans le 0');
    t.eq(normalizePhone('123'), '', 'numéro trop court → vide');

    const g = {
      name: 'Coloc Maârif', emoji: '🏠', meId: 'y',
      members: [{ id: 'y', name: 'Youssef', weight: 1, phone: '' }, { id: 's', name: 'Sara', weight: 1, phone: '0612345678' }],
      expenses: [{ amount: 20000, payerId: 'y', split: { mode: 'equal', beneficiaries: ['y', 's'] } }],
      settlements: []
    };
    const tr = { fromId: 's', toId: 'y', amount: 10000 };
    t.ok(reminderMessage(g, tr).indexOf('me rembourser') !== -1, 'rappel : « me rembourser » quand c\'est moi le créancier');
    t.ok(P.share.reminderLink(g, tr).indexOf('https://wa.me/212612345678?text=') === 0, 'rappel : lien vers le numéro de Sara');
    t.ok(recapMessage(g).indexOf('Sara → Youssef') !== -1, 'récap : contient le virement');
  });
})(window.Partageo);
