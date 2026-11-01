# Plan d'implémentation : Popperz

> Statut : **validé le 2026-11-01, T1 à T14 implémentées**. Source : `SPEC.md` (approuvée le 2026-11-01). Tâches détaillées : `tasks/todo.md`.

## Vue d'ensemble

Extension Manifest V3 pour Chrome et Opera GX, construite avec WXT et TypeScript. On bâtit d'abord le socle et le banc de tests e2e, puis on attaque le plus risqué : l'anti-popunder, la raison d'être du projet. Viennent ensuite l'anti-calque, le blocage réseau, le masquage cosmétique, le Zappeur, le popup et enfin le zip de release.

## Décisions d'architecture

- **WXT + TypeScript, popup en vanilla.** Un seul outil gère manifest, builds, rechargement à chaud et zip.
- **Le script de garde tourne dans la page (MAIN world).** Seul moyen de remplacer `window.open` avant les scripts du site. Il n'a pas accès à `chrome.*` : il parle à un petit script relais (monde isolé) par `window.postMessage` avec un jeton secret, et le relais transmet au service worker.
- **L'état du service worker vit dans `chrome.storage.session`.** En MV3 le service worker s'endort après ~30 s. Le dernier clic légitime par onglet doit donc survivre à son réveil.
- **Listes converties au build, en rulesets DNR statiques.** Aucune requête sortante à l'exécution. Convertisseur pressenti : `@adguard/tsurlfilter` (convertisseur déclaratif, GPLv3, maintenu). La tâche 9 commence par un essai court. S'il ne convient pas, on écrit un convertisseur maison limité aux règles réseau courantes.
- **Désactivation par site.** Une règle DNR dynamique `allowAllRequests` pour le domaine coupe le blocage réseau. Les scripts de contenu lisent le réglage et ne font rien.
- **Compteurs.** Le badge de l'icône utilise le compteur natif de DNR (`displayActionCountAsBadgeText`). Le popup lit les règles déclenchées via `declarativeNetRequestFeedback`, autorisé hors store, et les compteurs de popunders stockés par onglet.
- **Icône.** `design/icons/8-logo-fendu.svg` exporté en PNG 16, 32, 48 et 128 au build (Chrome headless, aucune dépendance ajoutée).

### Dépendances à ajouter (validées avec ce plan)

`wxt`, `typescript`, `vitest`, `happy-dom`, `@playwright/test`, et `@adguard/tsurlfilter` si l'essai de la tâche 9 est concluant. Toute autre dépendance sera demandée avant.

## Graphe de dépendances

```
T1 socle ──► T2 banc e2e ──┬──► T3 ► T4 ► T5 ► T6   anti-popunder + réglage par site
                           ├──► T7 ► T8              anti-calque
                           └──► T9 ► T10 ► T11 ► T12 blocage réseau ► cosmétique ► Zappeur
                                         T6, T8, T12 ──► T13 popup ──► T14 release
```

Après T2, les trois branches sont indépendantes et peuvent avancer en parallèle (sessions séparées). T6 (réglage par site) doit précéder T10, qui l'utilise pour la règle d'autorisation.

## Liste des tâches

### Phase 1 : socle
- [ ] T1 : squelette WXT, icône, licence, i18n
- [ ] T2 : banc de tests e2e avec l'extension chargée

**Checkpoint socle** : build propre, l'extension se charge dans Chrome et Opera GX, un test e2e de fumée passe.

### Phase 2 : anti-popunder (le plus risqué, en premier)
- [ ] T3 : interception de `window.open` selon l'intention du clic
- [ ] T4 : liens et formulaires `target=_blank` créés par script
- [ ] T5 : filet de sécurité dans le service worker
- [ ] T6 : réglage on/off par site, respecté partout

**Checkpoint popunders** : fixtures popunder bloquées, lien légitime ouvert, essai manuel sur 3 vrais sites piégés. Revue avec toi.

### Phase 3 : anti-calque
- [ ] T7 : détection et neutralisation des calques invisibles
- [ ] T8 : re-neutralisation des calques réinjectés

### Phase 4 : blocage des pubs
- [ ] T9 : conversion des listes en rulesets DNR (`npm run lists`)
- [ ] T10 : rulesets branchés, liste popunder, autorisation par site

**Checkpoint blocage** : fixtures réseau bloquées, score d3ward relevé et comparé à uBlock Origin Lite. Revue avec toi.

### Phase 5 : nettoyage manuel et cosmétique
- [ ] T11 : masquage cosmétique issu des listes
- [ ] T12 : Zappeur

### Phase 6 : interface et livraison
- [ ] T13 : popup complet (FR/EN, clair/sombre)
- [ ] T14 : zip de release, notice des licences, guide d'installation

**Checkpoint final** : tous les critères de succès de `SPEC.md` vérifiés. Revue avec toi.

## Risques et parades

| Risque | Impact | Parade |
|---|---|---|
| Faux positifs de l'anti-popunder : un vrai bouton « ouvrir dans un nouvel onglet » est bloqué | Élevé | Fixture `legit-link` dès T3. Règle prudente : en cas de doute, on laisse passer et la couche 2 juge l'URL. Interrupteur par site en T6. |
| Les sites détectent le remplacement de `window.open` (`toString`, iframe vierge) | Moyen | Remplacement qui imite la fonction native. Iframes couvertes via `all_frames` + `match_about_blank`. Couche 2 en filet. |
| Le service worker s'endort et oublie le dernier clic | Moyen | État dans `chrome.storage.session`, test e2e après mise en veille forcée. |
| Quota de règles DNR dépassé par EasyList + EasyPrivacy | Moyen | Rapport de build qui compte les règles. Tri des règles non supportées. Le quota global (330 000) laisse de la marge. |
| Convertisseur AdGuard inadapté (taille, API, licence) | Moyen | Essai limité en début de T9. Repli : convertisseur maison pour `\|\|domaine^` et options courantes. |
| `MutationObserver` coûteux sur les pages lourdes | Faible | Traitement par lots dans `requestAnimationFrame`, examen limité aux nœuds ajoutés. |
| Différences Opera GX / Chrome | Faible | Vérif manuelle dans Opera GX à chaque checkpoint. |

## Questions ouvertes

Aucune bloquante.

## Journal

- **2026-11-01, convertisseur (T9)** : `@adguard/tsurlfilter` écarté. La v6 n'exporte plus le convertisseur déclaratif, et ses dépendances remontaient 6 failles « high » à `npm audit`. Convertisseur maison dans `lib/filters/network.ts` : 48 944 règles EasyList et 56 375 EasyPrivacy converties, ~3 200 écartées (surtout `$popup`, que l'anti-popunder couvre déjà).
- **2026-11-01, quota DNR** : 105 319 règles statiques, au-delà des 30 000 garanties. Les 3 rulesets s'activent dans Chromium grâce au quota global partagé. À surveiller si d'autres bloqueurs sont installés à côté.
- **2026-11-01, cosmétique** : 13 329 sélecteurs génériques en CSS statique, 300 génériques avec exceptions et 7 750 sites injectés par le service worker (`scripting.insertCSS`). Les sélecteurs mal formés sont écartés au build.
- **Pas encore mesuré** : score d3ward comparé à uBlock Origin Lite, essai sur de vrais sites piégés, chargement dans Opera GX.
