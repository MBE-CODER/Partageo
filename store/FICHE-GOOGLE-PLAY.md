# Fiche Google Play — Partageo

Textes prêts à copier-coller dans la **Google Play Console** (Présence sur le Store → Fiche principale).
Les limites de longueur de Google sont indiquées entre parenthèses.

---

## Nom de l'application (30 caractères max)

```
Partageo – Dépenses partagées
```

## Description courte (80 caractères max)

```
Partagez les dépenses entre amis, en coloc ou en voyage. En dirhams, hors ligne.
```

## Description complète (4 000 caractères max)

```
Fini les comptes compliqués après un voyage, un resto ou un mois de colocation : Partageo calcule qui doit quoi, en quelques secondes.

✨ ULTRA RAPIDE
Tapez simplement « Youssef 450 resto pour tous » : Partageo comprend qui a payé, combien, et pour qui. Vous vérifiez, vous validez, c'est fait.

⚖️ ÉQUITABLE, MÊME POUR LES CAS COMPLIQUÉS
• Parts égales, montants exacts, pourcentages ou parts pondérées
• Un couple peut compter pour 2, un enfant pour 0,5
• Calcul au centime près, sans erreur d'arrondi

🤝 LE MOINS DE VIREMENTS POSSIBLE
Partageo calcule automatiquement les remboursements les plus simples. Un bouton « Marquer comme remboursé » et c'est réglé.

💬 PENSÉ POUR WHATSAPP
• Envoyez le récap du groupe en un geste
• Un rappel poli et pré-rédigé pour chaque personne qui doit de l'argent

📲 PARTAGE DE GROUPE SANS COMPTE
Partagez un groupe par lien ou QR code : vos amis le retrouvent sur leur téléphone. Chacun peut ajouter ses dépenses et renvoyer le lien, les versions sont fusionnées automatiquement.

🔒 VOS DONNÉES RESTENT CHEZ VOUS
• Aucun compte, aucune inscription
• Aucune publicité, aucun pisteur
• Tout est enregistré sur votre téléphone, rien sur nos serveurs
• Sauvegarde et restauration par fichier

📴 FONCTIONNE SANS INTERNET
En randonnée, à l'étranger ou dans le métro : Partageo marche partout.

🇲🇦 PENSÉ POUR LE MAROC
Montants en dirhams (1 234,50 DH), catégories du quotidien (petit taxi, Marjane, Lydec, riad…), interface entièrement en français.

Idéal pour :
• Les voyages entre amis (Chefchaouen, Marrakech, Dakhla…)
• Les colocations (loyer, internet, électricité, courses)
• Les sorties, les anniversaires, les vacances en famille

Simple, rapide et gratuit. Essayez avec le groupe de démonstration intégré !
```

---

## Catégorisation

| Champ | Valeur |
|---|---|
| Type d'application | Application |
| Catégorie | **Finance** (ou « Style de vie ») |
| Tags suggérés | Budget, Partage de frais, Voyage |
| Langue par défaut | Français (France) – fr-FR |
| Prix | Gratuit |
| Contient des annonces | **Non** |
| Achats intégrés | **Non** |

## Coordonnées

| Champ | Valeur |
|---|---|
| E-mail de contact | `smart.fun.mad@gmail.com` *(obligatoire, visible publiquement)* |
| Site web | `https://partageo-app.netlify.app/` |
| Politique de confidentialité | `https://partageo-app.netlify.app/confidentialite.html` |

---

## Éléments graphiques (dossier `store/`)

| Élément | Fichier | Exigence Google |
|---|---|---|
| Icône | `store/icone-512.png` | 512×512 PNG ✓ |
| Image de présentation | `store/image-presentation-1024x500.png` | 1024×500 ✓ |
| Captures téléphone (2 à 8) | `store/captures/1-accueil.png` … `7-partage-qr.png` | 1080×1920 (9:16) ✓ |

Ordre conseillé des captures : 2-depenses, 3-soldes, 5-saisie-rapide, 4-rembourser, 7-partage-qr, 1-accueil, 6-formulaire.

---

## Formulaire « Sécurité des données » (Contenu de l'application → Sécurité des données)

| Question | Réponse |
|---|---|
| Votre application collecte-t-elle ou partage-t-elle des types de données utilisateur requis ? | **Non** |
| Toutes les données sont-elles chiffrées en transit ? | Sans objet (aucune donnée transmise) |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | Les données sont uniquement sur l'appareil : suppression dans l'appli ou par désinstallation |

> Pourquoi « Non » ? Google considère comme « collectées » les données envoyées hors de l'appareil
> **vers vous (le développeur) ou des tiers**. Partageo n'envoie rien : le partage WhatsApp et les liens
> de partage sont déclenchés par l'utilisateur, vers les personnes de son choix.

## Autres déclarations (Contenu de l'application)

| Rubrique | Réponse |
|---|---|
| Accès à l'application | Toutes les fonctionnalités sont accessibles sans identifiants |
| Annonces | Pas d'annonces |
| Classification du contenu | Questionnaire : catégorie « Utilitaires, productivité… » → aucun contenu sensible → **Tout public** |
| Public cible | 18 ans et plus (évite les obligations « Famille » ; l'appli reste utilisable par tous) |
| Application d'actualités | Non |
| Applications gouvernementales | Non |
| Fonctionnalités financières | « Mon application ne propose aucune fonctionnalité financière » (pas de paiement, pas de prêt, pas de banque : simple calcul) |
| Santé | Non |
