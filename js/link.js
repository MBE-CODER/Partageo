/* =====================================================================
   link.js — Partage d'un groupe par lien, sans serveur
   ---------------------------------------------------------------------
   Les données du groupe sont mises DANS le lien, après le « # » :
       https://mon-site/#/import/z3Vb…
   Ce qui suit le « # » n'est jamais envoyé au serveur : les données vont
   directement d'un téléphone à l'autre.

   Pour raccourcir le lien :
     1. JSON du groupe (sans « C'est moi », propre à chaque téléphone) ;
     2. compression « deflate » (CompressionStream, intégré au navigateur) ;
     3. encodage base64 « url » (lettres, chiffres, - et _ uniquement).
   Le premier caractère indique le format : « z » = compressé, « j » = brut
   (navigateurs anciens sans compression).
   À l'ouverture, les données passent par les mêmes vérifications de
   sécurité qu'un fichier de sauvegarde importé.
   ===================================================================== */
(function (P) {
  'use strict';

  const ROUTE = '#/import/';

  /* ------------------------- Base64 « url » ------------------------- */

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Fait passer des octets dans un flux de (dé)compression du navigateur. */
  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream))
      .arrayBuffer()
      .then(function (buf) { return new Uint8Array(buf); });
  }

  /* ------------------------- Encodage / décodage ------------------------- */

  /* Format compact « v2 » : des tableaux au lieu d'objets (pas de noms de champs
     répétés) et les participants désignés par leur position dans la liste.
     Environ 30 % plus court → QR code moins dense, plus facile à scanner.
       membre   : [id, nom, parts, téléphone?]
       dépense  : [id, libellé, montant, payeur, date, catégorie, mode, [bénéficiaires], [valeurs] ou 0, créée, modifiée?]
       rembours.: [id, de, à, montant, date, créé]
     Les dates de création / modification sont en millisecondes, en base 36. */

  function t36(iso) {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? 0 : ms.toString(36);
  }

  function fromT36(s) {
    const ms = parseInt(s, 36);
    return s && !Number.isNaN(ms) ? new Date(ms).toISOString() : undefined;
  }

  /** Groupe → texte JSON compact (sans « C'est moi », propre à chaque téléphone). */
  function pack(group, withPhones) {
    const ids = group.members.map(function (m) { return m.id; });
    const ix = function (id) { return ids.indexOf(id); };
    return JSON.stringify({
      v: 2,
      i: group.id, n: group.name, e: group.emoji, c: group.color,
      m: group.members.map(function (m) {
        return withPhones && m.phone ? [m.id, m.name, m.weight, m.phone] : [m.id, m.name, m.weight];
      }),
      x: group.expenses.map(function (e) {
        const b = e.split.beneficiaries;
        const row = [e.id, e.title, e.amount, ix(e.payerId), e.date, e.category, e.split.mode, b.map(ix),
          e.split.mode === 'equal' ? 0 : b.map(function (id) { return e.split.values[id]; }),
          t36(e.createdAt)];
        if (e.updatedAt) row.push(t36(e.updatedAt));
        return row;
      }),
      s: group.settlements.map(function (s) {
        return [s.id, ix(s.fromId), ix(s.toId), s.amount, s.date, t36(s.createdAt)];
      }),
      d: group.deleted || []
    });
  }

  /** Format compact → groupe au format normal (vérifié ensuite par parseImport). */
  function unpack(o) {
    const ids = (o.m || []).map(function (m) { return m[0]; });
    const id = function (i) { return ids[i]; };
    return {
      id: o.i, name: o.n, emoji: o.e, color: o.c,
      members: (o.m || []).map(function (m) { return { id: m[0], name: m[1], weight: m[2], phone: m[3] || '' }; }),
      expenses: (o.x || []).map(function (r) {
        const benef = (r[7] || []).map(id);
        const values = {};
        if (Array.isArray(r[8])) benef.forEach(function (b, k) { values[b] = r[8][k]; });
        const e = {
          id: r[0], title: r[1], amount: r[2], payerId: id(r[3]), date: r[4], category: r[5],
          split: { mode: r[6], beneficiaries: benef, values: values },
          createdAt: fromT36(r[9])
        };
        if (r[10]) e.updatedAt = fromT36(r[10]);
        return e;
      }),
      settlements: (o.s || []).map(function (r) {
        return { id: r[0], fromId: id(r[1]), toId: id(r[2]), amount: r[3], date: r[4], createdAt: fromT36(r[5]) };
      }),
      deleted: o.d || []
    };
  }

  /** Groupe → texte à mettre dans le lien (promesse). */
  function encode(group, withPhones) {
    const bytes = new TextEncoder().encode(pack(group, withPhones));
    if (typeof CompressionStream === 'undefined') return Promise.resolve('j' + toBase64Url(bytes));
    return pipe(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + toBase64Url(z); });
  }

  /** Texte du lien → groupe vérifié (promesse rejetée avec un message clair si problème). */
  function decode(payload) {
    return Promise.resolve().then(function () {
      let bytes;
      try {
        bytes = fromBase64Url(payload.slice(1));
      } catch (e) {
        throw new Error('Ce lien est incomplet ou abîmé. Demande à ton ami de te le renvoyer.');
      }
      if (payload[0] === 'z') {
        if (typeof DecompressionStream === 'undefined') {
          throw new Error('Ton navigateur est trop ancien pour ouvrir ce lien. Mets-le à jour.');
        }
        return pipe(bytes, new DecompressionStream('deflate-raw')).catch(function () {
          throw new Error('Ce lien est incomplet ou abîmé. Demande à ton ami de te le renvoyer.');
        });
      }
      if (payload[0] === 'j') return bytes;
      throw new Error('Ce lien ne vient pas de Partageo.');
    }).then(function (bytes) {
      let text = new TextDecoder().decode(bytes);
      try {
        const o = JSON.parse(text);
        if (o && o.v === 2) text = JSON.stringify({ groups: [unpack(o)] }); // format compact
      } catch (e) {
        throw new Error('Ce lien est incomplet ou abîmé. Demande à ton ami de te le renvoyer.');
      }
      const groups = P.store.parseImport(text); // vérifications de sécurité
      if (groups.length !== 1) throw new Error('Ce lien ne contient pas un groupe valide.');
      return groups[0];
    });
  }

  /** Lien complet à partager. */
  function url(payload) {
    return location.href.split('#')[0] + ROUTE + payload;
  }

  /**
   * Retrouve le contenu à partir de ce que l'utilisateur colle :
   * un lien complet (https://…#/import/z…) ou juste le code (z…).
   */
  function extractPayload(text) {
    const t = String(text || '').trim();
    const i = t.indexOf(ROUTE);
    const candidate = (i !== -1 ? t.slice(i + ROUTE.length) : t).replace(/[^\w-].*$/, '');
    return /^[zj][\w-]{10,}$/.test(candidate) ? candidate : null;
  }

  P.link = { encode: encode, decode: decode, url: url, extractPayload: extractPayload, ROUTE: ROUTE };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('link', function (t) {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 62, 63]);
    t.eq(Array.from(fromBase64Url(toBase64Url(bytes))), Array.from(bytes), 'base64url : aller-retour');
    t.ok(/^[\w-]+$/.test(toBase64Url(bytes)), 'base64url : uniquement des caractères sûrs pour un lien');

    t.eq(extractPayload('Rejoins-nous https://x.netlify.app/#/import/zAbCdEfGhIjKl123 merci !'), 'zAbCdEfGhIjKl123',
      'lien collé au milieu d\'un message');
    t.eq(extractPayload('zAbCdEfGhIjKl123'), 'zAbCdEfGhIjKl123', 'code seul');
    t.eq(extractPayload('bonjour'), null, 'texte quelconque → rien');

    // Format compact : aller-retour sans perte (sauf « moi » et, par défaut, les numéros)
    const demo = P.demo.build();
    demo.members[0].phone = '0611111111';
    demo.expenses[0].updatedAt = '2026-10-05T10:00:00.123Z';
    demo.deleted = ['e_ancienne'];
    const expected = JSON.parse(JSON.stringify(demo));
    delete expected.meId;
    delete expected.currency;
    delete expected.createdAt;
    expected.members[0].phone = '';
    t.eq(unpack(JSON.parse(pack(demo, false))), expected, 'format compact : aller-retour identique');
    t.eq(unpack(JSON.parse(pack(demo, true))).members[0].phone, '0611111111', 'format compact : numéros inclus sur demande');
    t.ok(pack(demo, false).length < JSON.stringify(demo).length * 0.75, 'format compact : au moins 25 % plus court');

    // Fusion : chacun a ajouté une dépense, l'un en a supprimé une, l'autre en a modifié une
    const base = {
      id: 'g', name: 'Coloc', emoji: '🏠', color: '#3E9C8F', meId: 'a',
      members: [{ id: 'a', name: 'Ali', weight: 1, phone: '0612345678' }, { id: 'b', name: 'Badr', weight: 1, phone: '' }],
      expenses: [
        { id: 'e1', title: 'Loyer', amount: 400000, payerId: 'a', createdAt: '2026-10-01T10:00:00Z' },
        { id: 'e2', title: 'Internet', amount: 30000, payerId: 'b', createdAt: '2026-10-02T10:00:00Z' }
      ],
      settlements: [], deleted: []
    };
    const mine = JSON.parse(JSON.stringify(base));
    mine.expenses.push({ id: 'e3', title: 'Courses', amount: 5000, payerId: 'a', createdAt: '2026-10-03T10:00:00Z' });
    mine.expenses = mine.expenses.filter(function (e) { return e.id !== 'e2'; });
    mine.deleted = ['e2'];

    const theirs = JSON.parse(JSON.stringify(base));
    delete theirs.meId;
    theirs.members[0].phone = '';
    theirs.members.push({ id: 'c', name: 'Chama', weight: 1, phone: '' });
    theirs.expenses[0] = Object.assign({}, theirs.expenses[0], { amount: 450000, updatedAt: '2026-10-05T10:00:00Z' });
    theirs.expenses.push({ id: 'e4', title: 'Gaz', amount: 4000, payerId: 'c', createdAt: '2026-10-04T10:00:00Z' });

    const merged = P.store.mergeGroups(mine, theirs);
    t.eq(merged.expenses.map(function (e) { return e.id; }).sort(), ['e1', 'e3', 'e4'],
      'fusion : ajouts des deux côtés gardés, suppression respectée');
    t.eq(merged.expenses.find(function (e) { return e.id === 'e1'; }).amount, 450000, 'fusion : la modification la plus récente gagne');
    t.eq(merged.members.map(function (m) { return m.id; }), ['a', 'b', 'c'], 'fusion : nouveau participant ajouté');
    t.eq([merged.meId, merged.members[0].phone], ['a', '0612345678'], 'fusion : « moi » et numéro connu conservés');
    t.eq(mine.expenses.length, 2, 'fusion : la version locale d\'origine n\'est pas modifiée');
  });
})(window.Partageo);
