/* =====================================================================
   parser.js — Saisie d'une dépense en langage naturel
   ---------------------------------------------------------------------
   Exemples compris :
     "Youssef 450 resto pour tous"
     "Sara 120 taxi pour Sara et Omar"
     "Omar a payé 85,50 courses sauf Sara"
     "j'ai payé 1 200 dh riad 2 nuits"
     "payé par Lina 60 cafés pour tout le monde sauf Omar"

   Pas d'IA : des règles simples, lues mot par mot.
   Le résultat PRÉ-REMPLIT le formulaire : l'utilisateur vérifie toujours.
   ===================================================================== */
(function (P) {
  'use strict';

  /* ------------------------------ Vocabulaire ------------------------------ */

  // Mots-clés de catégorie (sans accents, au singulier)
  const CATEGORY_WORDS = {
    resto: ['resto', 'restaurant', 'tajine', 'couscous', 'cafe', 'the', 'dejeuner', 'diner', 'petit dej',
      'petit dejeuner', 'pizza', 'burger', 'snack', 'glace', 'ftour', 'brochette', 'sandwich', 'tacos',
      'sushi', 'repas', 'boisson', 'jus', 'mcdo', 'kfc', 'patisserie', 'msemen', 'harira', 'poisson grille'],
    courses: ['course', 'marjane', 'carrefour', 'bim', 'acima', 'supermarche', 'epicerie', 'hanout',
      'marche', 'souk', 'legume', 'fruit', 'pain', 'lait', 'viande', 'poulet', 'provision'],
    transport: ['taxi', 'petit taxi', 'grand taxi', 'train', 'oncf', 'ctm', 'bus', 'tram', 'essence', 'gasoil',
      'carburant', 'peage', 'autoroute', 'parking', 'uber', 'careem', 'indrive', 'avion', 'billet', 'vol',
      'location voiture', 'voiture', 'bateau', 'ferry'],
    logement: ['loyer', 'electricite', 'lydec', 'redal', 'amendis', 'radeef', 'internet', 'wifi', 'fibre', 'inwi',
      'iam', 'maroc telecom', 'orange', 'syndic', 'charge', 'gaz', 'butane', 'menage', 'facture', 'eau et electricite'],
    hebergement: ['hotel', 'riad', 'airbnb', 'auberge', 'camping', 'gite', 'nuit', 'chambre', 'booking'],
    loisirs: ['cinema', 'concert', 'sortie', 'bowling', 'hammam', 'plage', 'jeu', 'musee', 'excursion', 'quad',
      'piscine', 'foot', 'match', 'spa', 'karting', 'activite', 'visite', 'guide', 'balade'],
    cadeaux: ['cadeau', 'anniversaire', 'anniv', 'fleur', 'bouquet']
  };

  const FOR_WORDS = ['pour'];
  const EXCEPT_WORDS = ['sauf', 'excepte', 'hors', 'sans'];
  const ALL_WORDS = ['tous', 'tout', 'toutes', 'nous', 'tlm', 'groupe'];
  const PAID_WORDS = ['paye', 'payee', 'payes', 'payees', 'payer', 'regle'];
  const ME_WORDS = ['moi', 'je'];
  const UNIT_WORDS = ['dh', 'dhs', 'mad', 'dirham', 'dirhams'];
  // Mots retirés du libellé
  const FILLER_WORDS = ['a', 'ai', 'avons', 'ont'].concat(PAID_WORDS, ME_WORDS, UNIT_WORDS);
  // Petits mots retirés au début / à la fin du libellé ("au resto" → "Resto")
  const EDGE_WORDS = ['le', 'la', 'les', 'l', 'du', 'de', 'des', 'd', 'au', 'aux', 'un', 'une', 'en', 'pour', 'par', 'et'];

  /* ------------------------------ Outils ------------------------------ */

  /** Distance d'édition : nombre de lettres à changer pour passer d'un mot à l'autre. */
  function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, function (_, i) { return i; });
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  /** Singulier approximatif : "cafes" → "cafe", "nuits" → "nuit". */
  function singular(word) {
    return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
  }

  /** Découpe la phrase en mots : { raw: texte d'origine, norm: minuscules sans accents, isMe } */
  function tokenize(text) {
    return String(text || '').split(/\s+/).map(function (piece) {
      // On retire la ponctuation autour du mot (mais pas dans les nombres : "85,50")
      const raw = piece.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      let norm = P.normalize(raw).replace(/[’`]/g, '\'');
      const isMe = /^j'/.test(norm);                  // "j'ai payé"
      norm = norm.replace(/^(l|d|j|qu)'/, '');        // "l'essence" → "essence"
      return { raw: raw.replace(/^(l|d|j|qu)['’]/i, ''), norm: norm, isMe: isMe, used: false };
    }).filter(function (t) { return t.norm !== '' || t.raw === ''; });
  }

  /** Devine la catégorie d'un texte. Renvoie un id de catégorie ou null. */
  function guessCategory(text) {
    const words = P.normalize(text).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean).map(singular);
    const phrase = ' ' + words.join(' ') + ' ';
    // Le premier mot reconnu, dans l'ordre de la phrase, l'emporte
    let best = null;
    let bestPos = Infinity;
    Object.keys(CATEGORY_WORDS).forEach(function (cat) {
      CATEGORY_WORDS[cat].forEach(function (kw) {
        const pos = phrase.indexOf(' ' + kw + ' ');
        if (pos !== -1 && pos < bestPos) { best = cat; bestPos = pos; }
      });
    });
    return best;
  }

  const KNOWN_WORDS = [].concat(FOR_WORDS, EXCEPT_WORDS, ALL_WORDS, FILLER_WORDS, EDGE_WORDS, ['monde', 'sauf']);
  const ALL_CATEGORY_WORDS = [].concat.apply([], Object.keys(CATEGORY_WORDS).map(function (k) { return CATEGORY_WORDS[k]; }));

  /**
   * Essaie de reconnaître un membre à la position i.
   * Renvoie { id, len } (len = nombre de mots utilisés) ou null.
   */
  function matchMember(tokens, i, members, meId) {
    const t = tokens[i];
    if (!t || !t.norm) return null;
    if ((ME_WORDS.indexOf(t.norm) !== -1) && meId) return { id: meId, len: 1 };

    const people = members.map(function (m) {
      return { id: m.id, words: P.normalize(m.name).split(/[^a-z0-9']+/).filter(Boolean) };
    }).filter(function (p) { return p.words.length; });

    // 1. Nom complet sur plusieurs mots ("Sara & Omar")
    let best = null;
    people.forEach(function (p) {
      if (p.words.length < 2) return;
      const seq = [];
      for (let k = i; k < tokens.length && seq.length < p.words.length; k++) {
        if (tokens[k].norm) seq.push(tokens[k].norm);
        else if (seq.length === 0) break;
        if (seq.length === p.words.length && seq.join(' ') === p.words.join(' ')) {
          if (!best || k - i + 1 > best.len) best = { id: p.id, len: k - i + 1 };
        }
      }
    });
    if (best) return best;

    // 2. Premier mot exact ("sara")
    const exact = people.filter(function (p) { return p.words[0] === t.norm; });
    if (exact.length) return { id: exact[0].id, len: 1 };

    // Les mots du vocabulaire ne sont jamais des prénoms approximatifs
    if (KNOWN_WORDS.indexOf(t.norm) !== -1 || ALL_CATEGORY_WORDS.indexOf(singular(t.norm)) !== -1) return null;

    // 2 bis. Autre mot exact d'un nom composé ("Adam" → Kenza & Adam), s'il n'y a qu'une possibilité
    const inside = people.filter(function (p) { return p.words.indexOf(t.norm) > 0; });
    if (inside.length === 1) return { id: inside[0].id, len: 1 };
    if (/\d/.test(t.norm)) return null;

    // 3. Début de prénom ("you" → Youssef), seulement s'il n'y a qu'une possibilité
    if (t.norm.length >= 3) {
      const pre = people.filter(function (p) { return p.words[0].indexOf(t.norm) === 0; });
      if (pre.length === 1) return { id: pre[0].id, len: 1 };
    }

    // 4. Faute de frappe ("Yousef" → Youssef), seulement s'il n'y a qu'une possibilité
    if (t.norm.length >= 4) {
      const max = t.norm.length >= 7 ? 2 : 1;
      const close = people.filter(function (p) { return distance(t.norm, p.words[0]) <= max; });
      if (close.length === 1) return { id: close[0].id, len: 1 };
    }
    return null;
  }

  /* ------------------------------ Montant ------------------------------ */

  /** Trouve le montant et marque les mots utilisés. Renvoie des centimes ou null. */
  function findAmount(tokens) {
    // "1 200" écrit en deux morceaux → on les recolle
    for (let i = 0; i < tokens.length - 1; i++) {
      if (/^\d{1,3}$/.test(tokens[i].norm) && /^\d{3}([.,]\d{1,2})?(dhs?|mad)?$/.test(tokens[i + 1].norm)) {
        tokens[i].norm += tokens[i + 1].norm;
        tokens[i + 1].used = true;
        tokens[i + 1].norm = '';
      }
    }

    const candidates = [];
    tokens.forEach(function (t, i) {
      if (t.used || !/^\d[\d.,]*(dhs?|mad|dirhams?)?$/.test(t.norm)) return;
      const value = P.money.parse(t.norm);
      if (Number.isNaN(value) || value <= 0) return;
      const next = tokens[i + 1];
      const unit = /[a-z]$/.test(t.norm) || !!(next && UNIT_WORDS.indexOf(next.norm) !== -1);
      candidates.push({ i: i, value: value, unit: unit });
    });
    if (!candidates.length) return null;

    // Priorité au nombre suivi de "dh", sinon le plus grand ("riad 2 nuits 900" → 900)
    const chosen = candidates.find(function (c) { return c.unit; }) ||
      candidates.reduce(function (a, b) { return b.value > a.value ? b : a; });
    tokens[chosen.i].used = true;
    const next = tokens[chosen.i + 1];
    if (next && UNIT_WORDS.indexOf(next.norm) !== -1) next.used = true;
    return chosen.value;
  }

  /* ------------------------------ Analyse ------------------------------ */

  /**
   * Analyse une phrase pour un groupe.
   * Renvoie { amount, payerId, beneficiaries, title, category, explicitFor }
   *   amount        : centimes ou null
   *   payerId       : id ou null (non trouvé)
   *   beneficiaries : ids dans l'ordre du groupe (tous par défaut)
   *   explicitFor   : true si la phrase précisait les bénéficiaires
   */
  function parse(text, group) {
    const members = group.members;
    const meId = group.meId;
    const tokens = tokenize(text);
    const res = {
      amount: findAmount(tokens),
      payerId: null,
      beneficiaries: members.map(function (m) { return m.id; }),
      title: '',
      category: 'autre',
      explicitFor: false
    };

    let state = 'main';          // main | payer | for | except
    let all = false;
    const forIds = [];
    const exceptIds = [];
    const titleTokens = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.used) continue;
      const n = t.norm;
      if (!n) continue; // "&", tiret… : simple séparateur

      if (t.isMe && !res.payerId && meId) res.payerId = meId;      // "j'ai payé"

      if (FOR_WORDS.indexOf(n) !== -1) { state = 'for'; continue; }
      if (EXCEPT_WORDS.indexOf(n) !== -1) { state = 'except'; continue; }
      if (n === 'par' && i > 0 && PAID_WORDS.indexOf(tokens[i - 1].norm) !== -1) { state = 'payer'; continue; }

      if (state === 'for') {
        if (ALL_WORDS.indexOf(n) !== -1) { all = true; continue; }
        if (all && (n === 'le' || n === 'monde')) continue;      // "tout le monde"
        if (n === 'et') continue;
      }
      if (state === 'except' && n === 'et') continue;

      const m = matchMember(tokens, i, members, meId);
      if (m) {
        i += m.len - 1;
        if (state === 'for') forIds.push(m.id);
        else if (state === 'except') exceptIds.push(m.id);
        else if (state === 'payer' || !res.payerId) { res.payerId = m.id; state = 'main'; }
        else titleTokens.push(t);
        continue;
      }

      // Mot ordinaire : fait partie du libellé
      state = 'main';
      titleTokens.push(t);
    }

    // Bénéficiaires
    const order = members.map(function (m) { return m.id; });
    let ids = forIds.length && !all ? forIds : order.slice();
    res.explicitFor = forIds.length > 0 || all || exceptIds.length > 0;
    ids = ids.filter(function (id) { return exceptIds.indexOf(id) === -1; });
    res.beneficiaries = order.filter(function (id) { return ids.indexOf(id) !== -1; });

    // Libellé : sans les mots de liaison, sans les petits mots au début et à la fin
    let words = titleTokens.filter(function (t) { return FILLER_WORDS.indexOf(t.norm) === -1; });
    while (words.length && EDGE_WORDS.indexOf(words[0].norm) !== -1) words.shift();
    while (words.length && EDGE_WORDS.indexOf(words[words.length - 1].norm) !== -1) words.pop();
    const title = words.map(function (t) { return t.raw; }).join(' ');
    res.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';

    res.category = guessCategory(res.title) || guessCategory(text) || 'autre';
    return res;
  }

  P.parser = { parse: parse, guessCategory: guessCategory };

  /* ------------------------------ Tests ------------------------------ */
  P.tests.add('parser', function (t) {
    const g = {
      meId: 'y',
      members: [
        { id: 'y', name: 'Youssef', weight: 1 },
        { id: 's', name: 'Sara', weight: 1 },
        { id: 'o', name: 'Omar', weight: 1 },
        { id: 'l', name: 'Lina', weight: 0.5 }
      ]
    };
    const all = ['y', 's', 'o', 'l'];
    function pick(r) { return [r.amount, r.payerId, r.beneficiaries, r.title, r.category]; }

    t.eq(pick(parse('Youssef 450 resto pour tous', g)),
      [45000, 'y', all, 'Resto', 'resto'], '« Youssef 450 resto pour tous »');

    t.eq(pick(parse('Sara 120 taxi pour Sara et Omar', g)),
      [12000, 's', ['s', 'o'], 'Taxi', 'transport'], '« Sara 120 taxi pour Sara et Omar »');

    t.eq(pick(parse('Omar a payé 85,50 courses sauf Sara', g)),
      [8550, 'o', ['y', 'o', 'l'], 'Courses', 'courses'], '« Omar a payé 85,50 courses sauf Sara »');

    t.eq(pick(parse('j\'ai payé 1 200 dh riad 2 nuits', g)),
      [120000, 'y', all, 'Riad 2 nuits', 'hebergement'], '« j\'ai payé 1 200 dh riad 2 nuits »');

    t.eq(pick(parse('payé par Lina 60 cafés', g)),
      [6000, 'l', all, 'Cafés', 'resto'], '« payé par Lina 60 cafés »');

    t.eq(pick(parse('Yousef 300 essence', g)).slice(0, 2), [30000, 'y'], 'faute de frappe : « Yousef »');

    t.eq(pick(parse('you 50 glace pour omar', g)).slice(0, 3), [5000, 'y', ['o']], 'début de prénom : « you »');

    t.eq(pick(parse('Sara 200 pour tout le monde sauf Lina', g)).slice(2, 3), [['y', 's', 'o']],
      '« pour tout le monde sauf Lina »');

    t.eq(pick(parse('Sara 90 pour le petit taxi', g)),
      [9000, 's', all, 'Petit taxi', 'transport'], '« pour le » n\'est pas une liste de personnes');

    t.eq(pick(parse('taxi 40', g)).slice(0, 2), [4000, null], 'sans payeur : à compléter dans le formulaire');

    t.eq(pick(parse('Omar 150 au resto pour moi et Sara', g)).slice(2, 4), [['y', 's'], 'Resto'], '« pour moi et Sara »');

    t.eq(parse('', g).amount, null, 'phrase vide');

    t.eq(guessCategory('Facture Lydec octobre'), 'logement', 'catégorie : Lydec → Logement');

    // Noms composés, comme dans la démo
    const g2 = {
      meId: 'y',
      members: [
        { id: 'y', name: 'Youssef', weight: 1 },
        { id: 'so', name: 'Sara & Omar', weight: 2 },
        { id: 'ka', name: 'Kenza & Adam', weight: 1.5 },
        { id: 'm', name: 'Mehdi', weight: 1 }
      ]
    };
    t.eq(pick(parse('Sara & Omar 1800 riad pour tous', g2)).slice(0, 4), [180000, 'so', ['y', 'so', 'ka', 'm'], 'Riad'],
      'nom composé « Sara & Omar »');
    t.eq(pick(parse('Mehdi 45 glaces pour Kenza & Adam et Mehdi', g2)).slice(1, 3), ['m', ['ka', 'm']],
      'bénéficiaire composé « Kenza & Adam »');
    t.eq(pick(parse('Sara 40 petit taxi pour Kenza', g2)).slice(1, 3), ['so', ['ka']],
      'premier mot d\'un nom composé (« Sara » → Sara & Omar)');
    t.eq(pick(parse('450 dh essence Youssef', g2)).slice(0, 2), [45000, 'y'], 'payeur après le montant');
    t.eq(pick(parse('Mehdi 240 hammam pour tous sauf Adam', g2)).slice(1, 4), ['m', ['y', 'so', 'm'], 'Hammam'],
      'second mot d\'un nom composé (« Adam » → Kenza & Adam)');
    t.eq(pick(parse('Omar 60 café', g2)).slice(1, 2), ['so'], '« Omar » → Sara & Omar');
    t.eq(parse('Youssef 450', g2).title, '', 'sans libellé : titre vide (la catégorie servira de titre)');
  });
})(window.Partageo);
