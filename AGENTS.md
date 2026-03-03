# Instructions pour le projet de Gestion de Budget

- **Type de projet:** Application web côté client uniquement (HTML/CSS/JS).
- **Réseau:** Aucune dépendance réseau externe (pas de CDN, pas de polices web externes, pas de scripts tiers). L'application doit fonctionner à 100% hors ligne.
- **Technologies:**
  - HTML natif
  - CSS natif (Grid, Flexbox, UI moderne, pas de librairie externe type Tailwind)
  - JS natif (Vanilla JS, Canvas API pour les graphiques, pas de librairie type Chart.js)
- **Fonctionnalités clés:**
  - Transactions ponctuelles (Revenus, Dépenses).
  - Transactions récurrentes (Abonnements hebdo/mensuels/annuels) qui *génèrent de vraies transactions* à leur échéance pour historisation.
  - Catégories et sous-catégories personnalisables avec arborescence (ex: Transport -> Voiture -> Essence).
  - Graphiques "faits maison" dessinés sur des éléments `<canvas>` (camembert, histogrammes).
  - Sauvegarde locale via `localStorage`.
  - Export/Import des données au format JSON.
- **Organisation du code:** Le code doit être clair, modulaire, commenté et structuré de préférence en `index.html`, `style.css` et `script.js`.
