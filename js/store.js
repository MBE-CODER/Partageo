/* =====================================================================
   store.js — Sauvegarde des données dans le navigateur (localStorage)
   ---------------------------------------------------------------------
   Tout l'état de l'appli est un seul objet JSON, enregistré à chaque
   modification. Rien ne quitte le téléphone.
   ===================================================================== */
(function (P) {
  'use strict';

  const KEY = 'partageo:v1';
  const VERSION = 1;
  let state = null;

  function emptyState() {
    return { version: VERSION, groups: [], settings: { lastGroupId: null } };
  }

  /** Complète les données anciennes ou incomplètes pour qu'elles aient toujours la bonne forme. */
  function migrate(data) {
    if (!data || !Array.isArray(data.groups)) return emptyState();
    data.version = VERSION;
    data.settings = Object.assign({ lastGroupId: null, lastExport: null }, data.settings);
    data.groups.forEach(function (g) {
      g.members = Array.isArray(g.members) ? g.members : [];
      g.expenses = Array.isArray(g.expenses) ? g.expenses : [];
      g.settlements = Array.isArray(g.settlements) ? g.settlements : [];
      g.currency = g.currency || 'MAD';
      // Sécurité : couleur et emoji sont insérés dans la page, on n'accepte que des valeurs sûres
      if (!/^#[0-9a-f]{6}$/i.test(g.color)) g.color = '#3E9C8F';
      g.emoji = String(g.emoji || '👥').slice(0, 8);
      // Identifiants supprimés : évite qu'une dépense effacée revienne lors d'une fusion
      g.deleted = Array.isArray(g.deleted)
        ? g.deleted.filter(function (id) { return typeof id === 'string' && /^[\w-]{1,40}$/.test(id); })
        : [];
      if (!g.members.some(function (m) { return m.id === g.meId; })) g.meId = null;
    });
    return data;
  }

  /* ------------------------------ Export / import ------------------------------ */

  const SAFE_ID = /^[\w-]{1,40}$/;   // identifiants : lettres, chiffres, _ et - uniquement
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  /** Contenu du fichier de sauvegarde (texte JSON lisible). */
  function exportData() {
    state.settings.lastExport = new Date().toISOString();
    save();
    return JSON.stringify({
      app: 'Partageo',
      version: VERSION,
      exportedAt: state.settings.lastExport,
      groups: state.groups
    }, null, 2);
  }

  /**
   * Vérifie le contenu d'un fichier importé. Renvoie la liste des groupes
   * ou lance une erreur avec un message clair (affiché à l'utilisateur).
   */
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Ce fichier n\'est pas une sauvegarde lisible (JSON invalide).');
    }
    if (!data || !Array.isArray(data.groups)) {
      throw new Error('Ce fichier ne ressemble pas à une sauvegarde Partageo.');
    }

    data.groups.forEach(function (g, gi) {
      const where = '« ' + (g && g.name ? g.name : 'groupe n°' + (gi + 1)) + ' »';
      if (!g || !SAFE_ID.test(g.id) || typeof g.name !== 'string' || !Array.isArray(g.members)) {
        throw new Error('Le groupe ' + where + ' est incomplet.');
      }
      const ids = {};
      g.members.forEach(function (m) {
        if (!m || !SAFE_ID.test(m.id) || typeof m.name !== 'string') throw new Error('Un participant de ' + where + ' est invalide.');
        m.weight = Number(m.weight) > 0 ? Number(m.weight) : 1;
        m.phone = typeof m.phone === 'string' ? m.phone : '';
        ids[m.id] = true;
      });
      (g.expenses || []).forEach(function (e) {
        const ok = e && SAFE_ID.test(e.id) && Number.isInteger(e.amount) && e.amount > 0 && ids[e.payerId] &&
          e.split && Array.isArray(e.split.beneficiaries) &&
          e.split.beneficiaries.every(function (id) { return ids[id]; });
        if (!ok) throw new Error('Une dépense de ' + where + ' est invalide.');
        if (!ISO_DATE.test(e.date)) e.date = P.today();
        e.title = String(e.title || 'Dépense');
      });
      (g.settlements || []).forEach(function (s) {
        const ok = s && SAFE_ID.test(s.id) && Number.isInteger(s.amount) && s.amount > 0 && ids[s.fromId] && ids[s.toId];
        if (!ok) throw new Error('Un remboursement de ' + where + ' est invalide.');
        if (!ISO_DATE.test(s.date)) s.date = P.today();
      });
    });

    return migrate({ groups: data.groups }).groups;
  }

  /**
   * Importe des groupes déjà vérifiés.
   *   mode "merge"   : ajoute les groupes, remplace ceux qui ont le même identifiant
   *   mode "replace" : remplace tous les groupes
   * Renvoie une copie de l'état d'avant, pour pouvoir annuler.
   */
  function importGroups(groups, mode) {
    const before = JSON.stringify(state);
    if (mode === 'replace') {
      state.groups = groups;
    } else {
      groups.forEach(function (g) {
        const i = state.groups.findIndex(function (x) { return x.id === g.id; });
        if (i === -1) state.groups.push(g);
        else state.groups[i] = g;
      });
    }
    save();
    return before;
  }

  /* ------------------------- Fusion de deux versions d'un groupe -------------------------
     Quand un ami renvoie le groupe après avoir ajouté des dépenses :
       - participants : on réunit les deux listes (noms et parts : version reçue) ;
       - dépenses et remboursements : on réunit les deux listes ; si un même
         élément existe des deux côtés, on garde la version modifiée en dernier ;
       - ce qui a été supprimé d'un côté est supprimé partout ;
       - « C'est moi » reste celui de ce téléphone. */

  function stamp(x) {
    return x.updatedAt || x.createdAt || '';
  }

  /** Fusion « pure » : ne modifie ni local ni incoming, renvoie un nouveau groupe. */
  function mergeGroups(local, incoming) {
    const g = JSON.parse(JSON.stringify(local));
    const inc = JSON.parse(JSON.stringify(incoming));
    const deleted = g.deleted.concat(inc.deleted.filter(function (id) { return g.deleted.indexOf(id) === -1; }));

    inc.members.forEach(function (m) {
      const mine = g.members.find(function (x) { return x.id === m.id; });
      if (!mine) { g.members.push(m); return; }
      mine.name = m.name;
      mine.weight = m.weight;
      if (m.phone) mine.phone = m.phone; // on ne perd pas un numéro connu
    });

    ['expenses', 'settlements'].forEach(function (list) {
      inc[list].forEach(function (x) {
        const i = g[list].findIndex(function (y) { return y.id === x.id; });
        if (i === -1) g[list].push(x);
        else if (stamp(x) > stamp(g[list][i])) g[list][i] = x;
      });
      g[list] = g[list].filter(function (x) { return deleted.indexOf(x.id) === -1; });
    });

    g.deleted = deleted;
    g.name = inc.name;
    g.emoji = inc.emoji;
    g.color = inc.color;
    return g;
  }

  /** Fusionne un groupe reçu avec le groupe local du même identifiant. Renvoie l'état d'avant (annulation). */
  function mergeGroup(incoming) {
    const i = state.groups.findIndex(function (g) { return g.id === incoming.id; });
    if (i === -1) return null;
    const before = JSON.stringify(state);
    state.groups[i] = mergeGroups(state.groups[i], incoming);
    save();
    return before;
  }

  /** Revient à un état complet sauvegardé (annulation d'un import). */
  function restoreState(json) {
    state = migrate(JSON.parse(json));
    save();
  }

  /** Lit les données au démarrage. */
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      state = raw ? migrate(JSON.parse(raw)) : emptyState();
    } catch (err) {
      // Données illisibles : on les met de côté au lieu de les écraser
      console.warn('Partageo : données illisibles, sauvegardées sous ' + KEY + ':corrompu', err);
      try { if (raw) localStorage.setItem(KEY + ':corrompu', raw); } catch (e) { /* tant pis */ }
      state = emptyState();
    }
    return state;
  }

  /** Enregistre tout l'état. Renvoie false si le navigateur refuse (mémoire pleine, mode privé…). */
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Partageo : sauvegarde impossible', err);
      window.dispatchEvent(new CustomEvent('partageo:save-error'));
      return false;
    }
  }

  /* ------------------------------ Groupes ------------------------------ */

  function group(id) {
    return state.groups.find(function (g) { return g.id === id; }) || null;
  }

  function createGroup(data) {
    const g = {
      id: P.uid('g'),
      name: data.name,
      emoji: data.emoji,
      color: data.color,
      currency: 'MAD',
      createdAt: new Date().toISOString(),
      members: data.members,
      meId: data.meId || null,
      expenses: [],
      settlements: [],
      deleted: []
    };
    state.groups.unshift(g); // le plus récent en premier
    save();
    return g;
  }

  /** Ajoute un groupe déjà complet (démo) en tête de liste. */
  function insertGroup(g) {
    state.groups.unshift(migrate({ groups: [g] }).groups[0]);
    save();
    return g;
  }

  function updateGroup(id, patch) {
    const g = group(id);
    if (!g) return null;
    Object.assign(g, patch);
    save();
    return g;
  }

  /** Supprime un groupe et renvoie de quoi le restaurer (bouton « Annuler »). */
  function removeGroup(id) {
    const index = state.groups.findIndex(function (g) { return g.id === id; });
    if (index === -1) return null;
    const removed = state.groups.splice(index, 1)[0];
    if (state.settings.lastGroupId === id) state.settings.lastGroupId = null;
    save();
    return { group: removed, index: index };
  }

  function restoreGroup(snapshot) {
    state.groups.splice(Math.min(snapshot.index, state.groups.length), 0, snapshot.group);
    save();
  }

  /** Un participant est « utilisé » s'il apparaît dans une dépense ou un remboursement. */
  function memberInUse(g, memberId) {
    const inExpenses = g.expenses.some(function (e) {
      return e.payerId === memberId || (e.split && e.split.beneficiaries.indexOf(memberId) !== -1);
    });
    const inSettlements = g.settlements.some(function (s) {
      return s.fromId === memberId || s.toId === memberId;
    });
    return inExpenses || inSettlements;
  }

  /* ------------------- Dépenses et remboursements -------------------
     Les deux sont des listes d'un groupe (« expenses » et « settlements »)
     qui se gèrent de la même façon : ajout, modification, suppression
     avec possibilité d'annuler. */

  function addItem(groupId, list, prefix, data) {
    const g = group(groupId);
    if (!g) return null;
    const item = Object.assign({ id: P.uid(prefix), createdAt: new Date().toISOString() }, data);
    g[list].push(item);
    save();
    return item;
  }

  function updateItem(groupId, list, itemId, data) {
    const g = group(groupId);
    const item = g && g[list].find(function (x) { return x.id === itemId; });
    if (!item) return null;
    Object.assign(item, data, { updatedAt: new Date().toISOString() });
    save();
    return item;
  }

  /** Supprime un élément et renvoie de quoi le restaurer (bouton « Annuler »). */
  function removeItem(groupId, list, itemId) {
    const g = group(groupId);
    if (!g) return null;
    const index = g[list].findIndex(function (x) { return x.id === itemId; });
    if (index === -1) return null;
    const removed = g[list].splice(index, 1)[0];
    if (g.deleted.indexOf(itemId) === -1) g.deleted.push(itemId);
    save();
    return { groupId: groupId, list: list, item: removed, index: index };
  }

  function restoreItem(snapshot) {
    const g = group(snapshot.groupId);
    if (!g) return;
    g.deleted = g.deleted.filter(function (id) { return id !== snapshot.item.id; });
    const arr = g[snapshot.list];
    arr.splice(Math.min(snapshot.index, arr.length), 0, snapshot.item);
    save();
  }

  function setLastGroup(id) {
    if (state.settings.lastGroupId !== id) {
      state.settings.lastGroupId = id;
      save();
    }
  }

  P.store = {
    KEY: KEY,
    load: load,
    save: save,
    groups: function () { return state.groups; },
    settings: function () { return state.settings; },
    group: group,
    createGroup: createGroup,
    insertGroup: insertGroup,
    updateGroup: updateGroup,
    removeGroup: removeGroup,
    restoreGroup: restoreGroup,
    memberInUse: memberInUse,
    addExpense: function (gid, data) { return addItem(gid, 'expenses', 'e', data); },
    updateExpense: function (gid, id, data) { return updateItem(gid, 'expenses', id, data); },
    removeExpense: function (gid, id) { return removeItem(gid, 'expenses', id); },
    addSettlement: function (gid, data) { return addItem(gid, 'settlements', 's', data); },
    removeSettlement: function (gid, id) { return removeItem(gid, 'settlements', id); },
    restore: restoreItem,
    exportData: exportData,
    parseImport: parseImport,
    importGroups: importGroups,
    restoreState: restoreState,
    mergeGroups: mergeGroups,
    mergeGroup: mergeGroup,
    setLastGroup: setLastGroup
  };
})(window.Partageo);
