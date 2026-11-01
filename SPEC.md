# Spec : Popperz

> Statut : **approuvée le 2026-11-01**. Plan dans `tasks/plan.md`, tâches dans `tasks/todo.md`.

## Décisions prises (réponses du 2026-11-01)

1. **Bloqueur de pub complet** : bannières, trackers, pubs vidéo, comme uBlock Origin / AdGuard, **plus** les protections que les autres gèrent mal (popunders, calques piégés, Zappeur).
2. **Navigateurs v1** : Chromium desktop (Chrome, Opera GX, Edge, Brave). Une seule base de code Manifest V3.
3. **Firefox** : plus tard. Le framework choisi (WXT) le permet sans réécriture.
4. **Mobile** : abandonné. Chrome et Opera GX mobile n'acceptent pas d'extensions.
5. **Distribution** : pas de store pour l'instant. Un zip téléchargeable sur ton site, avec un guide d'installation. Publication sur les stores (Chrome Web Store, Opera Addons) plus tard, si l'extension fait ses preuves.
6. **Langues** : interface en français et en anglais (langue du navigateur, français par défaut).
7. **Icône** : flacon fendu par un éclair, mauve `#C88ABB`, source `design/icons/8-logo-fendu.svg`.
8. Aucune télémétrie, aucun compte. Les données de navigation ne quittent jamais la machine.

### Contraintes à connaître

- **Installation hors store sur Chrome.** Chrome refuse d'installer un `.crx` venant d'un site. Le seul chemin : télécharger le zip, le décompresser, puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée ». Chrome peut afficher un avertissement sur les extensions en mode développeur. Opera GX accepte le même chemin. Le guide d'installation sur ton site devra montrer ces étapes en captures. Les mises à jour ne sont pas automatiques : l'utilisateur retélécharge le zip.
- **Listes de filtres.** EasyList et EasyPrivacy sont sous double licence GPLv3 / CC BY-SA 3.0. Les embarquer impose de créditer la source et de garder une licence compatible pour Popperz (GPLv3 proposée).
- **Manifest V3.** Le blocage réseau passe par `declarativeNetRequest`. Chrome garantit 30 000 règles statiques actives par extension, et plus si le quota global du navigateur le permet. Les listes doivent donc être converties et triées au build.

## Objectif

**Problème.** Les bloqueurs classiques bloquent les bannières mais laissent passer le pire : sur les sites intrusifs, un calque invisible ou un écouteur global ouvre un onglet de pub à chaque clic, ou toutes les ~10 s.

**Utilisateur.** Toi d'abord, puis toute personne qui télécharge Popperz depuis ton site.

**Promesse.** « Comme les autres, mais en mieux » : le même blocage de pub que les bloqueurs connus, plus une protection anti-popunder solide, plus un moyen simple de nettoyer une page à la main.

### Capability map

Le projet regroupe plusieurs capacités testables séparément. Elles se construisent dans cet ordre :

| Module id | Responsabilité | Dépend de |
|---|---|---|
| `shell` | Squelette WXT, manifest, stockage des réglages, i18n FR/EN, service worker | — |
| `netblock` | Blocage réseau : listes EasyList + EasyPrivacy + liste popunder converties en règles `declarativeNetRequest` au build | `shell` |
| `cosmetic` | Masquage d'éléments par CSS : filtres cosmétiques génériques et par domaine issus des listes | `shell`, `netblock` (même pipeline de conversion) |
| `popguard` | Anti-popunder en deux couches (page + service worker) | `shell` |
| `overlay` | Détection et neutralisation des calques invisibles qui captent les clics | `shell` |
| `zapper` | Sélection manuelle d'un élément à supprimer, règle mémorisée par domaine | `shell`, `cosmetic` (mêmes règles CSS) |
| `popup` | Interface : interrupteur par site, compteurs, Zappeur, règles du site, DA swaks | tous les autres |
| `distrib` | Zip de release, numéro de version, page d'installation pour ton site | `popup` |

