# Publier Partageo sur Google Play — guide pas à pas

Durée totale : environ **1 journée de travail**, plus **14 jours de test fermé** obligatoires
pour un nouveau compte développeur personnel (voir étape 6).

Principe : l'appli Android est une **Trusted Web Activity (TWA)**. C'est ton site Partageo affiché
en plein écran, sans barre d'adresse. Quand tu mets à jour le site, l'appli Android est à jour
**sans repasser par le store**.

---

## Étape 0 — Ce qu'il te faut

- [ ] Un **nom de domaine** (ex. `partageo.ma` ou `partageo.app`), environ 10 à 20 €/an.
      Pour un `.ma` : passer par un registraire agréé par l'ANRT.
      *(Possible sans domaine avec l'adresse gratuite `xxx.netlify.app`, mais un vrai domaine fait plus sérieux et ne dépend pas de Netlify.)*
- [ ] Un **compte développeur Google Play** : <https://play.google.com/console> → **25 $ une seule fois**,
      avec vérification d'identité (pièce d'identité).
- [ ] Un **téléphone Android** pour tester.

## Étape 1 — Compléter les fichiers (5 minutes)

Remplace les emplacements suivants :

| Fichier | À remplacer |
|---|---|
| `confidentialite.html` | `[ton-email]` (2 fois) et, si besoin, la date |
| `store/FICHE-GOOGLE-PLAY.md` | `[ton-email]`, `[ton-domaine]` |
| `.well-known/assetlinks.json` | à l'étape 5 seulement (empreinte SHA-256) |

> Choisis maintenant l'**identifiant de l'application** (« package name »). Il est **définitif**.
> Proposé : `ma.partageo.app` (déjà inscrit dans `assetlinks.json`).

## Étape 2 — Héberger le site en HTTPS (15 minutes)

1. Crée un compte gratuit sur <https://app.netlify.com>.
2. **Add new site → Deploy manually** → glisse le dossier `depenses` entier.
3. **Domain management → Add a domain** → ton domaine, puis suis les instructions DNS.
   Netlify active le HTTPS automatiquement (certificat gratuit).
4. **Vérifications** dans le navigateur :
   - [ ] `https://ton-domaine/` → Partageo s'ouvre, icône « Installer » présente
   - [ ] `https://ton-domaine/confidentialite.html` → la page de confidentialité
   - [ ] `https://ton-domaine/.well-known/assetlinks.json` → le fichier JSON s'affiche

> ⚠️ Le dossier `.well-known` commence par un point : certains systèmes le cachent et le glisser-déposer
> peut l'oublier. Si la 3ᵉ vérification affiche une erreur 404, déploie avec l'outil en ligne de commande :
> `npx netlify-cli deploy --prod --dir .` (dans le dossier du projet), ou relie un dépôt GitHub à Netlify.

## Étape 3 — Vérifier la PWA (5 minutes)

Sur <https://www.pwabuilder.com>, saisis l'adresse de ton site → **Start**.
Le rapport doit être au vert pour le **manifeste**, le **service worker** et le **HTTPS**.
Partageo a déjà : nom, icônes (dont « maskable »), captures, mode hors ligne, plein écran.

## Étape 4 — Générer le paquet Android (10 minutes)

Dans PWABuilder → **Package for stores → Android → Generate package** :

| Option | Valeur |
|---|---|
| Package ID | `ma.partageo.app` (le même qu'à l'étape 1) |
| App name / Short name | `Partageo` |
| Version / Version code | `1.0.0` / `1` |
| Display mode | Standalone |
| Status bar / Nav bar color | `#F5F4F0` |
| Splash screen color | `#F5F4F0` |
| Signing key | **Create new** |

Tu télécharges un **.zip** qui contient :
- `*.aab` → le fichier à envoyer sur Google Play ;
- `*.apk` → pour tester directement sur ton téléphone ;
- `signing.keystore` + `signing-key-info.txt` → **ta clé de signature**.

