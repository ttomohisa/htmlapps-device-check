# Changelog

## 1.0.2 - 2026-10-09

- Add a real English catalog screenshot and use it in the English README, preserving app behavior and the supplied icon.

## Unreleased

- Normalized the header language switch to EN / JA and added current-language target tooltips; retained localized Help / close controls and the existing layout (1.0.1).

- Added a keyboard-only clear-results button with localized navigation/reset guidance and fresh-session behavior.
- Fixed the keyboard test trapping Tab / Shift+Tab; ordinary test keys remain scoped to the focused test area.
- Added synthetic keyboard regressions for reset isolation, focus, summary, navigation, repeats, and bilingual copy.

- Fixed camera/microphone races around repeated starts, device changes, Stop, page exit, and late permission results.
- Release operation-owned tracks, preview, audio graph/context, and animation resources; stale callbacks cannot overwrite newer sessions.
- Report preview/audio startup failures honestly; retain working, stoppable capture when only device enumeration fails.
- Added Japanese/English pending, stopped, and retry hints, independent of checked-result history.
- Added synthetic lifecycle regressions and a checked-in download/self-extract parity gate.

## 1.0.0 - Device Check initial release - 2026-08-24

- Replaced the starter workspace with the Browser Kitty Device Check application.
- Added camera, microphone, speaker, display, keyboard, pointer/touch, gamepad, and motion-sensor tests.
- Added automatic camera/microphone fallback to the browser default device when a selected device is unavailable or overconstrained.
- Added browser/device summary and related Web API capability checks.
- Added a guided pre-call camera → microphone → speaker quick check.
- The quick-check guide can now be hidden/restored, with the visibility preference stored locally.
- Refined the smartphone layout with a denser summary, compact test shortcuts, cleaner section spacing, larger touch targets, and simplified mobile result cards.
- Reworked smartphone navigation into a fixed four-tab bottom bar (Overview / Camera & Audio / Input / Display & Device), showing one page group at a time while keeping the desktop layout unchanged.
- Expanded microphone diagnostics with waveform, dB, peak, rolling noise floor, and stereo channel levels.
- Added keyboard simultaneous-key visualization for Ghosting / N-key rollover checks.
- Added observed multi-touch counting, gamepad haptics, and advanced display patterns including retention and motion tests.
- Kept all diagnostics local with no runtime network requests and no third-party dependencies.
- Added matching embedded/favicon SVG artwork, bilingual help, smartphone layouts, and product documentation.

## 1.0 - Browser-Kitty UX and asset pipeline hardening - 2026-08-20

- Removed the second Base64 layer around the complete embedded asset bundle; asset payloads are now Base64-encoded exactly once.
- Added per-asset `none` / `gzip` / `auto` compression, async decompression APIs, and per-asset original/stored byte metadata.
- Added `build-size-report.json` plus configurable warning-only readable/self-extract size budgets.
- Added reusable Toast + Undo, compact popover menu, preset + custom numeric setting, and async source-generation/state components.
- Updated starter export UX with a user-editable output filename, fixed extension handling, invalid-character sanitization, and fallback naming.
- Added template rules for source-change invalidation, stale async result rejection, explicit heavy-processing phases, mobile preview/control proximity, portrait media geometry/orientation, and compact advanced settings.
- Added finished-app README guidance and repository checks for the new components and asset-bundle contract.


## 1.0 - Reusable mobile bottom navigation / action bar - 2026-08-19

- Added `components/mobile-bottom-bar.html` as the canonical fixed smartphone navigation / workflow action pattern.
- Added safe-area-aware 3-5 item layout, icon + label controls, native disabled states, section scrolling, active-section tracking, and application action hooks.
- Documented when to use a bottom bar versus an in-flow primary button, including the pattern of enabling Save / Share only after a valid result exists.
- Updated LLM guidance, product UX guidance, bilingual README files, and repository checks so future apps discover and reuse the component instead of rebuilding it ad hoc.

## 1.0 - Portable PowerShell build verification - 2026-08-17

- Removed the builder's dependency on `Get-FileHash` and now calculate file SHA-256 hashes through the .NET cryptography API.
- Replaced `::new()` constructor syntax in self-extract build/verification scripts with older-compatible construction syntax.
- Changed standalone placeholder verification to reject only the real build placeholders instead of every `__UPPERCASE__` runtime identifier.
- Added repository regression guards so future template changes cannot reintroduce `Get-FileHash`, `::new()`, or the generic placeholder false positive.

## 1.0 - Self-extract loader robustness - 2026-08-17

- Made `scripts/build-self-extract.ps1` ASCII-only so Windows PowerShell 5.1 cannot corrupt Japanese loader text when the script is stored as BOM-less UTF-8.
- Encoded non-ASCII loader copy and application titles into ASCII-safe HTML character references / JavaScript Unicode escapes.
- Inherited the embedded favicon from the normal standalone HTML into `dist/index.self-extract.html`.
- Added regression checks for ASCII-only loader output, embedded favicon presence and exact favicon inheritance, and the existing byte-for-byte gzip payload restoration.
- Added a repository guard that rejects non-ASCII text in the self-extract builder source.

## 1.0 - Reusable mobile confirmation component - 2026-08-15

- Added `components/confirm-dialog.html`, a dependency-free Promise-based confirmation dialog.
- Added centered desktop and safe-area-aware smartphone bottom-sheet presentations.
- Added destructive-action styling, backdrop/Esc cancellation, keyboard focus handling, and focus restoration.
- Integrated the confirmation component into the starter Clear action as the recommended pattern.
- Added bilingual reusable-component documentation and updated LLM guidance to prefer it over `window.confirm()`.

## 1.0 - Self-extracting build - 2026-08-05

- Added `dist/index.self-extract.html`, generated by gzip-compressing the normal standalone HTML.
- Added native browser restoration with `DecompressionStream`, no runtime dependency, and no network access.
- Added byte-for-byte payload verification, size/hash manifest, CI artifact upload, and documentation.
- Kept `dist/index.html` as the default GitHub Pages entry point.

## 1.0 - Pages setup fix - 2026-08-05

- Prevented the first GitHub Actions run from failing when GitHub Pages has not been enabled yet.
- Added a Pages preflight check and a clear workflow summary with the one-time setup steps.
- Kept the generated standalone HTML available as a normal Actions artifact even when deployment is skipped.

## 1.0 - 2026-08-05

- Promoted the template to version 1.0.
- Removed the filled backgrounds and borders from the header language and help controls.
- Kept the compact bilingual help dialog and the PDF Organizer-inspired light interface.
- Added LLM guidance requiring help content to stay synchronized with application behavior.

All notable changes to this template are documented here.

## 0.3.0 - 2026-08-05

- Added a compact upper-right help button modeled after PDF Organizer.
- Added a bilingual native dialog for usage, privacy, limitations, and offline notes.

## [0.1.0] - 2026-08-04

### Added

- Generic single-HTML builder with exact npm package and asset embedding.
- SHA-256 dependency manifest.
- Runtime no-network Content Security Policy.
- Responsive bilingual starter interface with local persistence and export.
- GitHub Actions for build validation and GitHub Pages deployment.
- LLM implementation contract, product specification, architecture, and workflow guides.
