/* =====================================================================
   expense-form.js — Formulaire d'ajout / modification d'une dépense
   ---------------------------------------------------------------------
   Le formulaire garde un « brouillon » (objet draft) en mémoire :
   les valeurs saisies pour chaque mode de répartition sont conservées,
   on peut donc passer de « Montants » à « % » sans rien perdre.
   L'aperçu des parts est recalculé à chaque frappe.
   ===================================================================== */
(function (P) {
  'use strict';

  const esc = P.ui.esc;

  const MODES = [
    { id: 'equal', label: 'Égal', help: 'Chacun paie la même part.' },
    { id: 'weight', label: 'Parts', help: 'Selon les parts de chacun : un couple compte 2, un enfant 0,5.' },
    { id: 'exact', label: 'Montants', help: 'Indique le montant exact de chacun.' },
    { id: 'percent', label: '%', help: 'Indique un pourcentage pour chacun (total : 100 %).' }
  ];

  /** Mode par défaut : « Parts » si quelqu'un ne compte pas pour 1, sinon « Égal ». */
  function defaultMode(group) {
    return group.members.some(function (m) { return m.weight !== 1; }) ? 'weight' : 'equal';
  }

  function memberName(group, id) {
    const m = group.members.find(function (x) { return x.id === id; });
    return m ? m.name : '?';
  }

  /** Crée le brouillon à partir d'une dépense existante, d'un pré-remplissage, ou de rien. */
  function makeDraft(group, base) {
    base = base || {};
    const split = base.split || {};
    const mode = split.mode || defaultMode(group);
    const d = {
      title: base.title || '',
      amountText: base.amount ? P.money.toInput(base.amount) : '',
      payerId: base.payerId || group.meId || (group.members[0] && group.members[0].id) || '',
      beneficiaries: split.beneficiaries ? split.beneficiaries.slice() : group.members.map(function (m) { return m.id; }),
      mode: mode,
      values: { weight: {}, exact: {}, percent: {} },
      date: base.date || P.today(),
      category: base.category || 'autre',
      // Tant que l'utilisateur n'a pas choisi de catégorie, on la devine d'après le libellé
      catAuto: !base.category || base.category === 'autre'
    };
    // Valeurs par défaut du mode « Parts » : les parts des membres
    group.members.forEach(function (m) { d.values.weight[m.id] = m.weight; });
    // Valeurs déjà enregistrées pour le mode de la dépense
    if (split.values && mode !== 'equal') {
      Object.keys(split.values).forEach(function (id) {
        const v = split.values[id];
        if (mode === 'exact') d.values.exact[id] = P.money.toInput(v);
        else if (mode === 'percent') d.values.percent[id] = P.fmtNum(v);
        else d.values.weight[id] = v;
      });
    }
    return d;
  }

  /** Transforme le brouillon en dépense (format enregistré). */
  function buildExpense(group, d) {
    let ids = group.members
      .map(function (m) { return m.id; })
      .filter(function (id) { return d.beneficiaries.indexOf(id) !== -1; });

    const values = {};
    if (d.mode !== 'equal') {
      ids.forEach(function (id) {
        const raw = d.values[d.mode][id];
        if (d.mode === 'exact') values[id] = P.money.parse(raw) || 0;
        else if (d.mode === 'percent') values[id] = parseFloat(String(raw == null ? '' : raw).replace(',', '.')) || 0;
        else values[id] = Number(raw) || 0;
      });
    }

    return {
      title: d.title.trim().replace(/\s+/g, ' ') || P.category(d.category).label,
      amount: P.money.parse(d.amountText),
      payerId: d.payerId,
      date: d.date || P.today(),
      category: d.category,
      split: { mode: d.mode, beneficiaries: ids, values: values }
    };
  }

  /* ------------------------------ HTML ------------------------------ */

  function formHtml(group, d, isNew) {
    const payers = group.members.map(function (m) {
      return '<label class="pick"><input type="radio" name="payer" value="' + m.id + '"' +
        (m.id === d.payerId ? ' checked' : '') + '><span>' + esc(m.name) + '</span></label>';
    }).join('');

    const benefs = group.members.map(function (m) {
      return '<label class="pick"><input type="checkbox" name="benef" value="' + m.id + '"' +
        (d.beneficiaries.indexOf(m.id) !== -1 ? ' checked' : '') + '><span>' + esc(m.name) + '</span></label>';
    }).join('');

    const modes = MODES.map(function (mo) {
      return '<label class="seg"><input type="radio" name="mode" value="' + mo.id + '"' +
        (mo.id === d.mode ? ' checked' : '') + '><span>' + mo.label + '</span></label>';
    }).join('');

    const cats = P.CATEGORIES.map(function (c) {
      return '<label class="pick pick-cat"><input type="radio" name="cat" value="' + c.id + '"' +
        (c.id === d.category ? ' checked' : '') + '><span><span aria-hidden="true">' + c.icon + '</span> ' + c.label + '</span></label>';
    }).join('');

    return '' +
      '<form class="form" id="expense-form" novalidate>' +
        '<div class="field">' +
          '<label for="x-amount">Montant</label>' +
          '<div class="amount-wrap">' +
            '<input id="x-amount" class="input input-amount" type="text" inputmode="decimal" autocomplete="off"' +
              ' placeholder="0" value="' + esc(d.amountText) + '"' + (isNew ? ' autofocus' : '') + '>' +
            '<span class="amount-unit" aria-hidden="true">DH</span>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="x-title">Libellé <span class="muted small">(facultatif)</span></label>' +
          '<input id="x-title" class="input" type="text" maxlength="60" autocomplete="off"' +
            ' placeholder="Ex. : Tajine au resto" value="' + esc(d.title) + '">' +
        '</div>' +
        '<fieldset class="field" id="x-payer"><legend>Payé par</legend><div class="picks">' + payers + '</div></fieldset>' +
        '<fieldset class="field" id="x-benef"><legend>Pour qui&nbsp;?</legend><div class="picks">' +
          '<button type="button" class="pick-all" data-act="all" aria-pressed="false">Tout le monde</button>' + benefs +
        '</div></fieldset>' +
        '<fieldset class="field" id="x-split"><legend>Répartition</legend>' +
          '<div class="segmented">' + modes + '</div>' +
          '<p class="hint" id="x-mode-help"></p>' +
          '<div id="x-details"></div>' +
        '</fieldset>' +
        '<fieldset class="field"><legend>Catégorie</legend><div class="picks">' + cats + '</div></fieldset>' +
        '<div class="field">' +
          '<label for="x-date">Date</label>' +
          '<input id="x-date" class="input" type="date" value="' + esc(d.date) + '">' +
        '</div>' +
        '<p class="form-error" id="x-error" role="alert"></p>' +
        '<div class="sheet-actions">' +
          (isNew ? '' : '<button type="button" class="btn btn-danger-ghost" data-act="delete">Supprimer</button>') +
          '<button type="submit" class="btn btn-primary btn-grow">' + (isNew ? 'Ajouter la dépense' : 'Enregistrer') + '</button>' +
        '</div>' +
      '</form>';
  }

  /** Lignes « qui paie combien » selon le mode choisi. */
  function detailsHtml(group, d) {
    const ids = group.members
      .map(function (m) { return m.id; })
      .filter(function (id) { return d.beneficiaries.indexOf(id) !== -1; });
    if (!ids.length) return '<p class="hint">Coche au moins une personne ci-dessus.</p>';

    const rows = ids.map(function (id) {
      const name = esc(memberName(group, id));
      let control = '';
      if (d.mode === 'weight') {
        control =
          '<div class="stepper stepper-sm" role="group" aria-label="Parts de ' + name + '">' +
            '<button type="button" class="step" data-act="dec" data-id="' + id + '" aria-label="Moins de parts pour ' + name + '">−</button>' +
            '<output class="step-val">' + P.fmtNum(d.values.weight[id]) + '</output>' +
            '<button type="button" class="step" data-act="inc" data-id="' + id + '" aria-label="Plus de parts pour ' + name + '">+</button>' +
          '</div>';
      } else if (d.mode === 'exact' || d.mode === 'percent') {
        const unit = d.mode === 'exact' ? 'DH' : '%';
        control =
          '<span class="num-wrap">' +
            '<input class="input input-sm input-num" type="text" inputmode="decimal" autocomplete="off" placeholder="0"' +
              ' data-val="' + id + '" value="' + esc(d.values[d.mode][id] || '') + '"' +
              ' aria-label="' + (d.mode === 'exact' ? 'Montant' : 'Pourcentage') + ' pour ' + name + '">' +
            '<span class="num-unit" aria-hidden="true">' + unit + '</span>' +
          '</span>';
      }
      return '<li class="share-row">' +
        '<span class="share-name">' + name + '</span>' + control +
        (d.mode === 'exact' ? '' : '<span class="share-amount" data-share="' + id + '">—</span>') +
      '</li>';
    }).join('');

    return '<ul class="share-list" role="list">' + rows + '</ul>' +
      '<p class="share-remaining" id="x-remaining" aria-live="polite"></p>';
  }

  /* ------------------------------ Ouverture ------------------------------ */

  /**
   * Ouvre le formulaire.
   *   open(group)                      → nouvelle dépense
   *   open(group, { prefill })         → nouvelle dépense pré-remplie (exemple, langage naturel…)
   *   open(group, { prefill, focusSubmit: true }) → idem, focus sur « Ajouter » (Entrée pour confirmer)
   *   open(group, { expense })         → modification
   */
  function open(group, opts) {
    opts = opts || {};
    const editing = opts.expense || null;
    const isNew = !editing;
    const d = makeDraft(group, editing || opts.prefill);

    P.ui.openDialog({
      title: isNew ? 'Nouvelle dépense' : 'Modifier la dépense',
      html: formHtml(group, d, isNew),
      onMount: function (dlg, close) {
        const form = dlg.querySelector('#expense-form');
        const details = form.querySelector('#x-details');
        const errorBox = form.querySelector('#x-error');

        // Redessine les lignes de détail (quand le mode ou les bénéficiaires changent)
        function renderDetails() {
          details.innerHTML = detailsHtml(group, d);
          form.querySelector('#x-mode-help').textContent =
            MODES.find(function (m) { return m.id === d.mode; }).help;
          const all = d.beneficiaries.length === group.members.length;
          form.querySelector('[data-act="all"]').setAttribute('aria-pressed', String(all));
          updatePreview();
        }

        // Met à jour seulement les montants affichés (garde le focus dans les champs)
        function updatePreview() {
          const e = buildExpense(group, d);
          const amount = e.amount > 0 ? e.amount : 0;
          const r = P.split.compute(amount, e.split, group.members);

          details.querySelectorAll('[data-share]').forEach(function (span) {
            const v = r.shares[span.dataset.share];
            span.textContent = v != null && amount ? P.money.format(v) : '—';
          });

          const rem = details.querySelector('#x-remaining');
          if (!rem) return;
          rem.className = 'share-remaining';
          if (d.mode === 'exact') {
            if (r.remaining === 0 && amount) { rem.textContent = '✓ Le compte est bon'; rem.classList.add('ok'); }
            else if (r.remaining > 0) { rem.textContent = 'Reste à répartir : ' + P.money.format(r.remaining); rem.classList.add('warn'); }
            else if (r.remaining < 0) { rem.textContent = 'Trop réparti : ' + P.money.format(-r.remaining); rem.classList.add('warn'); }
            else rem.textContent = '';
          } else if (d.mode === 'percent') {
            if (r.remaining === 0) { rem.textContent = '✓ Total : 100 %'; rem.classList.add('ok'); }
            else { rem.textContent = (r.remaining > 0 ? 'Reste ' : 'Trop : ') + P.fmtNum(Math.abs(r.remaining) / 100) + ' %'; rem.classList.add('warn'); }
          } else {
            rem.textContent = '';
          }
        }

        renderDetails();

        // Formulaire pré-rempli et complet : il n'y a plus qu'à confirmer
        if (opts.focusSubmit) form.querySelector('[type="submit"]').focus();

        // Saisie au clavier
        form.addEventListener('input', function (e) {
          const t = e.target;
          if (t.id === 'x-amount') d.amountText = t.value;
          else if (t.id === 'x-title') {
            d.title = t.value;
            const guess = d.catAuto && P.parser ? P.parser.guessCategory(t.value) : null;
            if (guess && guess !== d.category) {
              d.category = guess;
              form.querySelector('input[name="cat"][value="' + guess + '"]').checked = true;
            }
          }
          else if (t.id === 'x-date') d.date = t.value;
          else if (t.dataset.val) d.values[d.mode][t.dataset.val] = t.value;
          else return;
          errorBox.textContent = '';
          updatePreview();
        });

        // Choix dans les listes (payeur, bénéficiaires, mode, catégorie)
        form.addEventListener('change', function (e) {
          const t = e.target;
          if (t.name === 'payer') d.payerId = t.value;
          if (t.name === 'cat') { d.category = t.value; d.catAuto = false; }
          if (t.name === 'benef') {
            d.beneficiaries = Array.prototype.map.call(form.querySelectorAll('input[name="benef"]:checked'),
              function (x) { return x.value; });
            renderDetails();
          }
          if (t.name === 'mode') {
            d.mode = t.value;
            renderDetails();
          }
          errorBox.textContent = '';
        });

        form.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (!btn) return;

          if (btn.dataset.act === 'all') {
            // Tout le monde coché → on décoche tout ; sinon on coche tout
            const all = d.beneficiaries.length === group.members.length;
            form.querySelectorAll('input[name="benef"]').forEach(function (x) { x.checked = !all; });
            d.beneficiaries = all ? [] : group.members.map(function (m) { return m.id; });
            renderDetails();
          }

          if (btn.dataset.act === 'dec' || btn.dataset.act === 'inc') {
            const id = btn.dataset.id;
            const w = Number(d.values.weight[id]) || 0;
            d.values.weight[id] = btn.dataset.act === 'inc' ? Math.min(20, w + 0.5) : Math.max(0.5, w - 0.5);
            btn.parentNode.querySelector('.step-val').textContent = P.fmtNum(d.values.weight[id]);
            updatePreview();
          }

          if (btn.dataset.act === 'delete') {
            close();
            remove(group, editing);
          }
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          const expense = buildExpense(group, d);

          // En « Montants » et « % », une personne à 0 n'est pas vraiment concernée : on la retire
          if (expense.split.mode === 'exact' || expense.split.mode === 'percent') {
            expense.split.beneficiaries = expense.split.beneficiaries.filter(function (id) {
              return expense.split.values[id] > 0;
            });
            Object.keys(expense.split.values).forEach(function (id) {
              if (!(expense.split.values[id] > 0)) delete expense.split.values[id];
            });
          }

          const problem = P.split.validate(expense, group);
          if (problem) {
            errorBox.textContent = problem.error;
            const target = {
              amount: '#x-amount',
              payer: '#x-payer input',
              split: d.beneficiaries.length ? '#x-details input, #x-split input:checked' : '#x-benef input'
            }[problem.field];
            const el = target && form.querySelector(target);
            if (el) el.focus();
            return;
          }

          if (isNew) {
            P.store.addExpense(group.id, expense);
            P.ui.toast('Dépense ajoutée ✓');
          } else {
            P.store.updateExpense(group.id, editing.id, expense);
            P.ui.toast('Dépense modifiée ✓');
          }
          close();
          P.app.render();
        });
      }
    });
  }

  /** Supprime une dépense, avec 5 secondes pour annuler. */
  function remove(group, expense) {
    const snapshot = P.store.removeExpense(group.id, expense.id);
    if (!snapshot) return;
    P.app.render();
    P.ui.toast('« ' + expense.title + ' » supprimée', {
      actionLabel: 'Annuler',
      duration: 5000,
      onAction: function () {
        P.store.restore(snapshot);
        P.app.render();
        P.ui.toast('Dépense restaurée');
      }
    });
  }

  P.expenseForm = { open: open, remove: remove };
})(window.Partageo);
