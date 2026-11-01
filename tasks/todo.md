# Tâches : Popperz

> Statut au 2026-11-01 : T1 à T14 implémentées, 47 tests unitaires et 24 tests e2e verts. Cases vides = vérifications manuelles restantes.
>
> Ordre = ordre de dépendance. Vérification commune à chaque tâche : `npm run typecheck && npm test`, plus `npm run test:e2e` dès T2.

## Phase 1 : socle

### - [x] T1 : squelette WXT, icône, licence, i18n

**Description :** projet WXT + TypeScript qui se build et se charge. Popup minimal aux couleurs swaks avec le nom de l'extension. Icône D exportée en PNG. Licence GPLv3. Locales FR et EN.

**Critères d'acceptation :**
- [x] `npm run build` produit `.output/chrome-mv3`, chargeable sans erreur dans Chrome.
- [x] L'icône flacon fendu apparaît dans la barre (16/32/48/128 px).
- [x] Le popup affiche « Popperz » et une description, en FR ou EN selon la langue du navigateur. Un test unitaire vérifie que FR et EN ont exactement les mêmes clés.

**Vérification :** build, typecheck, test des clés i18n, chargement manuel dans Chrome et Opera GX.

**Dépendances :** aucune.

**Fichiers :** `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/popup/{index.html,main.ts,style.css}`, `public/_locales/{fr,en}/messages.json`, `public/icons/*`, `scripts/export-icons.sh`, `LICENSE`, `tests/unit/i18n.test.ts`.

**Taille :** M (squelette : beaucoup de fichiers, mais du code de configuration).

### - [x] T2 : banc de tests e2e avec l'extension chargée

**Description :** Playwright lance Chromium avec l'extension buildée et sert `tests/fixtures/` en local. Un test de fumée vérifie que le service worker démarre.

**Critères d'acceptation :**
- [x] `npm run test:e2e` builde puis lance les tests.
- [x] Une fixture Playwright fournit le contexte avec l'extension et l'URL du serveur local.
- [x] Le test de fumée passe.

**Vérification :** `npm run test:e2e`.

**Dépendances :** T1.

**Fichiers :** `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/smoke.spec.ts`, `tests/fixtures/blank.html`.

**Taille :** S.

## Checkpoint socle
- [x] Build propre, tests verts.
- [ ] Extension chargée dans Chrome et Opera GX.
- [ ] Revue avec toi.

## Phase 2 : anti-popunder

### - [x] T3 : interception de `window.open` selon l'intention du clic

**Description :** script de garde (MAIN world, `document_start`, toutes frames) qui mémorise la cible réelle de chaque clic et ne laisse passer `window.open` que si la cible est un lien ou un bouton cohérent. Logique de décision pure dans `lib/click-intent.ts`.

**Critères d'acceptation :**
- [x] `popunder-window-open.html` (écouteur sur `document` qui appelle `window.open`) : aucun nouvel onglet.
- [x] `legit-link.html` : un vrai lien `target=_blank` et un bouton qui appelle `window.open` vers sa propre cible ouvrent leur onglet.
- [x] Tests unitaires de `lib/click-intent.ts` sur les cas : clic sur fond, sur lien, sur bouton, sans clic.

**Vérification :** tests unitaires + e2e des deux fixtures.

**Dépendances :** T2.

**Fichiers :** `entrypoints/guard.content.ts`, `lib/click-intent.ts`, `tests/unit/click-intent.test.ts`, `tests/fixtures/{popunder-window-open,legit-link}.html`, `tests/e2e/popguard.spec.ts`.

**Taille :** M.

### - [x] T4 : liens et formulaires `target=_blank` créés par script

**Description :** même contrôle pour un `<a target=_blank>` créé puis cliqué par script, et pour un formulaire `target=_blank` soumis par script.

**Critères d'acceptation :**
- [x] `popunder-anchor.html` : aucun nouvel onglet.
- [x] `popunder-form.html` : aucun nouvel onglet.
- [x] `legit-link.html` reste vert.

**Vérification :** e2e.

**Dépendances :** T3.

**Fichiers :** `entrypoints/guard.content.ts`, `lib/click-intent.ts`, `tests/fixtures/{popunder-anchor,popunder-form}.html`, `tests/e2e/popguard.spec.ts`.

**Taille :** S.

### - [x] T5 : filet de sécurité dans le service worker

**Description :** relais monde isolé (garde → `postMessage` avec jeton → `runtime.sendMessage`). Le service worker garde le dernier clic légitime par onglet dans `chrome.storage.session`. Sur `webNavigation.onCreatedNavigationTarget`, il ferme l'onglet si l'URL ne correspond pas et rend le focus à l'onglet d'origine.

