# Changelog

All notable changes to the **Context Colorizer** architecture are documented in this file. This project adheres to Semantic Versioning.

## [1.0.3] - 2026-07-15

### Fixed
- **Core Engine:** Resolved a critical path-traversal boundary issue on macOS/Linux environments where nested sub-directories would inherit faulty color states during runtime execution.
- **UI Hydration:** Fixed an initialization delay by migrating lifecycle hooks to `onStartupFinished`. Saved tags and workspace decorations now hydrate instantly upon loading the workspace window.
- **Resource Optimization:** Refactored fallback parameters inside the `FileDecorationProvider` to explicitly yield to native VS Code styles (`undefined`), preventing unintended visual overrides on default file trees.

## [1.0.2] - 2026-07-15

### Changed
- **Documentation:** Upgraded project specifications, localization strings, and technical breakdowns inside the documentation matrix.
- **Typings:** Cleaned production entry-points, removing redundant test-suite declarations and duplicate module declarations for enhanced build speeds.

## [1.0.1] - 2026-07-15

### Added
- **Sponsorship Matrix:** Integrated native tier-1 developer support links inside the marketplace metadata sidebar to streamline ecosystem funding pipelines.

## [1.0.0] - 2026-07-15

### Added
- **Initial Release:** Production launch of the context-menu driven categorization platform.
- Fully sandboxed `workspaceState` storage mechanism to prevent configuration pollution.
- Real-time file system observer to automatically migrate active decoration tokens during directory renaming operations.
- Isolated memory transaction stack enabling seamless, context-focused rollback support (`Cmd+Z` / `Ctrl+Z`).