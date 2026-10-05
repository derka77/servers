# Ma Garde-Robe — refonte visuelle « Atelier »

Toutes les fonctionnalités sont conservées. Seule la présentation change.

## Ce qui a changé
- **Système de style unique** (`src/index.css` réécrit) : fond papier chaud, encre profonde,
  une couleur d'accent (le thème choisi dans Profil), laiton discret pour les réussites.
  Fin des dégradés dorés, du verre dépoli et des bordures épaisses.
- **Typographie** : Fraunces (titres) + Inter (interface). Plus de textes à 8–9 px.
- **Mannequin** (`src/components/Mannequin.tsx`, nouveau) : croquis visible, utilisé dans
  l'écran d'accueil (il n'y en avait pas) et dans le Styliste.
- **Tailles des vêtements** : les zones (haut, bas, robe, veste, chaussures, sac, accessoire)
  sont définies en % d'une scène au ratio 1:2 et alignées sur l'anatomie du croquis
  (épaules 20 %, taille 41 %, hanches 55 %, mains 63 %, chevilles 94 %).
  Elles s'adaptent à toutes les largeurs d'écran.
- **Navigation** : barre flottante arrondie, onglet actif en pastille.
- **Cartes, carrousels, filtres** : surfaces blanches, ombres douces, rayons 14–20 px,
  contrôles segmentés et interrupteurs unifiés (`.seg`, `.switch`, `.icon-btn`).

## Où regarder
- `src/index.css` — tout le design (variables en haut du fichier).
- `src/components/Mannequin.tsx` — le croquis.
- `src/components/OutfitStudio.tsx`, `src/screens/Home.tsx` — la scène.
- `index.html`, `tailwind.config.js` — polices.

## Corrections TypeScript (après la refonte)
`tsc --noEmit` passe désormais sans erreur. Corrections :
- `lib/api.ts` : ré-export du type `WearLogEntry` (utilisé par `Stylist`, `WearLogModal`, `GarmentFormModal`).
- `types.ts` : `NewGarment` ne rend plus obligatoires `wardrobe`, `is_demo`, `is_draft`.
- `GarmentFormModal.tsx` : ajout de `filteredSuggestions` (suggestions de nom par catégorie, qui manquaient).
- `BatchUploadModal.tsx`, `lib/demoWardrobe.ts` : champs manquants (`purchase_price`, attributs d'occasion) ajoutés.
- `Home.tsx` : type exact du filtre de statut transmis à la Garde-robe.

## Connu / hors périmètre
- Le fichier `.env` (clés Supabase) n'est pas dans le dépôt ; il est inclus dans le zip destiné à Bolt.
