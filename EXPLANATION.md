# Fonctionnement de l'Application de Gestion de Budget

Ce document décrit de manière conceptuelle le fonctionnement de l'application, les données qu'elle manipule et les informations qu'elle restitue à l'utilisateur, afin de servir de base pour repenser le design et l'expérience utilisateur (UX/UI).

## 1. Concept Général
L'application est un outil complet de gestion des finances personnelles. Son but est de donner à l'utilisateur une vue claire de ses revenus, ses dépenses courantes, ses abonnements, ses économies et son patrimoine global, tout en lui permettant de se fixer des limites budgétaires.

## 2. Les Entités et Données Exploitéées

### 2.1 Les Transactions (Les flux financiers)
Les transactions sont la matière première de l'application. Chaque transaction représente un mouvement d'argent.
**Données saisies par l'utilisateur :**
*   **Type** : Revenu, Dépense, Salaire, Transfert vers un investissement, Retour d'un investissement.
*   **Montant** : La valeur numérique.
*   **Date** : Le jour de l'opération.
*   **Catégorie** : Classement de la transaction.
*   **Note** : Un texte libre descriptif (optionnel).
*   **Tags** : Des étiquettes pour croiser les données (optionnel).
*   **Spécificités métiers :**
    *   *Salaire* : L'utilisateur peut indiquer une part "Épargnée" directement à la source. Cette part n'est pas comptée dans l'argent disponible pour les dépenses courantes.
    *   *Chèques Repas* : Sur une dépense, l'utilisateur peut indiquer qu'une partie a été payée en Chèque Repas (si la catégorie le permet).

### 2.2 Les Catégories
Elles permettent de structurer les transactions pour les analyses.
**Données gérées :**
*   **Nom** : Libellé de la catégorie (ex: Alimentation, Transport, Salaire).
*   **Type** : Revenu ou Dépense.
*   **Hiérarchie** : Une catégorie peut avoir une catégorie parente (ex: Alimentation > Restaurants).
*   **Éligibilité** : Certaines catégories peuvent être marquées comme éligibles aux paiements par chèques repas.

### 2.3 Les Tags (Étiquettes)
Ils offrent un axe d'analyse transversal, indépendant des catégories (ex: Tag "Voyage au Japon" appliqué à des dépenses d'avion, de nourriture et d'hôtels).
**Données saisies :**
*   **Nom** : Libellé du tag.
*   **Couleur** : Code couleur pour repérage visuel.

### 2.4 Les Abonnements (Opérations récurrentes)
Ce sont des opérations qui se répètent automatiquement dans le temps. L'application s'en sert pour générer les transactions futures.
**Données saisies :**
*   **Nom** : Identifiant de l'abonnement (ex: Loyer, Netflix).
*   **Type** : Revenu ou Dépense.
*   **Montant** : Somme prélevée.
*   **Fréquence** : Hebdomadaire, Mensuelle, Annuelle ou "En plusieurs fois".
*   **Dates** : Date de début (premier prélèvement) et Date de fin (optionnelle).
*   **Spécificité "En plusieurs fois"** : L'utilisateur indique un montant global et un nombre de mensualités. L'application peut "avancer" l'abonnement si l'utilisateur décide de payer plusieurs échéances d'un coup.

### 2.5 Les Objectifs de Dépenses (Budgets)
L'utilisateur se fixe des limites à ne pas dépasser.
**Données saisies :**
*   **Objectif par défaut** : Le montant mensuel cible global (ex: 600€).
*   **Objectifs spécifiques** : L'utilisateur peut définir un montant différent pour un mois donné (ex: 1000€ en août pour les vacances).

### 2.6 Module Chèques Repas (Titres Restaurant)
Un module pour gérer un portefeuille de chèques repas ou une carte restaurant.
**Données saisies et gérées :**
*   **Crédits (Recharges)** : Montant et Date d'obtention. L'application calcule une expiration à +12 mois.
*   **Dépenses externes** : Achats réalisés hors des transactions bancaires classiques.
*   **Règle métier (FIFO)** : Toute dépense payée en chèques repas (via une transaction ou externe) "consomme" automatiquement les crédits les plus anciens encore valides (First-In, First-Out).

