# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Groupes d'amis en voyage au Maroc. Ils notent les dépenses sur le moment, sur leur téléphone (au restaurant, dans un taxi, au riad), puis règlent qui doit quoi à la fin du séjour. Familles et colocataires sont des publics secondaires.

## Product Purpose
Partager les dépenses d'un groupe et savoir en quelques secondes qui doit combien à qui, avec le moins de virements possible. Réussite : personne n'a besoin de faire de calcul ni de tableau, et le groupe se règle sans friction.

## Positioning
Plus rapide et plus simple que Tricount ou Splitwise, et pensé pour le Maroc :
- saisie d'une dépense en une phrase (« Youssef 450 resto pour tous ») ;
- montants en dirhams, récap et rappels via WhatsApp, interface en français ;
- moins d'écrans, moins de réglages.

## Operating Context
Usage sur téléphone, souvent dehors et en mouvement, parfois sans réseau. Le récap et les rappels partent sur WhatsApp. Un groupe se partage par lien ou QR code.

## Capabilities and Constraints
- Groupes (emoji + couleur), participants avec parts (couple = 2, enfant = 0,5).
- 4 modes de répartition : égal, parts, montants exacts, pourcentages.
- Soldes, remboursements optimisés, historique des remboursements.
- PWA hors ligne, sans compte ni serveur : tout reste sur l'appareil. Export / import JSON.
- HTML/CSS/JS sans framework ni étape de compilation ; hébergé sur Netlify.
- Cible prioritaire : Android (publication Google Play prévue via TWA). Doit aussi bien rendre sur iPhone.
- Montants au format « 1 234,50 DH », mode sombre automatique.

## Brand Commitments
Nom : Partageo. Ton : tutoiement, simple et chaleureux.

## Evidence on Hand
Groupe de démonstration « Voyage Chefchaouen » (js/demo.js). Aucun témoignage, chiffre d'usage ou avis à afficher : ne pas en inventer.

## Product Principles
1. Une dépense se note en quelques secondes, sans quitter la conversation du groupe.
2. La réponse à « qui doit combien à qui » est toujours visible en premier.
3. Familier pour un Marocain : dirhams, WhatsApp, prénoms et lieux d'ici.
4. Moins d'options visibles ; la complexité (parts, pourcentages) n'apparaît que si on la demande.