Ordre de build : `shell` → `netblock` → `popguard` → `overlay` → `cosmetic` → `zapper` → `popup` → `distrib`.

`popguard` passe avant `cosmetic` parce que c'est le problème qui t'a fait lancer le projet.

### Fonctionnalités

1. **Blocage réseau** (`netblock`). Requêtes vers régies et trackers bloquées avant chargement. Listes embarquées : EasyList, EasyPrivacy, liste maison des régies popunder (PopAds, PropellerAds, etc.).
2. **Masquage cosmétique** (`cosmetic`). Les emplacements de pub vides ou les blocs restants sont masqués en CSS, pour éviter les trous et les « Désactivez votre bloqueur » basiques.
3. **Anti-popunder** (`popguard`). Un clic n'ouvre un nouvel onglet que si l'utilisateur a cliqué sur un vrai lien ou bouton qui vise cette page. Tout autre onglet ouvert « par surprise » est bloqué ou fermé aussitôt.
4. **Anti-calque** (`overlay`). Les éléments transparents qui recouvrent la page pour capter les clics sont neutralisés. S'ils sont réinjectés, ils sont neutralisés de nouveau.
5. **Zappeur** (`zapper`). Tu survoles un élément, tu cliques, il disparaît. La règle est gardée pour ce domaine et réappliquée à chaque visite. Annulable depuis le popup.
6. **Popup** (`popup`). Interrupteur on/off pour le site courant, compteurs (pubs bloquées, popunders bloqués), bouton Zappeur, liste des règles du site avec suppression, FR/EN.

### User stories

- Quand je navigue, les pubs et trackers des listes ne se chargent pas.
- Quand je clique n'importe où sur une page piégée, aucun onglet de pub ne s'ouvre et mon clic atteint l'élément visé.
- Quand je clique sur un vrai lien `target="_blank"`, le nouvel onglet s'ouvre normalement.
- Je peux supprimer à la main un élément gênant, et il ne revient pas à ma prochaine visite.
- Je peux désactiver Popperz sur un site qui casse, en un clic.
- Mon navigateur est en anglais : l'interface est en anglais.

## Tech Stack