### 2.7 Investissements et Patrimoine
Permet le suivi des actifs financiers (Bourse, Crypto, etc.).
**Données saisies :**
*   **Actif** : Nom, Type de placement, Date d'acquisition.
*   **Mouvements** : L'argent est injecté via les transactions de type "Transfert vers investissement".
*   **Historique de valeur** : L'utilisateur déclare périodiquement (ex: tous les mois) la valeur actuelle estimée de l'actif.

### 2.8 Simulations Financières
Permet de se projeter dans le futur.
**Données saisies :**
*   **Solde actuel de départ** : Somme d'argent sur le compte à l'instant T.
*   **Événements simulés** : Des revenus ou dépenses futures fictives (ex: "Prime prévue en décembre", "Achat voiture l'an prochain").

---

## 3. Les Informations Fournies et Calculées par l'Application (Restitution)

C'est ce que l'interface doit mettre en valeur pour l'utilisateur.

### A. Le Suivi du Mois Courant (Tableau de bord)
*   **Progression du budget** : Combien a été dépensé par rapport à l'objectif du mois. L'interface doit clairement montrer si on est dans les clous ou en dépassement.
*   **Revenus et Dépenses** : Les totaux du mois.
*   **Répartition** : Le poids de chaque catégorie dans les dépenses du mois (souvent sous forme de graphique ou de barres).

### B. Le Bilan Mensuel et les Économies
*   **Dépenses Réelles** : Somme des dépenses. (Note métier : le montant payé en chèques repas est déduit du total de la dépense, car cet argent n'est pas sorti du compte bancaire).
*   **Revenus Réels** : Somme des revenus (hors part épargnée du salaire).
*   **Bénéfice Réel** : Revenus réels moins Dépenses réelles. Indique si l'utilisateur s'est enrichi ou appauvri ce mois-ci.
*   **Économie par rapport au budget** : La différence entre l'objectif visé et les dépenses réelles.
*   **Épargne** : Le total mis de côté à la source.

### C. L'Évolution Long Terme
*   **Historique des dépenses** : Vue de l'évolution des revenus et dépenses sur les derniers mois (ex: 6 mois).
*   **Analyse par catégorie** : Savoir combien on a dépensé en "Alimentation" sur toute l'année.

### D. Le Patrimoine
*   **Trésorerie** : L'argent liquide disponible (calculé d'après les transactions).
*   **Valeur du portefeuille** : La somme des dernières valeurs estimées des investissements.
*   **Performance** : La différence entre la valeur actuelle des investissements et l'argent qui y a été injecté (Plus-value / Moins-value).

### E. Prédictions
*   **Courbe de projection** : Une courbe qui montre l'évolution du solde bancaire sur les 24 prochains mois. Elle est calculée en prenant le solde actuel, en ajoutant les abonnements mensuels, et en injectant les événements simulés par l'utilisateur.
*   **Solde des Chèques Repas** : Combien il reste sur la carte, combien a été dépensé, et alerte sur les crédits proches de l'expiration.

---

## Résumé de l'expérience utilisateur attendue
1.  **Saisie de la donnée** : L'utilisateur doit pouvoir saisir ses transactions quotidiennes de la manière la plus fluide et rapide possible.
2.  **Lecture immédiate** : L'utilisateur doit comprendre en un coup d'œil l'état de ses finances du mois en cours.
3.  **Analyse approfondie** : L'utilisateur doit pouvoir creuser ses données (par mois, par catégorie, par tag, voir son patrimoine global).
4.  **Paramétrage** : L'utilisateur gère sa propre arborescence de catégories, ses abonnements, et son paramétrage de chèques repas.