**Critères d'acceptation :**
- [x] `popunder-bypass.html` (ouverture qui contourne la garde, ex. via une iframe sandbox) : l'onglet est fermé en moins de 1,5 s (testé en retirant la garde ; l'astuce de l'iframe est en fait déjà bloquée par la garde).
- [ ] Après mise en veille forcée du service worker, le filet fonctionne toujours.
- [x] `legit-link.html` reste vert.

**Vérification :** e2e.

**Dépendances :** T4.

**Fichiers :** `entrypoints/background.ts`, `entrypoints/bridge.content.ts`, `lib/messages.ts`, `tests/fixtures/popunder-bypass.html`, `tests/e2e/popguard.spec.ts`.

**Taille :** M.

### - [x] T6 : réglage on/off par site, respecté partout

**Description :** `lib/settings.ts` lit et écrit les sites désactivés dans `chrome.storage.local`. La garde et le service worker n'interviennent plus sur un site désactivé. Compteur de popunders bloqués par onglet.

**Critères d'acceptation :**
- [x] Site désactivé (réglé par le test) : `popunder-window-open.html` ouvre bien son onglet après rechargement.
- [x] Le compteur de popunders de l'onglet augmente à chaque blocage.
- [x] Tests unitaires de `lib/settings.ts` (normalisation du domaine : `www.` et sous-domaines).

**Vérification :** tests unitaires + e2e.

**Dépendances :** T5.

**Fichiers :** `lib/settings.ts`, `tests/unit/settings.test.ts`, `entrypoints/{guard,bridge}.content.ts`, `entrypoints/background.ts`, `tests/e2e/settings.spec.ts`.

**Taille :** M.

## Checkpoint popunders
- [x] Tous les tests verts.
- [ ] Essai manuel sur 3 vrais sites piégés : plus d'onglet surprise, les boutons du site marchent.
- [ ] Revue avec toi.

## Phase 3 : anti-calque

### - [x] T7 : détection et neutralisation des calques invisibles

**Description :** heuristique pure `lib/overlay.ts` (couverture, opacité, z-index, contenu visible). Le script de nettoyage (monde isolé) l'applique au chargement et passe les calques détectés en `pointer-events: none`.

**Critères d'acceptation :**
- [x] `click-overlay.html` : le clic atteint le bouton sous le calque transparent.
- [x] Une modale visible légitime (fond semi-opaque avec contenu) n'est pas touchée.
- [x] Tests unitaires de l'heuristique sur au moins 6 cas, dont 2 faux positifs évités.

**Vérification :** tests unitaires + e2e.

**Dépendances :** T2 (et T6 pour respecter le réglage par site).

**Fichiers :** `lib/overlay.ts`, `tests/unit/overlay.test.ts`, `entrypoints/cleaner.content.ts`, `tests/fixtures/{click-overlay,legit-modal}.html`, `tests/e2e/overlay.spec.ts`.

**Taille :** M.

### - [x] T8 : re-neutralisation des calques réinjectés

**Description :** `MutationObserver` qui examine uniquement les nœuds ajoutés, traités par lots dans `requestAnimationFrame`.

**Critères d'acceptation :**
- [x] `overlay-reinject.html` (calque réinjecté chaque seconde) : le bouton reste cliquable pendant 10 s.
- [x] Sur une page de 5 000 nœuds ajoutés d'un coup, insertion + scan tiennent en deux frames (< 100 ms, mesuré dans le test).

**Vérification :** e2e.

**Dépendances :** T7.

**Fichiers :** `entrypoints/cleaner.content.ts`, `tests/fixtures/{overlay-reinject,heavy-dom}.html`, `tests/e2e/overlay.spec.ts`.

**Taille :** S.

## Phase 4 : blocage des pubs

### - [x] T9 : conversion des listes en rulesets DNR

**Description :** commence par un essai d'une heure maximum de `@adguard/tsurlfilter` (conversion d'un extrait d'EasyList). Selon le résultat, `scripts/build-lists.ts` l'utilise, ou applique un convertisseur maison limité. `npm run lists` télécharge EasyList et EasyPrivacy, écrit `public/rules/*.json` et affiche un rapport (règles converties, écartées, total vs quota).

**Critères d'acceptation :**
- [x] `npm run lists` génère `easylist.json` et `easyprivacy.json`, valides pour DNR.
- [x] Le rapport affiche le nombre de règles converties et écartées.
- [x] Tests unitaires de conversion sur un échantillon de règles réelles (domaine, chemin, options `third-party`, `script`, exceptions `@@`).
- [x] Le choix du convertisseur est noté dans `tasks/plan.md`.

**Vérification :** `npm run lists`, tests unitaires.

**Dépendances :** T2.

**Fichiers :** `scripts/build-lists.ts`, `lib/filters/*.ts` (si convertisseur maison), `tests/unit/filters.test.ts`, `public/rules/*.json`, `package.json`.

**Taille :** M.

### - [x] T10 : rulesets branchés, liste popunder, autorisation par site

