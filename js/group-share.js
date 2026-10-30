/* =====================================================================
   group-share.js — Écrans du partage de groupe
   ---------------------------------------------------------------------
   - open(group)               : fenêtre « Partager » (QR code, WhatsApp, copier)
   - renderImport(app, payload): écran affiché à l'ouverture d'un lien reçu
   ===================================================================== */
(function (P) {
  'use strict';

  const esc = P.ui.esc;

  /** Copie dans le presse-papiers (avec une solution de secours hors https). */
  function copyText(text, input) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    input.focus();
    input.select();
    return document.execCommand('copy') ? Promise.resolve() : Promise.reject(new Error('copie refusée'));
  }

  /**
   * Ajuste la taille du QR code pour que chaque module fasse un nombre ENTIER
   * de pixels de l'écran. Sinon, certains modules font 3 pixels et d'autres 4,
   * et la grille irrégulière gêne la lecture par l'appareil photo.
   */
  function fitQr(box, qr) {
    const svg = box.querySelector('svg');
    if (!svg) return;
    const dim = qr.size + 8;                          // modules + marge blanche (4 de chaque côté)
    const dpr = window.devicePixelRatio || 1;          // pixels réels par pixel CSS (3 sur beaucoup de téléphones)
    const avail = Math.min(box.clientWidth - 32, 380); // largeur disponible (moins le padding)
    const perModule = Math.max(1, Math.floor(avail * dpr / dim));
    svg.style.width = (perModule * dim / dpr) + 'px';
  }

  /* ------------------------- Fenêtre « Partager » ------------------------- */

  function open(group) {
    const isLocal = location.protocol === 'file:';
    const canNativeShare = typeof navigator.share === 'function';

    P.ui.openDialog({
      title: 'Partager le groupe',
      html: '' +
        '<div class="share">' +
          '<p>Tes amis scannent le QR code ou ouvrent le lien : ils retrouvent <strong>' + esc(group.name) +
          '</strong> sur leur téléphone. Rien ne passe par un serveur, tout est dans le lien.</p>' +
          (isLocal
            ? '<p class="warn-box">⚠️ Partageo est ouverte depuis un fichier de ton ordinateur : ce lien ne s\'ouvrira pas ' +
              'sur un autre appareil. Ton ami peut quand même le coller dans 💾 → « Ouvrir un lien de partage ». ' +
              'Pour un vrai lien, héberge l\'appli (ex. Netlify).</p>'
            : '') +
          '<div class="qr-box" id="sh-qr"><p class="hint">Préparation du lien…</p></div>' +
          '<label class="check"><input type="checkbox" id="sh-phones"> Inclure les numéros WhatsApp des participants</label>' +
          '<div class="share-actions">' +
            '<a class="btn btn-wa btn-block" id="sh-wa" target="_blank" rel="noopener" href="#">' +
              '<span aria-hidden="true">💬</span> Envoyer le lien sur WhatsApp</a>' +
            '<button type="button" class="btn btn-soft btn-block" data-act="copy">📋 Copier le lien</button>' +
            (canNativeShare ? '<button type="button" class="btn btn-soft btn-block" data-act="native">📤 Autres applis…</button>' : '') +
          '</div>' +
          '<label class="sr-only" for="sh-link">Lien de partage</label>' +
          '<input id="sh-link" class="input input-sm share-link" type="text" readonly>' +
          '<p class="hint" id="sh-size"></p>' +
          '<p class="hint">🔄 Quand un ami ajoute des dépenses, il te renvoie son lien : les deux versions sont ' +
          '<strong>fusionnées</strong>, rien n\'est perdu.</p>' +
        '</div>',

      onMount: function (dlg) {
        const qrBox = dlg.querySelector('#sh-qr');
        const phones = dlg.querySelector('#sh-phones');
        const wa = dlg.querySelector('#sh-wa');
        const linkInput = dlg.querySelector('#sh-link');
        const size = dlg.querySelector('#sh-size');
        const message = 'Rejoins le groupe « ' + group.name + ' » ' + group.emoji + ' sur Partageo pour suivre nos dépenses : ';
        let link = '';
        let version = 0; // ignore les résultats d'un calcul dépassé

        function refresh() {
          const v = ++version;
          P.link.encode(group, phones.checked).then(function (payload) {
            if (v !== version) return;
            link = P.link.url(payload);
            linkInput.value = link;
            wa.href = 'https://wa.me/?text=' + encodeURIComponent(message + link);

            // Niveau L : sur un écran, rien n'est abîmé → des modules plus gros, plus faciles à scanner
            const qr = P.qr.encode(link, 'L');
            qrBox.innerHTML = qr
              ? P.qr.toSvg(qr, { label: 'QR code du groupe ' + group.name }) +
                (qr.version > 22 ? '<p class="hint">QR code très détaillé : approche bien les téléphones, ou envoie plutôt le lien.</p>' : '')
              : '<p class="hint">Ce groupe est trop grand pour un QR code : envoie plutôt le lien 👇</p>';
            if (qr) fitQr(qrBox, qr);
            size.textContent = 'Lien de ' + P.fmtNum(Math.round(link.length / 100) / 10) + ' Ko · ' +
              P.plural(group.expenses.length, 'dépense', 'dépenses') + ' · ' +
              P.plural(group.members.length, 'participant', 'participants');
          });
        }
        phones.addEventListener('change', refresh);
        refresh();

        linkInput.addEventListener('focus', function () { linkInput.select(); });

        dlg.querySelector('.share').addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (!btn || !link) return;
          if (btn.dataset.act === 'copy') {
            copyText(link, linkInput)
              .then(function () { P.ui.toast('Lien copié ✓ Colle-le où tu veux.'); })
              .catch(function () { P.ui.toast('Copie impossible : sélectionne le lien ci-dessous et copie-le.'); });
          }
          if (btn.dataset.act === 'native') {
            navigator.share({ title: 'Partageo · ' + group.name, text: message, url: link }).catch(function () { /* annulé */ });
          }
        });
      }
    });
  }

  /* ------------------------- Ouverture d'un lien reçu ------------------------- */

  function previewHtml(g) {
    const existing = P.store.group(g.id);
    const total = g.expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    const chips = g.members.map(function (m) { return '<li class="chip">' + esc(m.name) + '</li>'; }).join('');

    let action;
    if (existing) {
      action = '' +
        '<section class="note-box"><p><strong>Tu as déjà ce groupe.</strong> Les nouvelles dépenses seront ajoutées, ' +
        'les modifications et les suppressions prises en compte. Rien n\'est perdu de ton côté.</p></section>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-imp="merge">🔄 Mettre à jour mon groupe</button>';
    } else {
      action = '' +
        '<fieldset class="field">' +
          '<legend>Qui es-tu dans ce groupe&nbsp;?</legend>' +
          '<div class="picks">' + g.members.map(function (m) {
            return '<label class="pick"><input type="radio" name="imp-me" value="' + m.id + '"><span>' + esc(m.name) + '</span></label>';
          }).join('') + '</div>' +
          '<p class="hint">Pour afficher « tu dois » ou « on te doit ». Facultatif, modifiable plus tard.</p>' +
        '</fieldset>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-imp="add">Ajouter ce groupe</button>';
    }

    return '' +
      '<section class="import-hero" style="--g:' + g.color + '">' +
        '<span class="import-emoji" aria-hidden="true">' + esc(g.emoji) + '</span>' +
        '<p class="small muted">On t\'a partagé un groupe</p>' +
        '<h1>' + esc(g.name) + '</h1>' +
        '<p>' + P.plural(g.members.length, 'participant', 'participants') + ' · ' +
          P.plural(g.expenses.length, 'dépense', 'dépenses') + ' · ' + P.money.format(total) + '</p>' +
        '<ul class="members-strip members-center" role="list">' + chips + '</ul>' +
      '</section>' +
      '<div class="import-actions">' + action +
        '<a class="btn btn-link btn-block" href="#/">Annuler</a>' +
      '</div>';
  }

  function renderImport(app, payload) {
    document.title = 'Groupe partagé · Partageo';
    app.innerHTML =
      '<header class="topbar">' +
        '<a class="icon-btn" href="#/" aria-label="Annuler et revenir à mes groupes">‹</a>' +
        '<span class="brand"><span class="brand-logo" aria-hidden="true">🤝</span>Partageo</span>' +
      '</header>' +
      '<main class="page" id="main"><section class="empty"><p>Ouverture du groupe partagé…</p></section></main>';
    const main = app.querySelector('#main');
    const stillHere = function () { return location.hash.indexOf(payload) !== -1; };

    P.link.decode(payload).then(function (g) {
      if (!stillHere()) return;
      main.innerHTML = previewHtml(g);

      main.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-imp]');
        if (!btn) return;

        if (btn.dataset.imp === 'add') {
          const me = main.querySelector('input[name="imp-me"]:checked');
          g.meId = me ? me.value : null;
          P.store.insertGroup(g);
          location.replace('#/g/' + g.id); // « Retour » ne réimporte pas le groupe
          P.ui.toast('Groupe ajouté 🎉');
        }

        if (btn.dataset.imp === 'merge') {
          const before = P.store.mergeGroup(g);
          location.replace('#/g/' + g.id);
          P.ui.toast('Groupe mis à jour ✓', {
            actionLabel: 'Annuler',
            duration: 5000,
            onAction: function () {
              P.store.restoreState(before);
              P.app.render();
            }
          });
        }
      });
    }).catch(function (err) {
      if (!stillHere()) return;
      main.innerHTML = '' +
        '<section class="empty">' +
          '<div class="empty-icon" aria-hidden="true">😕</div>' +
          '<h2>Impossible d\'ouvrir ce lien</h2>' +
          '<p>' + esc(err.message) + '</p>' +
          '<a class="btn btn-primary" href="#/">Retour à mes groupes</a>' +
        '</section>';
    });
  }

  P.groupShare = { open: open, renderImport: renderImport };
})(window.Partageo);
