# Partageo — Checklist de tests manuels (V1)

Coche chaque case une fois le test réussi. En cas de problème, note ce que tu as fait,
ce que tu attendais et ce que tu as vu.

---

## 0. Préparer

- **Double-clic** : ouvrir `index.html` → l'appli s'affiche (sans installation ni hors ligne).
- **Serveur local** (pour tester l'installation et le hors-ligne) : dans le dossier du projet,
  lancer `python -m http.server 8000`, puis ouvrir <http://localhost:8000>.
- **Téléphone** : déposer le dossier sur <https://app.netlify.com/drop> et ouvrir l'adresse `https://…` obtenue.
- **Repartir de zéro** : F12 → Application → Storage → *Clear site data* (efface toutes les données !).

---

## 1. Tests automatiques (console)

- [ ] F12 → Console → taper `Partageo.tests.run()` → **✅ 82 vérifications réussies**

> En double-clic, tous les tests sont chargés. Ils couvrent : centimes, répartitions,
> soldes, remboursements, numéros WhatsApp, validité de la démo, saisie en langage naturel,
> générateur de lien de partage (format compact) et fusion de deux versions d'un groupe.

---

## 2. Groupe de démonstration

Accueil vide → **« ✨ Essayer avec un exemple »**.

- [ ] Le groupe « 🏔️ Voyage Chefchaouen » s'ouvre, avec 4 participants :
      Youssef *(moi)*, Sara & Omar *(×2)*, Kenza & Adam *(×1,5)*, Mehdi
- [ ] **Total dépensé : 4 219,90 DH**, 10 dépenses regroupées par jour (Aujourd'hui, Hier…)
- [ ] Onglet **Soldes** — valeurs attendues :

  | Participant | A payé | Sa part | Solde |
  |---|---:|---:|---:|
  | Sara & Omar | 2 152,40 DH | 1 482,09 DH | **+670,31 DH** |
  | Youssef | 937,50 DH | 876,52 DH | **−39,02 DH** |
  | Kenza & Adam | 965,00 DH | 1 162,28 DH | **−197,28 DH** |
  | Mehdi | 165,00 DH | 699,01 DH | **−434,01 DH** |

  *(Youssef et Mehdi : leur solde tient compte du remboursement de 100 DH de Mehdi à Youssef.)*
- [ ] Bandeau en haut des soldes : **« Tu dois 39,02 DH »**
- [ ] Onglet **Rembourser** — 3 virements :
  Mehdi → Sara & Omar **434,01 DH** · Kenza & Adam → Sara & Omar **197,28 DH** · Toi → Sara & Omar **39,02 DH**
- [ ] « Remboursements effectués » : Mehdi → Toi, 100,00 DH, hier
- [ ] Toucher « Essence aller » → mode **Parts** → aperçu :
      Youssef 81,82 · Sara & Omar 163,63 · Kenza & Adam 122,73 · Mehdi 81,82 (total 450,00 ✓)
- [ ] Accueil : la carte du groupe affiche **« Tu dois 39,02 DH »**

---

## 3. Groupes et participants

- [ ] Créer un groupe : nom, emoji, couleur, 3 prénoms → il apparaît sur l'accueil
- [ ] **Entrée** dans un prénom → passe à la ligne suivante (ou en crée une)
- [ ] Parts **− / +** : de 0,5 à 20 par pas de 0,5
- [ ] « C'est moi » : le badge **moi** apparaît sur le bon participant
- [ ] Nom de groupe vide → message « Donne un nom à ton groupe. »
- [ ] Deux fois « Sara » / « sara » → message « apparaît deux fois »
- [ ] Retirer un participant **qui a des dépenses** → refusé avec un message
- [ ] Modifier le groupe (✎) → les changements sont visibles
- [ ] Supprimer le groupe → toast **Annuler** → le groupe revient (5 s, barre de progression)
- [ ] Survoler / atteindre le toast au clavier → le compte à rebours se met en pause

---

## 4. Dépenses

- [ ] Bouton **+** flottant → formulaire, curseur dans le montant
- [ ] Groupe vide : toucher l'exemple « Resto 450 DH » → formulaire pré-rempli
- [ ] **Égal** — 100 DH pour 3 → aperçu **33,34 / 33,33 / 33,33**
- [ ] **Parts** — modifier les parts d'une ligne → l'aperçu change
- [ ] **Montants** — saisie incomplète → « Reste à répartir : … », puis **« ✓ Le compte est bon »**
- [ ] **Montants** — dépasser le total → « Trop réparti : … » et refus d'enregistrer
- [ ] **%** — 50 + 30 → refus ; 50 + 50 → « ✓ Total : 100 % »
- [ ] Passer de « Montants » à « % » puis revenir → les valeurs saisies sont conservées
- [ ] « Tout le monde » coche / décoche tous les bénéficiaires
- [ ] Libellé vide → la dépense prend le nom de la catégorie
- [ ] Montants acceptés : `1234,50` · `1 234,50` · `85.5` · `1.200` (= 1 200 DH)
- [ ] Erreurs : montant vide ou 0 · aucun bénéficiaire → message clair, focus sur le champ
- [ ] Modifier une dépense → la liste et les soldes se mettent à jour
- [ ] Supprimer une dépense → toast **Annuler** → elle revient à la même place
- [ ] « ta part » s'affiche sous les dépenses qui me concernent

---

## 4 bis. Saisie en langage naturel (barre ✨ en haut des dépenses)

Dans le groupe de démo, taper chaque phrase et vérifier l'aperçu 💡 puis le formulaire (Entrée) :

| Phrase | Payeur | Montant | Pour qui | Libellé / catégorie |
|---|---|---:|---|---|
| `Youssef 450 resto pour tous` | Tu as payé | 450,00 DH | pour tous | Resto · 🍽️ |
| `Sara 120 taxi pour Sara et Mehdi` | Sara & Omar | 120,00 DH | Sara & Omar et Mehdi | Taxi · 🚕 |
| `Mehdi a payé 85,50 courses sauf Youssef` | Mehdi | 85,50 DH | 3 personnes | Courses · 🛒 |
| `j'ai payé 1 200 dh riad 2 nuits` | Tu as payé | 1 200,00 DH | pour tous | Riad 2 nuits · 🏨 |
| `payé par Kenza 60 cafés pour tout le monde sauf Mehdi` | Kenza & Adam | 60,00 DH | 3 personnes | Cafés · 🍽️ |
| `Mehdy 300 essence` *(faute de frappe)* | Mehdi | 300,00 DH | pour tous | Essence · 🚕 |
| `meh 50 glace pour kenza` *(début de prénom)* | Mehdi | 50,00 DH | Kenza & Adam | Glace · 🍽️ |

- [ ] L'aperçu se met à jour à chaque lettre ; ce qui manque s'affiche en rouge (« montant ? »)
- [ ] Phrase complète + Entrée → formulaire pré-rempli, focus sur **« Ajouter la dépense »** → Entrée enregistre
- [ ] Phrase incomplète (ex. `taxi`) → formulaire pré-rempli, à compléter, rien n'est enregistré sans confirmation
- [ ] Barre vide + Entrée → formulaire vierge
- [ ] Après enregistrement, la barre est vidée
- [ ] Formulaire classique : taper « Facture Lydec » dans le libellé → catégorie **Logement** cochée automatiquement
- [ ] Choisir une catégorie à la main, puis modifier le libellé → la catégorie choisie ne change plus

---

## 5. Soldes et remboursements

- [ ] Somme des soldes = 0 (vérifier sur un petit groupe)
- [ ] Barres : vert vers la droite = on lui doit · corail vers la gauche = il doit
- [ ] Jamais plus de virements que (nombre de personnes − 1)
- [ ] **Marquer comme remboursé** → le virement disparaît, apparaît dans l'historique, soldes à jour
- [ ] Toast **Annuler** après « Marquer comme remboursé » → tout revient
- [ ] Supprimer un remboursement (✕) → **Annuler** → il revient
- [ ] Tout rembourser → **« Tout est réglé ! 🎉 »**

---

## 6. WhatsApp

- [ ] **Envoyer le récap** → WhatsApp s'ouvre avec : total, soldes, virements
- [ ] **Rappel** vers une personne **avec** numéro (ex. `06 12 34 56 78`) → sa conversation s'ouvre directement
- [ ] **Rappel** vers une personne **sans** numéro → WhatsApp demande de choisir le contact
- [ ] Pas de bouton « Rappel » sur mes propres dettes
- [ ] Le message dit « à **me** rembourser » quand c'est moi le créancier
- [ ] Les accents, emojis et le texte en *gras* s'affichent correctement dans WhatsApp

---

## 7. Sauvegarde (💾 sur l'accueil)

- [ ] **Exporter** → téléchargement de `partageo-sauvegarde-AAAA-MM-JJ.json`, date « Dernière sauvegarde » à jour
- [ ] Supprimer un groupe, puis **Importer** le fichier → « Ajouter à mes groupes » → il revient
- [ ] **Tout remplacer** → **Annuler** → retour à l'état d'avant
- [ ] Importer un fichier qui n'est pas du JSON → « Ce fichier n'est pas une sauvegarde lisible »
- [ ] Importer un JSON modifié à la main (ex. `"amount": -5`) → message d'erreur clair, rien n'est cassé
- [ ] Recharger la page (F5) → toutes les données sont toujours là

---

## 8. PWA (via `http://localhost:8000` ou HTTPS)

- [ ] Ordinateur : icône **Installer** dans la barre d'adresse + carte « 📲 Installer » sur l'accueil
- [ ] Après installation : fenêtre séparée, icône verte « disque partagé »
- [ ] F12 → Application → Service Workers → **Offline** → recharger → l'appli fonctionne
- [ ] Android : installer depuis la carte → l'appli s'ouvre en plein écran
- [ ] iPhone (Safari) : la carte explique « Partager → Sur l'écran d'accueil »
- [ ] Mode avion sur le téléphone → l'appli installée s'ouvre et enregistre normalement
- [ ] La carte « Installer » se masque avec ✕ et ne revient plus
- [ ] En double-clic (`file://`) : **aucune erreur rouge** dans la console

---

## 9. Confort, accessibilité, design

- [ ] **Clavier seul** : Tab parcourt tout, Entrée valide, **Échap ferme** les fenêtres, le focus est toujours visible
- [ ] Après fermeture d'une fenêtre, le focus revient sur le bouton qui l'a ouverte
- [ ] **Mode sombre** (réglage du système) : couleurs adaptées, textes lisibles
- [ ] **Réduire les animations** (réglage du système) : plus d'animations
- [ ] Téléphone (F12 → mode responsive, 360 px de large) : rien ne dépasse, boutons faciles à toucher
- [ ] Zoom du navigateur à 200 % : tout reste utilisable
- [ ] Prénom très long ou nom de groupe avec `<b>test</b>` → affiché tel quel, sans casser la page

---

## 10. Partage de groupe par lien / QR code (V2)

> Pour un vrai test entre deux téléphones, l'appli doit être hébergée (ex. Netlify).
> Sur un seul ordinateur : utilise deux navigateurs différents (ex. Chrome et Edge), ou une fenêtre de navigation privée.

**Téléphone A**
- [ ] Dans un groupe, bouton **📤** → fenêtre « Partager le groupe » avec un QR code net
- [ ] Taille indiquée (démo : environ **0,9 Ko**) ; « Inclure les numéros » décoché par défaut
- [ ] **Envoyer le lien sur WhatsApp** → message « Rejoins le groupe … » + lien
- [ ] **Copier le lien** → toast « Lien copié ✓ » ; **Autres applis…** (téléphone) → menu de partage
- [ ] En double-clic (`file://`) : un avertissement explique que le lien ne marchera pas ailleurs

**Téléphone B**
- [ ] Scanner le QR (appareil photo) ou ouvrir le lien → écran « On t'a partagé un groupe » avec nom, total, participants
- [ ] Choisir « Qui es-tu ? » → **Ajouter ce groupe** → le groupe s'ouvre, avec le bon badge **moi**
- [ ] Bouton Retour du navigateur → ne réimporte pas le groupe
- [ ] Les numéros WhatsApp ne sont présents que si A a coché l'option

**Aller-retour et fusion**
- [ ] B ajoute une dépense et en supprime une, puis partage ; A ajoute une autre dépense
- [ ] A ouvre le lien de B → « Tu as déjà ce groupe » → **Mettre à jour mon groupe**
- [ ] Résultat chez A : la dépense de A **et** celle de B sont présentes, la dépense supprimée par B a disparu,
      le badge **moi** de A n'a pas changé
- [ ] Toast **Annuler** après la mise à jour → retour à la version d'avant

**Cas particuliers**
- [ ] 💾 → « Ouvrir un lien de partage » : coller le lien (ou tout le message WhatsApp) → **Ouvrir** → écran d'import
- [ ] Coller un texte quelconque → « Ce n'est pas un lien de partage Partageo. »
- [ ] Lien coupé ou modifié → « Impossible d'ouvrir ce lien… » + bouton de retour, rien n'est cassé
- [ ] Groupe d'une vingtaine de dépenses ou plus → message « QR code très détaillé… » (le scan reste possible de près)
- [ ] Groupe d'environ 90 dépenses ou plus → « trop grand pour un QR code », le lien fonctionne toujours

---

## Résultat

| Section | OK | Remarques |
|---|---|---|
| 1. Tests automatiques | | |
| 2. Démo | | |
| 3. Groupes | | |
| 4. Dépenses | | |
| 4 bis. Langage naturel | | |
| 5. Soldes / remboursements | | |
| 6. WhatsApp | | |
| 7. Sauvegarde | | |
| 8. PWA | | |
| 9. Accessibilité / design | | |
| 10. Partage lien / QR | | |
