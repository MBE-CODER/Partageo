/* =====================================================================
   qr.js — Générateur de QR code (sans bibliothèque externe)
   ---------------------------------------------------------------------
   Implémentation compacte de la norme QR (ISO 18004), mode « octets »,
   versions 1 à 40, niveaux de correction L (7 %) et M (15 %).
   Inspirée de l'implémentation de référence de Project Nayuki (MIT).

   Étapes :
     1. transformer le texte en bits (mode, longueur, données, bourrage) ;
     2. ajouter les codes correcteurs d'erreurs (Reed-Solomon) ;
     3. dessiner les motifs fixes (repères des coins, lignes de synchro…) ;
     4. placer les données en zigzag, puis appliquer le « masque »
        qui donne l'image la plus facile à lire pour un appareil photo.

   Utilisation :
     const qr = Partageo.qr.encode('https://…');   // null si trop long
     const svg = Partageo.qr.toSvg(qr);
   ===================================================================== */
(function (P) {
  'use strict';

  // Codes correcteurs par bloc, et nombre de blocs, selon le niveau et la version (index 1 à 40)
  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
  };
  const NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
  };
  const FORMAT_BITS = { L: 1, M: 0 };

  /* ------------------------- Calculs de capacité ------------------------- */

  /** Nombre de modules (cases) disponibles pour les données et la correction. */
  function rawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function dataCodewords(ver, ecl) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }

  /* ------------------------- Reed-Solomon (GF 256) ------------------------- */

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  /** Découpe en blocs, ajoute la correction et entrelace (ordre imposé par la norme). */
  function addEccAndInterleave(data, ver, ecl) {
    const numBlocks = NUM_BLOCKS[ecl][ver];
    const eccLen = ECC_PER_BLOCK[ecl][ver];
    const rawCodewords = Math.floor(rawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(eccLen);

    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach(function (block, j) {
        if (i !== shortBlockLen - eccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  /* ------------------------- Dessin de la grille ------------------------- */

  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  function buildMatrix(ver, ecl, codewords, mask) {
    const size = ver * 4 + 17;
    const modules = [];
    const isFunction = [];
    for (let y = 0; y < size; y++) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }
    function setF(x, y, dark) {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    }

    // Lignes de synchronisation (pointillés)
    for (let i = 0; i < size; i++) {
      setF(6, i, i % 2 === 0);
      setF(i, 6, i % 2 === 0);
    }

    // Les 3 grands carrés de repère dans les coins (avec leur marge blanche)
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = c[0] + dx;
          const yy = c[1] + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    });

    // Petits carrés d'alignement
    const pos = alignmentPositions(ver, size);
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    // Informations de format (niveau de correction + masque), en deux exemplaires
    const fmtData = FORMAT_BITS[ecl] << 3 | mask;
    let rem = fmtData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fmt = (fmtData << 10 | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, getBit(fmt, i));
    setF(8, 7, getBit(fmt, 6));
    setF(8, 8, getBit(fmt, 7));
    setF(7, 8, getBit(fmt, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, getBit(fmt, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, getBit(fmt, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, getBit(fmt, i));
    setF(8, size - 8, true); // module toujours foncé

    // Informations de version (à partir de la version 7)
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const bits = ver << 12 | r;
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + i % 3;
        const b = Math.floor(i / 3);
        setF(a, b, getBit(bits, i));
        setF(b, a, getBit(bits, i));
      }
    }

    // Données, en zigzag par colonnes de 2, de droite à gauche
    let bit = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // on saute la ligne de synchronisation verticale
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bit < codewords.length * 8) {
            modules[y][x] = getBit(codewords[bit >>> 3], 7 - (bit & 7));
            bit++;
          }
        }
      }
    }

    // Masque : inverse certaines cases de données selon une formule
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (isFunction[y][x]) continue;
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = x * y % 2 + x * y % 3 === 0; break;
          case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: invert = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (invert) modules[y][x] = !modules[y][x];
      }
    }
    return modules;
  }

  /** Note de « lisibilité » d'une image (plus c'est bas, mieux c'est). */
  function penalty(m) {
    const n = m.length;
    let p = 0;
    let dark = 0;
    const PATTERNS = ['10111010000', '00001011101'];

    for (let dir = 0; dir < 2; dir++) {
      for (let a = 0; a < n; a++) {
        let line = '';
        for (let b = 0; b < n; b++) line += (dir ? m[b][a] : m[a][b]) ? '1' : '0';
        // Longues suites de même couleur
        const runs = line.match(/0{5,}|1{5,}/g) || [];
        runs.forEach(function (r) { p += r.length - 2; });
        // Motifs qui ressemblent aux repères des coins
        PATTERNS.forEach(function (pat) {
          for (let i = line.indexOf(pat); i !== -1; i = line.indexOf(pat, i + 1)) p += 40;
        });
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (m[y][x]) dark++;
        // Blocs 2×2 d'une même couleur
        if (y < n - 1 && x < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
    }
    // Équilibre entre cases foncées et claires
    const total = n * n;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }

  /* ------------------------- Fonction principale ------------------------- */

  /**
   * Encode un texte. Renvoie { version, size, modules } ou null s'il est trop long.
   * ecl : 'M' (par défaut, plus robuste) ou 'L' (plus de capacité).
   */
  function encode(text, ecl) {
    ecl = ecl || 'M';
    const bytes = Array.from(new TextEncoder().encode(text));

    // Plus petite version qui contient les données
    let ver;
    for (ver = 1; ver <= 40; ver++) {
      const needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
      if (needed <= dataCodewords(ver, ecl) * 8) break;
    }
    if (ver > 40) return null;

    // Suite de bits : mode « octets » (0100), longueur, données
    const bits = [];
    function push(value, len) { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); }
    push(0x4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });

    const capacity = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, capacity - bits.length));         // terminateur
    push(0, (8 - bits.length % 8) % 8);                     // complète l'octet
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    }
    for (let pad = 0xEC; data.length < capacity / 8; pad ^= 0xEC ^ 0x11) data.push(pad); // bourrage

    const codewords = addEccAndInterleave(data, ver, ecl);

    // On essaie les 8 masques et on garde le plus lisible
    let best = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const m = buildMatrix(ver, ecl, codewords, mask);
      const score = penalty(m);
      if (score < bestScore) { best = m; bestScore = score; }
    }
    return { version: ver, size: best.length, modules: best };
  }

  /** Dessin SVG (noir sur blanc, avec la marge blanche obligatoire de 4 modules). */
  function toSvg(qr, opts) {
    const o = Object.assign({ margin: 4, label: 'QR code' }, opts);
    const dim = qr.size + o.margin * 2;
    let d = '';
    qr.modules.forEach(function (row, y) {
      row.forEach(function (dark, x) {
        if (dark) d += 'M' + (x + o.margin) + ' ' + (y + o.margin) + 'h1v1h-1z';
      });
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" role="img"' +
      ' aria-label="' + P.ui.esc(o.label) + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  /** Nombre maximal d'octets encodables (version 40). */
  function maxBytes(ecl) {
    return dataCodewords(40, ecl || 'M') - 3;
  }

  P.qr = { encode: encode, toSvg: toSvg, maxBytes: maxBytes };
})(window.Partageo);
