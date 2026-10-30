/* =====================================================================
   ui.js — Petits outils d'interface réutilisables
   ---------------------------------------------------------------------
   - esc()        : protège le texte affiché (un prénom "<b>" reste du texte)
   - toast()      : message temporaire en bas, avec bouton « Annuler » possible
   - openDialog() : feuille / fenêtre modale accessible (Échap, focus…)
   ===================================================================== */
(function (P) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Échappe le texte avant de l'insérer dans du HTML (sécurité). */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  /* ------------------------------ Toasts ------------------------------ */
  // Un seul toast à la fois. Le minuteur se met en pause quand on survole
  // ou qu'on atteint le bouton au clavier (on a le temps de cliquer).
  let timer = null;
  let remaining = 0;
  let startedAt = 0;

  function hideToast() {
    const box = document.getElementById('toast');
    clearTimeout(timer);
    box.classList.remove('show');
  }

  function startTimer(box) {
    startedAt = Date.now();
    timer = setTimeout(hideToast, remaining);
    box.classList.remove('paused');
  }

  function pauseTimer(box) {
    if (!box.classList.contains('show')) return;
    clearTimeout(timer);
    remaining = Math.max(800, remaining - (Date.now() - startedAt));
    box.classList.add('paused');
  }

  /**
   * Affiche un message.
   *   toast('Groupe créé')
   *   toast('Dépense supprimée', { actionLabel: 'Annuler', onAction: fn, duration: 5000 })
   */
  function toast(message, opts) {
    const o = Object.assign({ duration: 3500, actionLabel: null, onAction: null }, opts);
    const box = document.getElementById('toast');
    clearTimeout(timer);

    box.innerHTML =
      '<span class="toast-msg">' + esc(message) + '</span>' +
      (o.actionLabel ? '<button type="button" class="toast-action">' + esc(o.actionLabel) + '</button>' : '') +
      '<span class="toast-progress" aria-hidden="true"></span>';
    box.style.setProperty('--d', o.duration + 'ms');

    if (o.actionLabel) {
      box.querySelector('.toast-action').addEventListener('click', function () {
        hideToast();
        if (o.onAction) o.onAction();
      });
    }

    // Relance l'animation d'apparition
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    remaining = o.duration;
    startTimer(box);
  }

  // Pause / reprise du minuteur (souris et clavier)
  document.addEventListener('DOMContentLoaded', function () {
    const box = document.getElementById('toast');
    box.addEventListener('mouseenter', function () { pauseTimer(box); });
    box.addEventListener('focusin', function () { pauseTimer(box); });
    box.addEventListener('mouseleave', function () { if (box.classList.contains('paused')) startTimer(box); });
    box.addEventListener('focusout', function () { if (box.classList.contains('paused')) startTimer(box); });
  });

  /* ------------------------------ Fenêtres ------------------------------ */
  // On utilise l'élément natif <dialog> : le navigateur gère pour nous
  // la touche Échap, le blocage du fond et le focus clavier.

  /**
   * Ouvre une feuille modale.
   *   openDialog({ title, html, onMount: function (dialog, close) {}, onClose })
   */
  function openDialog(o) {
    const dlg = document.getElementById('dialog');
    const opener = document.activeElement; // pour y revenir à la fermeture
    if (dlg.open) dlg.close();

    dlg.innerHTML =
      '<div class="sheet-inner">' +
        '<div class="sheet-handle" aria-hidden="true"></div>' +
        '<header class="sheet-head">' +
          '<h2 id="dialog-title">' + esc(o.title) + '</h2>' +
          '<button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button>' +
        '</header>' +
        '<div class="sheet-body">' + o.html + '</div>' +
      '</div>';
    dlg.setAttribute('aria-labelledby', 'dialog-title');

    function close() {
      if (dlg.open) dlg.close();
    }

    dlg.onclose = function () {
      // L'événement « close » arrive un instant après la fermeture. Si une autre
      // fenêtre s'est ouverte entre-temps, il est périmé : surtout ne pas la vider.
      if (dlg.open) return;
      dlg.innerHTML = '';
      if (opener && document.body.contains(opener)) opener.focus();
      if (o.onClose) o.onClose();
    };
    // Clic sur le fond assombri → fermeture
    dlg.onclick = function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) close();
    };

    dlg.showModal();
    if (o.onMount) o.onMount(dlg, close);
    return close;
  }

  P.ui = { esc: esc, toast: toast, openDialog: openDialog };
})(window.Partageo);
