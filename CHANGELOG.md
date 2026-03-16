# Change Log

All notable changes to the "notebook-cell-organizer" extension will be documented in this file.

## [Unreleased]

## [0.2.0] - 2026-03-16

### Added

- Support for multi-line imports with parentheses (`from X import (\n  a,\n  b\n)`)
- Idempotency check: repeated organize calls on an already-organized notebook now show "Nothing to organize."
- Extension icon

### Fixed

- Lowered minimum VS Code version requirement from 1.109.0 to 1.100.0 (April 2025)

## [0.1.0] - 2026-03-04

### Added

- Organize Notebook Cells command via Command Palette and notebook toolbar
- Shell commands (`!pip`, `%pip`, `%conda`, `!*`) moved to cell 0
- Import statements moved to cell 1
- Duplicate lines deduplicated automatically
- Empty cells removed after extraction
- Auto-organize on save (`notebook-cell-organizer.organizeOnSave` setting)
