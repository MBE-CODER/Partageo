/* =====================================================================
   backup.js — Sauvegarde : export et import d'un fichier JSON
   ---------------------------------------------------------------------
   Les données vivent uniquement dans le navigateur. Le fichier exporté
   permet de les garder en lieu sûr ou de les passer sur un autre appareil.
   ===================================================================== */
(function (P) {
  'use strict';

  const esc = P.ui.esc;

  /** Fait télécharger un fichier texte au navigateur. */
  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Date ISO complète → "AAAA-MM-JJ" en heure locale. */
  function localDay(iso) {
    const d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function lastExportText() {
    const iso = P.store.settings().lastExport;
    if (!iso) return 'Aucune sauvegarde faite pour l\'instant.';
    return 'Dernière sauvegarde : ' + P.formatDay(localDay(iso)).toLowerCase() + '.';
  }

  function open() {
    P.ui.openDialog({
      title: 'Sauvegarde',
      html: '' +
        '<div class="backup">' +
          '<p>Tes données sont enregistrées <strong>uniquement dans ce navigateur</strong>. ' +
          'Si tu effaces ses données ou changes de téléphone, elles disparaissent&nbsp;: ' +
          'fais une sauvegarde de temps en temps 💾</p>' +
          '<p class="small muted" id="b-last">' + esc(lastExportText()) + '</p>' +
          '<div class="backup-actions">' +
            '<button type="button" class="btn btn-primary btn-block" data-act="export">⬇️ Exporter mes données</button>' +
            '<button type="button" class="btn btn-soft btn-block" data-act="pick">⬆️ Importer une sauvegarde</button>' +
          '</div>' +
          '<input type="file" id="b-file" accept=".json,application/json" hidden>' +
          '<div id="b-result" aria-live="polite"></div>' +
          '<h3 class="backup-subtitle">Ouvrir un lien de partage</h3>' +
          '<p class="hint">Sur iPhone, un lien reçu s\'ouvre dans Safari et non dans l\'appli installée : ' +
          'copie-le et colle-le ici.</p>' +
          '<div class="paste-row">' +
            '<label class="sr-only" for="b-link">Lien de partage</label>' +
            '<input id="b-link" class="input" type="text" autocomplete="off" placeholder="Colle le lien ici">' +
            '<button type="button" class="btn btn-soft" data-act="open-link">Ouvrir</button>' +
          '</div>' +
          '<p class="form-error" id="b-link-error" role="alert"></p>' +
          '<p class="footer-links"><a href="confidentialite.html">Politique de confidentialité</a></p>' +
        '</div>',

      onMount: function (dlg, close) {
        const fileInput = dlg.querySelector('#b-file');
        const result = dlg.querySelector('#b-result');
        let pending = null; // groupes lus dans le fichier, en attente de confirmation

        dlg.querySelector('.backup').addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (!btn) return;

          if (btn.dataset.act === 'export') {
            download('partageo-sauvegarde-' + P.today() + '.json', P.store.exportData());
            dlg.querySelector('#b-last').textContent = lastExportText();
            P.ui.toast('Sauvegarde téléchargée ✓');
          }

          if (btn.dataset.act === 'pick') fileInput.click();

          if (btn.dataset.act === 'open-link') {
            const payload = P.link.extractPayload(dlg.querySelector('#b-link').value);
            if (!payload) {
              dlg.querySelector('#b-link-error').textContent = 'Ce n\'est pas un lien de partage Partageo.';
              dlg.querySelector('#b-link').focus();
              return;
            }
            close();
            P.app.navigate(P.link.ROUTE + payload);
          }

          if ((btn.dataset.act === 'merge' || btn.dataset.act === 'replace') && pending) {
            const before = P.store.importGroups(pending, btn.dataset.act);
            const n = pending.length;
            close();
            P.app.navigate('#/');
            P.ui.toast(P.plural(n, 'groupe importé', 'groupes importés') + ' ✓', {
              actionLabel: 'Annuler',
              duration: 5000,
              onAction: function () {
                P.store.restoreState(before);
                P.app.render();
                P.ui.toast('Import annulé');
              }
            });
          }
        });

        // Lecture du fichier choisi
        fileInput.addEventListener('change', function () {
          const file = fileInput.files[0];
          fileInput.value = ''; // permet de rechoisir le même fichier
          if (!file) return;

          file.text().then(function (text) {
            try {
              pending = P.store.parseImport(text);
            } catch (err) {
              pending = null;
              result.innerHTML = '<p class="form-error">' + esc(err.message) + '</p>';
              return;
            }
            if (!pending.length) {
              result.innerHTML = '<p class="form-error">Ce fichier ne contient aucun groupe.</p>';
              pending = null;
              return;
            }

            const names = pending.map(function (g) { return esc(g.emoji + ' ' + g.name); }).join(', ');
            const hasGroups = P.store.groups().length > 0;
            result.innerHTML = '' +
              '<div class="import-box">' +
                '<p><strong>' + P.plural(pending.length, 'groupe trouvé', 'groupes trouvés') + '</strong> : ' + names + '</p>' +
                (hasGroups
                  ? '<button type="button" class="btn btn-primary btn-block" data-act="merge">Ajouter à mes groupes</button>' +
                    '<button type="button" class="btn btn-danger-ghost btn-block" data-act="replace">Tout remplacer</button>' +
                    '<p class="hint">« Ajouter » garde tes groupes actuels (un groupe identique déjà présent est mis à jour).</p>'
                  : '<button type="button" class="btn btn-primary btn-block" data-act="merge">Importer</button>') +
              '</div>';
            result.querySelector('[data-act]').focus();
          });
        });
      }
    });
  }

  P.backup = { open: open };
})(window.Partageo);
