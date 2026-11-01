# Graph Report - Popperz  (2026-11-01)

## Corpus Check
- Corpus is ~2,261 words - fits in a single context window. You may not need a graph.

## Summary
- 39 nodes · 62 edges · 5 communities
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 84,421 input · 0 output

## Community Hubs (Navigation)
- Nettoyage de page
- Interface et livraison
- Fondations et contraintes
- Blocage réseau
- Défense anti-popunder

## God Nodes (most connected - your core abstractions)
1. `shell module` - 8 edges
2. `netblock module` - 8 edges
3. `popup module (UI)` - 7 edges
4. `overlay module (anti-click-trap)` - 6 edges
5. `zapper module (Zappeur)` - 6 edges
6. `scripts/build-lists.ts` - 6 edges
7. `Popperz (ad blocker extension spec)` - 5 edges
8. `cosmetic module` - 5 edges
9. `cleaner.content.ts (isolated world)` - 5 edges
10. `popguard module (anti-popunder)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `scripts/build-lists.ts` --implements--> `cosmetic module`  [INFERRED]
  SPEC.md → SPEC.md  _Bridges community 0 → community 3_
- `No telemetry, local-only data` --rationale_for--> `chrome.storage.local`  [INFERRED]
  SPEC.md → SPEC.md  _Bridges community 0 → community 2_
- `Popperz (ad blocker extension spec)` --references--> `GPLv3 license`  [EXTRACTED]
  SPEC.md → SPEC.md  _Bridges community 2 → community 3_
- `popguard module (anti-popunder)` --references--> `shell module`  [EXTRACTED]
  SPEC.md → SPEC.md  _Bridges community 0 → community 1_
- `popup module (UI)` --references--> `netblock module`  [EXTRACTED]
  SPEC.md → SPEC.md  _Bridges community 3 → community 1_

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Popperz capability map build order (shell to distrib)** — spec_module_shell, spec_module_netblock, spec_module_popguard, spec_module_overlay, spec_module_cosmetic, spec_module_zapper, spec_module_popup, spec_module_distrib [EXTRACTED 1.00]
- **Popunder defense flow (page layer + service worker safety net)** — spec_guard_content_ts, spec_window_open_interception, spec_background_ts, spec_oncreatednavigationtarget, spec_two_layer_popunder_defense [EXTRACTED 1.00]
- **Build-time filter list conversion pipeline** — spec_build_lists_ts, spec_easylist, spec_easyprivacy, spec_popunder_list, spec_declarativenetrequest, spec_module_cosmetic [INFERRED 0.85]

## Communities (5 total, 0 thin omitted)

### Community 0 - "Nettoyage de page"
Cohesion: 0.36
Nodes (10): chrome.storage.local, cleaner.content.ts (isolated world), isClickTrap overlay heuristic (lib/overlay.ts), cosmetic module, overlay module (anti-click-trap), shell module, zapper module (Zappeur), MutationObserver re-neutralization (+2 more)

### Community 1 - "Interface et livraison"
Cohesion: 0.25
Nodes (7): chrome.i18n FR/EN locales, Trapped HTML fixtures (tests/fixtures), distrib module (release zip), popguard module (anti-popunder), popup module (UI), Playwright e2e tests with extension loaded, swaks.org color tokens (DA swaks)

### Community 2 - "Fondations et contraintes"
Cohesion: 0.25
Nodes (5): Manifest V3, Outfit font (embedded woff2, OFL), Popperz (ad blocker extension spec), uBlock Origin Lite (benchmark), WXT extension framework

### Community 3 - "Blocage réseau"
Cohesion: 0.43
Nodes (7): scripts/build-lists.ts, declarativeNetRequest (DNR), EasyList, EasyPrivacy, GPLv3 license, netblock module, In-house popunder ad network list (PopAds, PropellerAds)

### Community 4 - "Défense anti-popunder"
Cohesion: 0.47
Nodes (3): background.ts service worker, guard.content.ts (MAIN world, document_start), webNavigation.onCreatedNavigationTarget

## Knowledge Gaps
- **5 isolated node(s):** `In-house popunder ad network list (PopAds, PropellerAds)`, `OverlayCandidate interface`, `swaks.org color tokens (DA swaks)`, `Playwright e2e tests with extension loaded`, `uBlock Origin Lite (benchmark)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 8 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `popguard module (anti-popunder)` connect `Interface et livraison` to `Nettoyage de page`, `Défense anti-popunder`?**
  _High betweenness centrality (0.317) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `overlay module (anti-click-trap)` (e.g. with `zapper module (Zappeur)` and `MutationObserver re-neutralization`) actually correct?**
  _`overlay module (anti-click-trap)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `In-house popunder ad network list (PopAds, PropellerAds)`, `OverlayCandidate interface`, `swaks.org color tokens (DA swaks)` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Why does `shell module` connect `Nettoyage de page` to `Interface et livraison`, `Fondations et contraintes`, `Blocage réseau`?**
  _High betweenness centrality (0.316) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `zapper module (Zappeur)` (e.g. with `chrome.storage.local` and `overlay module (anti-click-trap)`) actually correct?**
  _`zapper module (Zappeur)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Why does `popup module (UI)` connect `Interface et livraison` to `Nettoyage de page`, `Fondations et contraintes`, `Blocage réseau`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._