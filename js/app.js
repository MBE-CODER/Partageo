/* =====================================================================
   app.js — Écrans, navigation et événements
   ---------------------------------------------------------------------
   Navigation par « hash » dans l'adresse (fonctionne en double-clic) :
     #/                      → accueil (mes groupes)
     #/g/<id>/depenses       → un groupe, onglet Dépenses
     #/g/<id>/soldes         → onglet Soldes
     #/g/<id>/rembourser     → onglet Rembourser
   Chaque changement redessine l'écran depuis les données (simple et fiable).
   ===================================================================== */
(function (P) {
  'use strict';

  const esc = P.ui.esc;
  const app = document.getElementById('app');

  const EMOJIS = ['🏔️', '🏖️', '🏠', '✈️', '🚗', '🍽️', '🎉', '⛺', '🐪', '🕌', '🎂', '⚽', '🛒', '💼', '🎓', '❤️'];
  const COLORS = [
    { v: '#3E9C8F', n: 'Menthe' }, { v: '#5B8DEF', n: 'Bleu' },
    { v: '#E0795B', n: 'Corail' }, { v: '#D9A441', n: 'Safran' },
    { v: '#9B7BD4', n: 'Lavande' }, { v: '#D96C9B', n: 'Rose' },
    { v: '#6A9F4E', n: 'Olive' }, { v: '#6B7A8F', n: 'Ardoise' }
  ];
  const TABS = [
    { id: 'depenses', label: 'Dépenses', icon: '🧾' },
    { id: 'soldes', label: 'Soldes', icon: '⚖️' },
    { id: 'rembourser', label: 'Rembourser', icon: '🤝' }
  ];

  const fmtWeight = P.fmtNum; // 0.5 → "0,5"

  /* ============================== Navigation ============================== */

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'g' && parts[1]) {
      const tab = TABS.some(function (t) { return t.id === parts[2]; }) ? parts[2] : 'depenses';
      return { name: 'group', id: parts[1], tab: tab };
    }
    // Lien de partage reçu : #/import/<données du groupe>
    if (parts[0] === 'import' && parts[1]) return { name: 'import', payload: parts[1] };
    return { name: 'home' };
  }

  /** Va vers une adresse ; redessine même si on y est déjà. */
  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    const route = parseRoute();
    if (route.name === 'group') {
      const g = P.store.group(route.id);
      if (!g) return navigate('#/');
      P.store.setLastGroup(g.id);
      renderGroup(g, route.tab);
    } else if (route.name === 'import') {
      P.groupShare.renderImport(app, route.payload);
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  /* ============================== Accueil ============================== */

  function renderHome() {
    document.title = 'Partageo';
    const groups = P.store.groups();

    const content = P.pwa.installHint() + (groups.length
      ? '<h1 class="page-title">Mes groupes</h1>' +
        '<ul class="group-list" role="list">' + groups.map(groupCard).join('') + '</ul>' +
        '<button type="button" class="btn btn-soft btn-block" data-action="new-group">＋ Nouveau groupe</button>' +
        '<button type="button" class="btn btn-link btn-block" data-action="demo">✨ Ajouter le groupe de démonstration</button>'
      : homeEmpty());

    app.innerHTML =
      '<header class="topbar">' +
        '<span class="brand"><span class="brand-logo" aria-hidden="true">🤝</span>Partageo</span>' +
        '<button type="button" class="icon-btn topbar-end" data-action="backup" aria-label="Sauvegarde : exporter ou importer">💾</button>' +
      '</header>' +
      '<main class="page" id="main">' + content +
        '<p class="footer-links"><a href="confidentialite.html">Confidentialité</a></p>' +
      '</main>';
  }

  function homeEmpty() {
    return '' +
      '<section class="empty empty-hero">' +
        '<div class="empty-illus" aria-hidden="true"><span>🍽️</span><span>🚕</span><span>🏠</span></div>' +
        '<h1>Bienvenue sur Partageo&nbsp;!</h1>' +
        '<p>Partage les dépenses entre amis, en famille ou en coloc, sans prise de tête. ' +
        'Chacun sait qui doit quoi, en quelques secondes.</p>' +
        '<div class="hero-actions">' +
          '<button type="button" class="btn btn-primary btn-lg" data-action="new-group">Créer mon premier groupe</button>' +
          '<button type="button" class="btn btn-soft" data-action="demo">✨ Essayer avec un exemple</button>' +
        '</div>' +
        '<p class="small muted">🔒 Tes données restent sur ton téléphone.</p>' +
      '</section>';
  }

  function groupCard(g) {
    const total = g.expenses.reduce(function (s, e) { return s + e.amount; }, 0);

    // Ma situation dans ce groupe (si « C'est moi » est défini)
    let status = '';
    if (g.meId && g.expenses.length) {
      const net = P.settle.balances(g)[g.meId].net;
      status = net > 0 ? '<span class="group-status pos">On te doit ' + P.money.format(net) + '</span>'
        : net < 0 ? '<span class="group-status neg">Tu dois ' + P.money.format(-net) + '</span>'
        : '<span class="group-status">Tu es à jour ✓</span>';
    }

    return '' +
      '<li><a class="group-card" href="#/g/' + g.id + '" style="--g:' + g.color + '">' +
        '<span class="group-emoji" aria-hidden="true">' + esc(g.emoji) + '</span>' +
        '<span class="group-info">' +
          '<span class="group-name">' + esc(g.name) + '</span>' +
          '<span class="group-meta">' + P.plural(g.members.length, 'personne', 'personnes') +
            ' · ' + P.money.format(total) + '</span>' +
          status +
        '</span>' +
        '<span class="chev" aria-hidden="true">›</span>' +
      '</a></li>';
  }

  /* ============================== Groupe ============================== */

  function renderGroup(g, tab) {
    document.title = g.name + ' · Partageo';
    app.innerHTML =
      '<header class="topbar topbar-group" style="--g:' + g.color + '">' +
        '<a class="icon-btn" href="#/" aria-label="Retour à mes groupes">‹</a>' +
        '<h1 class="topbar-title"><span class="topbar-emoji" aria-hidden="true">' + esc(g.emoji) + '</span>' +
          '<span class="truncate">' + esc(g.name) + '</span></h1>' +
        '<button type="button" class="icon-btn icon-btn-share" data-action="share-group" aria-label="Partager le groupe">📤</button>' +
        '<button type="button" class="icon-btn" data-action="edit-group" aria-label="Modifier le groupe">✎</button>' +
      '</header>' +
      '<main class="page with-tabbar" id="main">' +
        membersStrip(g) +
        tabContent(g, tab) +
      '</main>' +
      '<button type="button" class="fab" data-action="add-expense" aria-label="Ajouter une dépense">' +
        '<span aria-hidden="true">+</span></button>' +
      tabbar(g, tab);
  }

  /** Bandeau des participants (avec leurs parts si ≠ 1). */
  function membersStrip(g) {
    const chips = g.members.map(function (m) {
      const isMe = m.id === g.meId;
      return '<li class="chip' + (isMe ? ' chip-me' : '') + '">' +
        esc(m.name) +
        (isMe ? ' <span class="chip-tag">moi</span>' : '') +
        (m.weight !== 1 ? ' <span class="chip-badge" title="Compte pour ' + fmtWeight(m.weight) + ' part(s)">×' + fmtWeight(m.weight) + '</span>' : '') +
      '</li>';
    }).join('');
    return '<ul class="members-strip" role="list" aria-label="Participants">' + chips + '</ul>';
  }

  function tabContent(g, tab) {
    if (tab === 'soldes') return balancesView(g);
    if (tab === 'rembourser') return settleView(g);
    return expensesView(g);
  }

  /** Prénom d'un membre, ou « Toi » si c'est moi. */
  function nameOf(g, id) {
    if (id === g.meId) return 'Toi';
    const m = g.members.find(function (x) { return x.id === id; });
    return m ? m.name : '?';
  }

  /* ---------------------------- Onglet Soldes ---------------------------- */

  function balancesView(g) {
    if (!g.expenses.length) {
      return '<section class="empty"><div class="empty-icon" aria-hidden="true">⚖️</div>' +
        '<h2>Tout le monde est à zéro</h2><p>Les soldes apparaîtront dès la première dépense.</p></section>';
    }

    const b = P.settle.balances(g);
    const max = Math.max(1, Math.max.apply(null, g.members.map(function (m) { return Math.abs(b[m.id].net); })));
    // Les créanciers en haut, les débiteurs en bas
    const sorted = g.members.slice().sort(function (x, y) { return b[y.id].net - b[x.id].net; });

    const rows = sorted.map(function (m, i) {
      const x = b[m.id];
      const isMe = m.id === g.meId;
      const cls = x.net > 0 ? 'pos' : x.net < 0 ? 'neg' : 'zero';
      const status = x.net > 0 ? (isMe ? 'on te doit' : 'on lui doit')
        : x.net < 0 ? (isMe ? 'tu dois' : 'doit')
        : 'à l\'équilibre';
      // La barre fait au plus la moitié de la piste (gauche = doit, droite = on lui doit)
      const width = Math.round(Math.abs(x.net) / max * 50);

      return '' +
        '<li class="bal-row ' + cls + '" style="animation-delay:' + (i * 40) + 'ms">' +
          '<div class="bal-head">' +
            '<span class="bal-name">' + esc(m.name) + (isMe ? ' <span class="chip-tag">moi</span>' : '') + '</span>' +
            '<span class="bal-amount">' + P.money.format(x.net, { sign: true }) + '</span>' +
          '</div>' +
          '<div class="bal-track" aria-hidden="true"><span class="bal-bar" style="width:' + width + '%"></span></div>' +
          '<div class="bal-detail"><strong>' + status + '</strong> · a payé ' + P.money.format(x.paid) +
            ' · sa part ' + P.money.format(x.owed) + '</div>' +
        '</li>';
    }).join('');

    return myStatusCard(g, b) +
      '<ul class="bal-list" role="list">' + rows + '</ul>' +
      '<p class="hint bal-legend"><span class="dot neg"></span> doit de l\'argent ' +
      '<span class="dot pos"></span> on lui doit de l\'argent</p>';
  }

  /** Bandeau « Tu dois… / On te doit… » en haut des soldes. */
  function myStatusCard(g, b) {
    if (!g.meId || !b[g.meId]) return '';
    const net = b[g.meId].net;
    let txt;
    let cls;
    if (net > 0) { txt = 'On te doit <strong>' + P.money.format(net) + '</strong>'; cls = 'pos'; }
    else if (net < 0) { txt = 'Tu dois <strong>' + P.money.format(-net) + '</strong>'; cls = 'neg'; }
    else { txt = 'Tu es à jour 👌'; cls = 'zero'; }
    return '<section class="my-status ' + cls + '">' + txt + '</section>';
  }

  /* --------------------------- Onglet Rembourser --------------------------- */

  function settleView(g) {
    if (!g.expenses.length) {
      return '<section class="empty"><div class="empty-icon" aria-hidden="true">🤝</div>' +
        '<h2>Rien à rembourser</h2><p>Ajoute des dépenses : on calculera qui doit rembourser qui.</p></section>';
    }

    const transfers = P.settle.transfersFor(g);
    let html;

    if (!transfers.length) {
      html = '<section class="empty empty-success"><div class="empty-icon" aria-hidden="true">🎉</div>' +
        '<h2>Tout est réglé&nbsp;!</h2><p>Personne ne doit rien à personne.</p></section>';
    } else {
      html = '<p class="hint intro">' + (transfers.length === 1 ? 'Un seul virement suffit' :
        P.plural(transfers.length, 'virement', 'virements') + ' suffisent') + ' pour que tout le monde soit quitte.</p>' +
        '<ul class="transfer-list" role="list">' + transfers.map(function (tr, i) {
          return '' +
            '<li class="transfer-card" style="animation-delay:' + (i * 50) + 'ms">' +
              '<div class="transfer-line">' +
                '<span class="transfer-who">' +
                  '<strong>' + esc(nameOf(g, tr.fromId)) + '</strong>' +
                  '<span class="transfer-arrow" aria-hidden="true">→</span><span class="sr-only"> rembourse </span>' +
                  '<strong>' + esc(nameOf(g, tr.toId)) + '</strong>' +
                '</span>' +
                '<span class="transfer-amount">' + P.money.format(tr.amount) + '</span>' +
              '</div>' +
              '<div class="transfer-actions">' +
                reminderButton(g, tr) +
                '<button type="button" class="btn btn-soft" data-action="mark-paid" aria-label="Marquer comme remboursé"' +
                  ' data-from="' + tr.fromId + '" data-to="' + tr.toId + '" data-amount="' + tr.amount + '">' +
                  '<span aria-hidden="true">✓</span> Remboursé</button>' +
              '</div>' +
            '</li>';
        }).join('') + '</ul>';
    }

    const recap =
      '<a class="btn btn-wa btn-block recap-btn" href="' + esc(P.share.recapLink(g)) + '" target="_blank" rel="noopener">' +
        '<span aria-hidden="true">💬</span> Envoyer le récap sur WhatsApp</a>';

    return recap + html + settlementsHistory(g);
  }

  /** Bouton « Rappel » (pas de rappel à soi-même). */
  function reminderButton(g, tr) {
    if (tr.fromId === g.meId) return '';
    const debtor = g.members.find(function (m) { return m.id === tr.fromId; });
    const hasPhone = debtor && P.share.normalizePhone(debtor.phone);
    return '<a class="btn btn-wa-soft" href="' + esc(P.share.reminderLink(g, tr)) + '" target="_blank" rel="noopener"' +
      ' aria-label="Envoyer un rappel WhatsApp à ' + esc(debtor ? debtor.name : '') + '"' +
      (hasPhone ? '' : ' title="Pas de numéro enregistré : WhatsApp te demandera de choisir le contact"') + '>' +
      '<span aria-hidden="true">💬</span> Rappel</a>';
  }

  /** Historique des remboursements déjà faits (le plus récent en haut). */
  function settlementsHistory(g) {
    if (!g.settlements.length) return '';
    const items = g.settlements.slice().reverse().map(function (s) {
      return '' +
        '<li class="history-item">' +
          '<span class="history-icon" aria-hidden="true">✓</span>' +
          '<span class="expense-info">' +
            '<span class="expense-title">' + esc(nameOf(g, s.fromId)) + ' → ' + esc(nameOf(g, s.toId)) + '</span>' +
            '<span class="expense-meta">' + P.formatDay(s.date) + '</span>' +
          '</span>' +
          '<span class="expense-amount">' + P.money.format(s.amount) + '</span>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="remove-settlement" data-id="' + s.id + '"' +
            ' aria-label="Supprimer ce remboursement">✕</button>' +
        '</li>';
    }).join('');
    return '<h2 class="day-title">Remboursements effectués</h2><ul class="history-list" role="list">' + items + '</ul>';
  }

  /* --------------------------- Onglet Dépenses --------------------------- */

  function expensesView(g) {
    if (!g.expenses.length) return quickBar(g) + expensesEmpty(g);

    const total = g.expenses.reduce(function (s, e) { return s + e.amount; }, 0);

    // Tri : la plus récente en haut (date, puis heure de saisie)
    const sorted = g.expenses.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt));
    });

    // Regroupement par jour
    let html = '';
    let currentDay = null;
    sorted.forEach(function (e) {
      if (e.date !== currentDay) {
        if (currentDay !== null) html += '</ul>';
        currentDay = e.date;
        html += '<h2 class="day-title">' + P.formatDay(e.date) + '</h2><ul class="expense-list" role="list">';
      }
      html += expenseItem(g, e);
    });
    html += '</ul>';

    return quickBar(g) +
      '<section class="summary-card" style="--g:' + g.color + '">' +
        '<div><span class="summary-label">Total dépensé</span>' +
        '<strong class="summary-value">' + P.money.format(total) + '</strong></div>' +
        '<span class="summary-side">' + P.plural(g.expenses.length, 'dépense', 'dépenses') + '</span>' +
      '</section>' + html;
  }

  /* ----------------------- Saisie en langage naturel ----------------------- */

  /** Barre « écris ta dépense en une phrase ». */
  function quickBar(g) {
    if (!g.members.length) return '';
    const first = g.members[0].name.split(/\s/)[0];
    return '' +
      '<form class="quick" id="quick-form" autocomplete="off">' +
        '<label for="quick-input" class="sr-only">Écris ta dépense en une phrase</label>' +
        '<span class="quick-icon" aria-hidden="true">✨</span>' +
        '<input id="quick-input" class="quick-input" type="text" enterkeyhint="go" spellcheck="false"' +
          ' placeholder="Ex. : ' + esc(first) + ' 450 resto pour tous" aria-describedby="quick-preview">' +
        '<button type="submit" class="quick-go" aria-label="Préparer la dépense">→</button>' +
      '</form>' +
      '<p class="quick-preview" id="quick-preview" aria-live="polite"></p>';
  }

  /** Ce que l'appli a compris, en clair : « Youssef a payé 450,00 DH · 🍽️ Resto · pour tous ». */
  function quickPreview(g, r) {
    const payerId = r.payerId || g.meId;
    const missing = function (txt) { return '<span class="quick-missing">' + txt + '</span>'; };
    const cat = P.category(r.category);

    const who = !payerId ? missing('qui a payé ?')
      : payerId === g.meId ? 'Tu as payé' : esc(nameOf(g, payerId)) + ' a payé';
    const amount = r.amount ? '<strong>' + P.money.format(r.amount) + '</strong>' : missing('montant ?');
    const forTxt = r.beneficiaries.length ? esc(forWhom(g, r.beneficiaries)) : missing('pour qui ?');

    return '<span aria-hidden="true">💡</span> ' + who + ' ' + amount +
      ' · <span aria-hidden="true">' + cat.icon + '</span> ' + esc(r.title || cat.label) + ' · ' + forTxt;
  }

  // Aperçu en direct pendant la frappe
  app.addEventListener('input', function (e) {
    if (e.target.id !== 'quick-input') return;
    const g = P.store.group(parseRoute().id);
    const text = e.target.value.trim();
    app.querySelector('#quick-preview').innerHTML = text ? quickPreview(g, P.parser.parse(text, g)) : '';
  });

  // Entrée → formulaire pré-rempli, à vérifier et confirmer
  app.addEventListener('submit', function (e) {
    if (e.target.id !== 'quick-form') return;
    e.preventDefault();
    const g = P.store.group(parseRoute().id);
    const text = app.querySelector('#quick-input').value.trim();
    if (!text) return P.expenseForm.open(g);

    const r = P.parser.parse(text, g);
    P.expenseForm.open(g, {
      prefill: {
        title: r.title,
        amount: r.amount,
        payerId: r.payerId,
        category: r.category,
        split: { beneficiaries: r.beneficiaries }
      },
      // Tout est compris → le bouton « Ajouter » a le focus : un second Entrée suffit
      focusSubmit: !!(r.amount && (r.payerId || g.meId) && r.beneficiaries.length)
    });
  });

  /** "pour tous", "pour Sara", "pour Sara et Omar", "pour 3 personnes". */
  function forWhom(g, ids) {
    if (ids.length === g.members.length && ids.length > 1) return 'pour tous';
    const names = ids.map(function (id) {
      const m = g.members.find(function (x) { return x.id === id; });
      return m ? m.name : '?';
    });
    if (names.length <= 2) return 'pour ' + names.join(' et ');
    return 'pour ' + names.length + ' personnes';
  }

  function expenseItem(g, e) {
    const cat = P.category(e.category);
    const payer = g.members.find(function (m) { return m.id === e.payerId; });
    const payerTxt = e.payerId === g.meId ? 'toi' : (payer ? payer.name : '?');

    // « ta part » : ce que la dépense me coûte, si je suis concerné
    let myPart = '';
    if (g.meId && e.split.beneficiaries.indexOf(g.meId) !== -1) {
      const share = P.split.sharesOf(e, g)[g.meId];
      if (share != null) myPart = '<span class="expense-part">ta part ' + P.money.format(share) + '</span>';
    }

    return '' +
      '<li><button type="button" class="expense-item" data-action="edit-expense" data-id="' + e.id + '">' +
        '<span class="expense-icon" aria-hidden="true">' + cat.icon + '</span>' +
        '<span class="expense-info">' +
          '<span class="expense-title">' + esc(e.title) + '</span>' +
          '<span class="expense-meta">Payé par ' + esc(payerTxt) + ' · ' + esc(forWhom(g, e.split.beneficiaries)) + '</span>' +
        '</span>' +
        '<span class="expense-amounts">' +
          '<span class="expense-amount">' + P.money.format(e.amount) + '</span>' + myPart +
        '</span>' +
      '</button></li>';
  }

  function expensesEmpty(g) {
    const first = g.members[0] ? esc(g.members[0].name) : 'Youssef';
    return '' +
      '<section class="empty">' +
        '<div class="empty-icon" aria-hidden="true">🧾</div>' +
        '<h2>Aucune dépense pour l\'instant</h2>' +
        '<p>Écris-la en une phrase juste au-dessus, ou utilise le bouton <strong>+</strong>. Par exemple&nbsp;:</p>' +
        '<button type="button" class="example-card" data-action="example-expense">' +
          '<span class="expense-icon" aria-hidden="true">🍽️</span>' +
          '<span class="expense-info"><span class="expense-title">Resto</span>' +
          '<span class="expense-meta">Payé par ' + first + ' · pour tous</span></span>' +
          '<span class="expense-amount">450,00&nbsp;DH</span>' +
        '</button>' +
        '<p class="small">Touche l\'exemple pour l\'essayer.</p>' +
      '</section>';
  }

  function tabbar(g, current) {
    return '<nav class="tabbar" aria-label="Sections du groupe">' + TABS.map(function (t) {
      const active = t.id === current;
      return '<a class="tab' + (active ? ' active' : '') + '" href="#/g/' + g.id + '/' + t.id + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        '<span class="tab-icon" aria-hidden="true">' + t.icon + '</span>' + t.label + '</a>';
    }).join('') + '</nav>';
  }

  /* ======================= Formulaire de groupe ======================= */

  function newMember() {
    return { id: P.uid('m'), name: '', weight: 1, phone: '' };
  }

  function memberRow(m, meId, index) {
    return '' +
      '<li class="member-row" data-id="' + m.id + '">' +
        '<div class="member-main">' +
          '<input class="input member-name" type="text" maxlength="24" autocomplete="off" enterkeyhint="next"' +
            ' aria-label="Prénom" placeholder="' + (index === 0 ? 'Ton prénom' : 'Prénom') + '" value="' + esc(m.name) + '">' +
          '<div class="stepper" role="group" aria-label="Nombre de parts">' +
            '<button type="button" class="step" data-act="dec" aria-label="Moins de parts">−</button>' +
            '<output class="step-val" data-weight="' + m.weight + '">' + fmtWeight(m.weight) + '</output>' +
            '<button type="button" class="step" data-act="inc" aria-label="Plus de parts">+</button>' +
          '</div>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-act="remove-member" aria-label="Retirer ce participant">✕</button>' +
        '</div>' +
        '<div class="member-extra">' +
          '<input class="input input-sm member-phone" type="tel" inputmode="tel" autocomplete="off"' +
            ' placeholder="WhatsApp (facultatif)" aria-label="Numéro WhatsApp (facultatif)" value="' + esc(m.phone || '') + '">' +
          '<label class="me-toggle"><input type="radio" name="me" value="' + m.id + '"' +
            (m.id === meId ? ' checked' : '') + '> C\'est moi</label>' +
        '</div>' +
      '</li>';
  }

  function groupFormHtml(d, isNew) {
    const emojis = EMOJIS.map(function (em) {
      return '<label class="choice choice-emoji"><input type="radio" name="emoji" value="' + em + '"' +
        (em === d.emoji ? ' checked' : '') + '><span>' + em + '</span></label>';
    }).join('');

    const colors = COLORS.map(function (c) {
      return '<label class="choice choice-color"><input type="radio" name="color" value="' + c.v + '"' +
        (c.v === d.color ? ' checked' : '') + '><span style="--c:' + c.v + '"><span class="sr-only">' + c.n + '</span></span></label>';
    }).join('');

    return '' +
      '<form class="form" id="group-form" novalidate>' +
        '<div class="field">' +
          '<label for="g-name">Nom du groupe</label>' +
          '<input id="g-name" name="name" class="input" type="text" maxlength="40" autocomplete="off"' +
            ' placeholder="Ex. : Voyage Chefchaouen" value="' + esc(d.name) + '"' + (isNew ? ' autofocus' : '') + '>' +
        '</div>' +
        '<fieldset class="field"><legend>Emoji</legend><div class="choice-grid">' + emojis + '</div></fieldset>' +
        '<fieldset class="field"><legend>Couleur</legend><div class="choice-row">' + colors + '</div></fieldset>' +
        '<fieldset class="field">' +
          '<legend>Participants</legend>' +
          '<p class="hint">Les <strong>parts</strong> servent à répartir équitablement : 2 pour un couple, 0,5 pour un enfant.</p>' +
          '<ul class="member-list" id="member-list" role="list">' +
            d.members.map(function (m, i) { return memberRow(m, d.meId, i); }).join('') +
          '</ul>' +
          '<button type="button" class="btn btn-soft" data-act="add-member">＋ Ajouter une personne</button>' +
        '</fieldset>' +
        '<p class="form-error" id="g-error" role="alert"></p>' +
        '<div class="sheet-actions">' +
          (isNew ? '' : '<button type="button" class="btn btn-danger-ghost" data-act="delete-group">Supprimer</button>') +
          '<button type="submit" class="btn btn-primary btn-grow">' + (isNew ? 'Créer le groupe' : 'Enregistrer') + '</button>' +
        '</div>' +
      '</form>';
  }

  /** Ouvre le formulaire : sans argument → création, avec un groupe → modification. */
  function openGroupForm(group) {
    const isNew = !group;
    const draft = group
      ? JSON.parse(JSON.stringify(group))
      : { name: '', emoji: EMOJIS[0], color: COLORS[0].v, members: [newMember(), newMember(), newMember()], meId: null };
    if (isNew) draft.meId = draft.members[0].id; // la première ligne, c'est « moi » par défaut

    P.ui.openDialog({
      title: isNew ? 'Nouveau groupe' : 'Modifier le groupe',
      html: groupFormHtml(draft, isNew),
      onMount: function (dlg, close) {
        const form = dlg.querySelector('#group-form');
        const list = form.querySelector('#member-list');
        const errorBox = form.querySelector('#g-error');

        function addRow() {
          const m = newMember();
          list.insertAdjacentHTML('beforeend', memberRow(m, null, list.children.length));
          list.lastElementChild.querySelector('.member-name').focus();
        }

        // Boutons à l'intérieur du formulaire (délégation d'événements)
        form.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (!btn) return;
          const row = btn.closest('.member-row');

          if (btn.dataset.act === 'add-member') addRow();

          if (btn.dataset.act === 'dec' || btn.dataset.act === 'inc') {
            const out = row.querySelector('.step-val');
            let w = parseFloat(out.dataset.weight);
            w = btn.dataset.act === 'inc' ? Math.min(20, w + 0.5) : Math.max(0.5, w - 0.5);
            out.dataset.weight = w;
            out.textContent = fmtWeight(w);
          }

          if (btn.dataset.act === 'remove-member') {
            if (group && P.store.memberInUse(group, row.dataset.id)) {
              const name = row.querySelector('.member-name').value || 'Cette personne';
              P.ui.toast(name + ' apparaît dans des dépenses : impossible de la retirer.');
              return;
            }
            // Le focus va sur la ligne suivante (ou le bouton d'ajout) pour ne pas « se perdre »
            const next = row.nextElementSibling || row.previousElementSibling;
            row.remove();
            (next ? next.querySelector('.member-name') : form.querySelector('[data-act="add-member"]')).focus();
          }

          if (btn.dataset.act === 'delete-group') {
            close();
            deleteGroup(group);
          }
        });

        // Entrée dans un prénom → ligne suivante (ou nouvelle ligne), sans valider le formulaire
        form.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' || !e.target.classList.contains('member-name')) return;
          e.preventDefault();
          const row = e.target.closest('.member-row');
          if (row.nextElementSibling) row.nextElementSibling.querySelector('.member-name').focus();
          else if (e.target.value.trim()) addRow();
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          const result = readGroupForm(form, group);
          if (result.error) {
            errorBox.textContent = result.error;
            if (result.field) result.field.focus();
            return;
          }
          if (isNew) {
            const g = P.store.createGroup(result.data);
            close();
            navigate('#/g/' + g.id);
            P.ui.toast('Groupe créé 🎉');
          } else {
            P.store.updateGroup(group.id, result.data);
            close();
            render();
            P.ui.toast('Modifications enregistrées');
          }
        });
      }
    });
  }

  /** Lit et valide le formulaire de groupe. Renvoie { data } ou { error, field }. */
  function readGroupForm(form, group) {
    const nameInput = form.querySelector('#g-name');
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    if (!name) return { error: 'Donne un nom à ton groupe.', field: nameInput };

    const members = [];
    const seen = {};
    const rows = Array.prototype.slice.call(form.querySelectorAll('.member-row'));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const input = row.querySelector('.member-name');
      const mName = input.value.trim().replace(/\s+/g, ' ');

      if (!mName) {
        // Une ligne vide est ignorée… sauf si la personne a déjà des dépenses
        if (group && P.store.memberInUse(group, row.dataset.id)) {
          return { error: 'Chaque personne qui a des dépenses doit garder un prénom.', field: input };
        }
        continue;
      }

      const key = P.normalize(mName);
      if (seen[key]) return { error: '« ' + mName + ' » apparaît deux fois. Ajoute une initiale pour les distinguer.', field: input };
      seen[key] = true;

      members.push({
        id: row.dataset.id,
        name: mName,
        weight: parseFloat(row.querySelector('.step-val').dataset.weight),
        phone: row.querySelector('.member-phone').value.trim()
      });
    }

    if (members.length === 0) {
      return { error: 'Ajoute au moins une personne.', field: form.querySelector('.member-name') };
    }

    const meInput = form.querySelector('input[name="me"]:checked');
    const meId = meInput && members.some(function (m) { return m.id === meInput.value; }) ? meInput.value : null;

    return {
      data: {
        name: name,
        emoji: form.querySelector('input[name="emoji"]:checked').value,
        color: form.querySelector('input[name="color"]:checked').value,
        members: members,
        meId: meId
      }
    };
  }

  function deleteGroup(g) {
    const snapshot = P.store.removeGroup(g.id);
    navigate('#/');
    P.ui.toast('Groupe « ' + g.name + ' » supprimé', {
      actionLabel: 'Annuler',
      duration: 5000,
      onAction: function () {
        P.store.restoreGroup(snapshot);
        navigate('#/g/' + g.id);
      }
    });
  }

  /* ============================== Actions ============================== */
  // Tous les boutons de l'écran ont un attribut data-action ; un seul écouteur suffit.

  const actions = {
    'new-group': function () { openGroupForm(); },
    'edit-group': function () { openGroupForm(P.store.group(parseRoute().id)); },

    'backup': function () { P.backup.open(); },
    'share-group': function () { P.groupShare.open(P.store.group(parseRoute().id)); },
    'demo': function () {
      const id = P.demo.create();
      navigate('#/g/' + id);
      P.ui.toast('Voici un exemple : explore, modifie, supprime sans crainte 🙂', { duration: 5000 });
    },

    'install': function () { P.pwa.install(); },
    'dismiss-install': function () { P.pwa.dismiss(); },

    'add-expense': function () {
      const g = P.store.group(parseRoute().id);
      if (!g.members.length) return P.ui.toast('Ajoute d\'abord des participants avec ✎');
      P.expenseForm.open(g);
    },

    'edit-expense': function (btn) {
      const g = P.store.group(parseRoute().id);
      const e = g.expenses.find(function (x) { return x.id === btn.dataset.id; });
      if (e) P.expenseForm.open(g, { expense: e });
    },

    'mark-paid': function (btn) {
      const g = P.store.group(parseRoute().id);
      const s = P.store.addSettlement(g.id, {
        fromId: btn.dataset.from,
        toId: btn.dataset.to,
        amount: parseInt(btn.dataset.amount, 10),
        date: P.today()
      });
      render();
      P.ui.toast('Remboursement enregistré 👍', {
        actionLabel: 'Annuler',
        duration: 5000,
        onAction: function () {
          P.store.removeSettlement(g.id, s.id);
          render();
        }
      });
    },

    'remove-settlement': function (btn) {
      const g = P.store.group(parseRoute().id);
      const snapshot = P.store.removeSettlement(g.id, btn.dataset.id);
      render();
      P.ui.toast('Remboursement supprimé', {
        actionLabel: 'Annuler',
        duration: 5000,
        onAction: function () {
          P.store.restore(snapshot);
          render();
        }
      });
    },

    // L'exemple de l'état vide : formulaire pré-rempli, il n'y a plus qu'à valider
    'example-expense': function () {
      const g = P.store.group(parseRoute().id);
      if (!g.members.length) return;
      P.expenseForm.open(g, {
        prefill: { title: 'Resto', amount: 45000, category: 'resto', payerId: g.members[0].id }
      });
    }
  };

  app.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn, e);
  });

  /* ============================== Démarrage ============================== */

  P.store.load();

  // Ouverture de l'appli sans adresse précise → on rouvre le dernier groupe (gain de temps)
  if (!location.hash) {
    const last = P.store.settings().lastGroupId;
    if (last && P.store.group(last)) location.replace('#/g/' + last);
  }

  window.addEventListener('hashchange', render);

  // Si l'appli est ouverte dans deux onglets, on garde les deux à jour
  window.addEventListener('storage', function (e) {
    if (e.key === P.store.KEY) { P.store.load(); render(); }
  });

  window.addEventListener('partageo:save-error', function () {
    P.ui.toast('Impossible d\'enregistrer : la mémoire du navigateur est peut-être pleine.', { duration: 6000 });
  });

  render();

  P.app = { render: render, navigate: navigate };
})(window.Partageo);