> 🔐 **TRÈS IMPORTANT : sauvegarde `signing.keystore` et `signing-key-info.txt` en lieu sûr**
> (clé USB + cloud privé). Sans eux, tu ne pourras plus jamais publier de mise à jour de l'appli.
> Ne les mets **jamais** sur ton site ni dans un dépôt public.

## Étape 5 — Créer l'appli et relier le site (30 minutes)

1. Play Console → **Créer une application** → nom « Partageo », langue Français, Application, Gratuite.
2. Remplis la **fiche** et les déclarations avec `store/FICHE-GOOGLE-PLAY.md`
   (textes, icône, image de présentation, captures, sécurité des données, classification…).
3. **Tester et publier → Tests → Test fermé → Créer une version** → envoie le fichier `.aab`.
   Accepte la **signature d'application par Google Play** (proposée par défaut).
4. Récupère les empreintes : **Tester et publier → Configuration → Intégrité de l'application**
   (ou « Signature d'application ») → copie l'empreinte **SHA-256** de :
   - la **clé de signature d'application** (celle de Google) ;
   - la **clé d'importation** (la tienne, aussi présente dans `signing-key-info.txt`).
5. Mets **les deux** dans `.well-known/assetlinks.json` :
   ```json
   "sha256_cert_fingerprints": [
     "AA:BB:…:FF (clé de signature Google)",
     "11:22:…:99 (clé d'importation)"
   ]
   ```
6. Redéploie le site et vérifie que `https://ton-domaine/.well-known/assetlinks.json` affiche bien les empreintes.

> Astuce : si tu installes l'appli et qu'une **barre d'adresse** apparaît en haut, c'est que ce fichier
> n'est pas trouvé ou que l'empreinte est fausse. Google fournit un testeur :
> <https://developers.google.com/digital-asset-links/tools/generator>

## Étape 6 — Test fermé obligatoire (14 jours)

Pour un **nouveau compte développeur personnel**, Google exige avant la production un **test fermé
avec au moins 12 testeurs inscrits pendant 14 jours d'affilée**.

1. Test fermé → **Testeurs** → crée une liste avec les adresses Gmail d'au moins 12 amis.
2. Envoie-leur le **lien d'inscription** (fourni par la Console). Ils installent l'appli depuis le Play Store.
3. Demande-leur de l'utiliser vraiment (un voyage, une coloc…) et de te faire des retours.
4. Après 14 jours : **Tableau de bord → Demander l'accès à la production** (court questionnaire sur le test).

> C'est l'occasion idéale de suivre `TESTS.md` avec de vrais utilisateurs.

## Étape 7 — Publication en production

**Production → Créer une version** → même `.aab` (ou un nouveau avec un numéro de version supérieur)
→ **Envoyer pour examen**. Délai d'examen : de quelques heures à quelques jours.

---

## Après la publication

| Tu modifies… | Que faire ? |
|---|---|
| Le code de l'appli (JS, CSS, HTML) | Redéployer le site et **augmenter `VERSION` dans `sw.js`**. L'appli Android se met à jour toute seule. |
| Le nom, les icônes, les couleurs du manifeste | Régénérer le paquet dans PWABuilder **avec la même clé** et un *version code* +1, puis le publier |
| La fiche du store | Directement dans la Play Console |

## Bon à savoir

- **Données** : l'appli Android et Chrome partagent généralement les mêmes données (même site),
  mais ce n'est pas garanti sur tous les téléphones. La sauvegarde 💾 reste le moyen sûr de transférer.
- **Liens de partage** : avec `assetlinks.json` en place, un lien `https://ton-domaine/#/import/…`
  ouvert sur Android peut proposer de s'ouvrir dans l'appli Partageo.
- **App Store (iPhone)** : ce sera une étape séparée (compte Apple à 99 $/an, Mac, examen plus strict).