| Élément | Choix | Pourquoi |
|---|---|---|
| Langage | TypeScript 5 | Types de l'API `chrome.*`, moins de bugs silencieux |
| Framework d'extension | [WXT](https://wxt.dev) | Manifest V3, builds Chrome / Opera / Edge (et Firefox plus tard) depuis une seule base, rechargement à chaud, zip de release |
| UI du popup | HTML + CSS + TS vanilla | Le popup tient en un écran, React serait du poids mort |
| i18n | `chrome.i18n` + `_locales/fr` et `_locales/en` | Natif aux extensions, aucune dépendance |
| Conversion des listes | Script de build Node : syntaxe Adblock → règles `declarativeNetRequest` + feuilles CSS cosmétiques | L'outil exact (convertisseur existant ou script maison) sera choisi au plan, après vérification de sa licence |
| Tests unitaires | Vitest + happy-dom | Intégré à l'écosystème Vite / WXT |
| Tests e2e | Playwright (Chromium avec l'extension chargée) | Seul moyen fiable de vérifier qu'aucun onglet ne s'ouvre |
| Police | Outfit, fichiers woff2 embarqués (licence OFL) | Pas de requête vers Google Fonts depuis l'extension |

Les listes sont figées au build. Les mettre à jour = publier une nouvelle version du zip. Le téléchargement automatique des listes est écarté en v1 : il ajoute des requêtes sortantes et du code de mise à jour.

## Commands

```
Installer :          npm install
Mettre à jour listes: npm run lists          # télécharge EasyList / EasyPrivacy et les convertit dans public/rules/
Dev (Chrome) :       npm run dev             # wxt, ouvre Chrome avec l'extension rechargée à chaud
Build :              npm run build           # sortie dans .output/chrome-mv3
Zip de release :     npm run zip             # .output/popperz-<version>-chrome.zip, à mettre sur ton site
Typecheck :          npm run typecheck       # tsc --noEmit
Tests unitaires :    npm test                # vitest run
Tests e2e :          npm run test:e2e        # build puis playwright test
```

Opera GX : charger `.output/chrome-mv3` via `opera://extensions` en mode développeur.

## Project Structure

```
entrypoints/
  background.ts          → service worker : popunders (couche 2), compteurs, règles dynamiques
  guard.content.ts       → MAIN world, document_start : intercepte window.open, faux clics, liens créés à la volée
  cleaner.content.ts     → monde isolé : CSS cosmétique, calques invisibles, règles du Zappeur, MutationObserver
  popup/                 → index.html, main.ts, style.css
lib/                     → logique pure et testable (heuristiques, matching, conversion de filtres, stockage)
scripts/
  build-lists.ts         → conversion des listes Adblock en règles DNR + CSS
public/
  _locales/fr/messages.json
  _locales/en/messages.json
  rules/                 → rulesets DNR générés (easylist.json, easyprivacy.json, popunder.json)
  cosmetic/              → CSS cosmétiques générés
  fonts/                 → Outfit woff2
  icons/
design/icons/            → sources SVG des propositions d'icône
tests/
  unit/                  → *.test.ts (Vitest)
  e2e/                   → *.spec.ts (Playwright)
  fixtures/              → pages HTML piégées locales
SPEC.md
LICENSE                  → GPLv3 (compatible avec les listes embarquées)
```

## Approche technique (principe)

**Popunders, deux couches**, car une seule ne suffit pas :

1. **Dans la page (`guard`, MAIN world, avant tout script du site).** Mémorise la cible réelle de chaque clic. Remplace `window.open` : l'appel passe seulement si la cible du clic est un lien ou un bouton dont l'intention correspond. Sinon il est bloqué et compté. Même contrôle pour les `<a target=_blank>` créés puis cliqués par script, et pour les formulaires `target=_blank`.
2. **Hors de la page (`background`, filet de sécurité).** `webNavigation.onCreatedNavigationTarget` signale chaque onglet ouvert par un autre. Si l'URL ne correspond pas au dernier clic légitime remonté par la page, l'onglet est fermé et le focus revient à l'onglet d'origine.

**Calque invisible** (dans `lib/`, testé unitairement) : élément `position: fixed` ou `absolute`, qui couvre plus de ~50 % du viewport, `z-index` élevé, opacité < 0,1 ou fond transparent sans contenu visible, et qui reçoit des clics. Seuils à ajuster après essais sur de vrais sites.

**Listes** : au build, `scripts/build-lists.ts` convertit les filtres réseau en rulesets DNR statiques et les filtres cosmétiques en CSS (génériques + index par domaine). Si une liste dépasse le quota de règles, les règles les moins utiles (options exotiques non supportées par DNR) sont écartées et comptées dans un rapport de build.

**Couleurs** (tokens repris de swaks.org) :

| Token | Clair | Sombre |
|---|---|---|
| `--cream` (fond) | `#F1EEE7` | `#1c1917` |
| `--parchment` (surface) | `#EDE5D0` | `#2a2521` |
| `--text` | `#3a3530` | `#ece6dc` |
| `--muted` | `#6f6557` | `#a89d8f` |
| `--border` | `#DDD6C8` | `#36302b` |
| `--mauve` (accent) | `#C88ABB` | `#D49DC8` |
| `--mauve-text` | `#935683` | `#D49DC8` |
| `--mauve-soft` | `#E5C8DC` | `#5b4056` |

Thème suivi via `prefers-color-scheme`. Police Outfit. Transitions `cubic-bezier(0.16, 1, 0.3, 1)` comme le site.

## Code Style

```ts
// lib/overlay.ts
export interface OverlayCandidate {
  coverage: number; // part du viewport couverte, 0..1
  opacity: number;
  zIndex: number;
}

const MIN_COVERAGE = 0.5;
const MAX_OPACITY = 0.1;

export function isClickTrap(el: OverlayCandidate): boolean {
  return el.coverage >= MIN_COVERAGE && el.opacity <= MAX_OPACITY && el.zIndex > 1000;
}
```

- Fonctions pures dans `lib/`, effets de bord (DOM, `chrome.*`) dans `entrypoints/`.
- `camelCase` pour fonctions et variables, `PascalCase` pour types, `SCREAMING_SNAKE` pour les constantes de seuil.
- Code et identifiants en anglais. Textes d'interface uniquement via `chrome.i18n.getMessage`, jamais en dur.
- Commentaire seulement pour le *pourquoi*.

## Testing Strategy

- **Unitaires (Vitest)** : heuristique de calque, matching clic → URL légitime, conversion de filtres Adblock → DNR (échantillon de règles réelles), sérialisation des règles du Zappeur. Toute logique de `lib/` a un test.
- **E2E (Playwright + extension chargée)** sur les pages de `tests/fixtures/` servies en local :
  - `ads-network.html` : script et image venant d'un domaine de régie listé → requêtes bloquées.
  - `ads-cosmetic.html` : bloc `.ad-banner` présent dans le HTML → masqué.
  - `popunder-window-open.html` : écouteur sur `document` qui appelle `window.open` → aucun nouvel onglet.
  - `popunder-anchor.html` : `<a target=_blank>` créé et cliqué par script → aucun nouvel onglet.
  - `click-overlay.html` : calque transparent plein écran → le clic atteint le bouton dessous.
  - `overlay-reinject.html` : calque réinjecté toutes les secondes → toujours neutralisé.
  - `legit-link.html` : vrai lien `target=_blank` → l'onglet s'ouvre.
  - Zappeur : supprimer un élément, recharger → il reste supprimé.
  - Site désactivé dans le popup → plus aucune intervention après rechargement.
- Pas d'objectif chiffré de couverture. Règle : chaque comportement des critères de succès a son test.
- Essai manuel sur 3 à 5 vrais sites piégés avant chaque version.

## Boundaries

- **Toujours :** lancer `npm run typecheck && npm test` avant de déclarer une tâche finie. Garder les permissions du manifest au minimum. Tout stocker en local (`chrome.storage.local`). Toute chaîne d'interface existe en FR et en EN.
- **Demander d'abord :** ajouter une dépendance, ajouter une permission au manifest, ajouter une liste de filtres (licence à vérifier), pousser sur GitHub, publier un zip.
- **Jamais :** télémétrie, code distant exécuté (interdit en MV3), données de navigation qui quittent la machine, supprimer un test qui échoue sans accord.

Permissions prévues : `declarativeNetRequest`, `declarativeNetRequestFeedback` (compteurs, à confirmer), `storage`, `webNavigation`, `tabs`, `scripting`, `host_permissions: <all_urls>`.

## Success Criteria

1. Tous les scénarios e2e ci-dessus passent sur Chromium.
2. L'extension se charge sans erreur dans Chrome **et** Opera GX à partir du zip de release (vérif manuelle).
3. Zéro faux positif sur `legit-link.html` : un vrai lien `target=_blank` ouvre toujours son onglet.
4. Le popup affiche les compteurs de la page courante, l'interrupteur par site et les règles du Zappeur, en thème clair et sombre aux couleurs de swaks.org, en FR et en EN.
5. Sur les sites de test publics des bloqueurs (ex. d3ward.github.io/toolz/adblock), le score est au moins égal à celui d'uBlock Origin Lite en mode par défaut.
6. Aucune requête réseau émise par l'extension elle-même en usage normal.
7. `npm run zip` produit un zip qui s'installe en suivant le guide d'installation.

## Open Questions

Aucune. Réglé le 2026-11-01 : licence GPLv3, page d'installation dans le dépôt de ton site, barre de qualité = au moins uBlock Origin Lite, icône D (flacon fendu).
