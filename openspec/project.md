# Brilliant Sort Core

## Purpose

This repository defines a deterministic, testable vertical-slice rule core for a Brilliant Sort-style diamond puzzle. It is an evidence-driven assessment project: gameplay observations are recorded as facts, while unobserved behavior is either an explicit implementation decision or deliberately deferred.

## Product boundary

The baseline covers one or more fixed pixel-art levels, their core selection/placement/Shelf/victory loop, a shared rule reducer, an automation Harness, an AI-agent repair loop, and the C++ connected-gem exercise.

The baseline does **not** recreate a commercial game. Payment, account services, live operations, level unlock progression, remaining power-ups, random-level generation, and a random mode are deferred extensions.

## Core principles

1. **One rule authority.** UI, Harness, replay, and agent tools invoke the same deterministic reducer; presentation code never mutates game state.
2. **Facts are not guesses.** Record direct gameplay observations separately from deterministic vertical-slice decisions and deferred behavior.
3. **Fixed fixtures first.** Levels are versioned JSON fixtures, not runtime RNG output. A fixture and command log must replay to the same canonical state.
4. **Conservation is explicit.** Gems are never created, deleted, or recolored. Per-color gem counts equal per-color target-cell counts across the world state.
5. **No fabricated loss.** Baseline game status is `Playing` or `Won`; rejected commands are diagnostics, not terminal loss.
6. **Minimal scope.** Implement the core loop and evidence needed by the assessment before any commercial or cosmetic expansion.

## Terminology

- **Target color**: the required color of an active board cell.
- **Gem color**: the current color of the gem occupying a board cell, Shelf slot, or lifted selection.
- **Locked gem**: a board gem whose color matches its target cell; locked gems are immutable.
- **Movable gem**: a non-empty board gem whose color does not match its target cell. Shelf gems are movable while present.
- **Connected component**: maximal same-color, movable gems connected by any of the eight neighboring grid directions.
- **Shelf**: a row-major compact sequence rendered as twelve columns per row.
- **Lifted selection**: a presentation state for a connected component; it remains a normal movable-gem source for rules.

## Technology baseline

- **Bun** is the package manager, script runner, TypeScript runtime, and core-test runner.
- **TypeScript strict mode** owns all domain, Harness, fixture, and browser-facing contracts.
- **React + Vite** implement the browser presentation boundary; React imports do not enter `src/core`.
- **CSS Grid, SVG, and restrained CSS transitions** render the finite board; baseline does not require Canvas, Pixi, Phaser, or a browser Cocos runtime.
- Production is a static `dist/` artifact served by the existing static web server; Bun is not a production daemon.
- CI verifies typecheck, Bun tests, C++ tests, production build, and browser E2E before publishing a static artifact.

## Quality gates

- Canonical state serialization and command replay are deterministic.
- Every core rule has a scenario-level acceptance requirement.
- Every fixed level has a winning replay trace.
- AI-generated changes must be traceable to a rule/spec version and validated through the Harness.
- The C++ connected-component function has deterministic order, boundary handling, and independent tests.