**Description :** rulesets déclarés dans le manifest, liste maison `popunder.json`, badge de compteur natif. Un site désactivé (T6) reçoit une règle dynamique `allowAllRequests`.

**Critères d'acceptation :**
- [x] `ads-network.html` : le script et l'image de la régie listée ne se chargent pas.
- [x] Le badge de l'icône affiche le nombre de requêtes bloquées.
- [x] Site désactivé : les requêtes passent après rechargement.

**Vérification :** e2e + chargement manuel.

**Dépendances :** T9, T6.

**Fichiers :** `wxt.config.ts`, `public/rules/popunder.json`, `entrypoints/background.ts`, `tests/fixtures/ads-network.html`, `tests/e2e/netblock.spec.ts`.

**Taille :** M.

## Checkpoint blocage
- [x] Tous les tests verts.
- [ ] Score d3ward relevé pour Popperz et pour uBlock Origin Lite (mode par défaut), noté dans `tasks/plan.md`.
- [ ] Revue avec toi.

## Phase 5 : nettoyage manuel et cosmétique

### - [x] T11 : masquage cosmétique issu des listes

**Description :** `npm run lists` produit aussi les filtres cosmétiques (CSS générique + index par domaine). Le script de nettoyage injecte le CSS du domaine courant.

**Critères d'acceptation :**
- [x] `ads-cosmetic.html` : le bloc `.ad-banner` est masqué.
- [x] Le CSS injecté pour un domaine ne contient que les règles génériques et celles du domaine.
- [x] Site désactivé : rien n'est masqué.

**Vérification :** tests unitaires de l'index + e2e.

**Dépendances :** T10.

**Fichiers :** `scripts/build-lists.ts`, `lib/cosmetic.ts`, `tests/unit/cosmetic.test.ts`, `entrypoints/cleaner.content.ts`, `tests/fixtures/ads-cosmetic.html`.

**Taille :** M.

### - [x] T12 : Zappeur

**Description :** mode sélection lancé par message : survol surligné, clic = élément supprimé. `lib/selector.ts` génère un sélecteur CSS stable. La règle est enregistrée par domaine et réappliquée via le même canal que le cosmétique. `Échap` quitte le mode.

**Critères d'acceptation :**
- [x] Zapper un élément de `zapper.html`, recharger : l'élément reste masqué.
- [x] Supprimer la règle : l'élément revient après rechargement.
- [x] Tests unitaires de `lib/selector.ts` (préférence id, classes stables, rejet des classes générées).

**Vérification :** tests unitaires + e2e.

**Dépendances :** T11.

**Fichiers :** `lib/selector.ts`, `tests/unit/selector.test.ts`, `entrypoints/cleaner.content.ts`, `tests/fixtures/zapper.html`, `tests/e2e/zapper.spec.ts`.

**Taille :** M.

## Phase 6 : interface et livraison

### - [x] T13 : popup complet

**Description :** interrupteur du site courant, compteurs (pubs bloquées, popunders bloqués), bouton Zappeur, liste des règles du site avec suppression. FR/EN, thème clair/sombre auto, police Outfit embarquée, tokens swaks.

**Critères d'acceptation :**
- [x] Chaque contrôle fonctionne (test e2e qui ouvre la page du popup).
- [x] Aucune chaîne en dur : test i18n vert.
- [x] Rendu vérifié en clair et en sombre, en FR et en EN (captures jointes à la revue).

**Vérification :** e2e + captures.

**Dépendances :** T6, T8, T12.

**Fichiers :** `entrypoints/popup/{index.html,main.ts,style.css}`, `public/fonts/*`, `public/_locales/{fr,en}/messages.json`, `tests/e2e/popup.spec.ts`.

**Taille :** M.

### - [x] T14 : zip de release, notice des licences, guide d'installation

**Description :** `npm run zip` produit `popperz-<version>-chrome.zip`. Fichier `NOTICE` qui crédite EasyList, EasyPrivacy et Outfit. `INSTALL.md` en FR et EN avec les étapes « Charger l'extension non empaquetée » pour Chrome et Opera GX, à reprendre sur ton site.

**Critères d'acceptation :**
- [ ] Le zip, décompressé ailleurs, s'installe en suivant `INSTALL.md` dans Chrome et Opera GX.
- [x] `NOTICE` présent dans le zip.
- [ ] Aucune requête sortante de l'extension pendant 5 minutes de navigation (onglet réseau du service worker).

**Vérification :** installation manuelle depuis le zip, vérif réseau.

**Dépendances :** T13.

**Fichiers :** `package.json`, `wxt.config.ts`, `NOTICE`, `INSTALL.md`.

**Taille :** S.

## Checkpoint final
- [ ] Tous les critères de succès de `SPEC.md` cochés.
- [ ] Revue avec toi, puis premier zip publié sur ton site.
