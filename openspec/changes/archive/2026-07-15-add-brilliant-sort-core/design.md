# Design: Brilliant Sort Deterministic Core

## 1. Evidence boundary

### Observed gameplay facts used by the baseline

- An active board cell has a target color; its occupying gem has an independent current color.
- A board gem is movable exactly when its gem color differs from the target color. A matching gem is locked and cannot be moved by normal selection, Shelf interaction, or power-up behavior.
- Clicking a movable gem selects the maximal same-color movable component under eight-neighbor adjacency. Locked and differently colored gems break a path.
- A selected component is lifted visually, but lifting does not create a special logical gem type.
- Partial movement removes only an outer gem whose removal leaves the remaining selected component eight-neighbor connected.
- Clicking a matching empty target component batch-fills as many cells as possible. Unmoved members remain selected.
- Shelf is a twelve-column compact store. Shelf gems use the same same-color/eight-neighbor component topology; removal compacts every later gem toward lower row-major index.
- Victory requires every active board cell to contain a matching gem and the Shelf to be empty. There is no loss, timer, or move-limit state.
- Gem identities and color counts are conserved. For each color, the world gem count equals the number of target cells of that color.
- Level starts are repeatable across restart and relaunch, so baseline content uses fixed fixtures.

### Baseline decisions made for determinism

- Fixed JSON `LevelSpec` is the content source of truth; baseline has no runtime RNG or seed-driven generation.
- Ties between eligible source gems use a total order: Chebyshev distance from the immutable selection anchor, then row, then column.
- Target cells in a selected destination component use the same anchor-distance, row, column order.
- Shelf rendering maps compact index `i` to `(row = floor(i / 12), col = i % 12)`.
- The baseline starts each fixture with one twelve-slot Shelf. Purchasing extra rows and power-up commands remain extension seams, not baseline acceptance requirements.

### Deferred extensions

The commercially observed wand, persistent coins, purchasable Shelf rows, additional power-ups, payment prompts, level unlocks, and random mode are documented only as extension concerns. They do not add required baseline commands or test cases.

### Deferred extension register

| Topic | Observed boundary | Baseline treatment |
| --- | --- | --- |
| Wand | A draggable fixed logical window can globally regularize affected gems while preserving gem/color totals; locked gems remain immovable | Keep only a future `PowerUpPolicy` seam; omit command, inventory, and effect acceptance from baseline |
| Extra Shelf purchase | Permanent currency can buy temporary twelve-slot Shelf rows | Keep baseline Shelf capacity fixed at twelve; omit profile, currency, purchase, and payment state |
| Other power-ups | Visible but intentionally not fully specified for this assessment | Do not infer or implement behavior |
| Fixed visual content | Pixel-art shapes and starts are repeatable across restart | Store explicit JSON LevelSpec fixtures |
| Random mode | A possible future product idea | Require a separate generator, conservation validator, and solvability contract before implementation |

## 2. Goals and non-goals

### Goals

1. Make all normal gameplay state transitions pure, deterministic, serializable, and replayable.
2. Preserve one rule authority for UI, Harness, test runner, and AI tools.
3. Make every source of ambiguity explicit rather than hiding it in animation or event handlers.
4. Represent fixed pixel-art levels without a procedural generator.
5. Provide a small C++ implementation target that shares the same component semantics.

### Non-goals

- Commercial parity, payment, account synchronization, and LiveOps.
- Exact reconstruction of unobserved internal algorithms.
- Runtime random level generation.
- A Cocos-specific core. A Cocos adapter may replace the web/vector adapter without changing commands or state contracts.

## 3. State model

```text
ColorId      := integer
GemId        := stable string or integer
Coord        := { row: integer, col: integer }
GameStatus   := Playing | Won
Container    := Board | Shelf
```

```text
BoardCell {
  targetColor: ColorId
  gemId: GemId | null
}

Gem {
  id: GemId
  color: ColorId
}

Shelf {
  width: 12
  capacity: integer       // baseline fixture value: 12
  gemIds: GemId[]         // compact row-major sequence, length <= capacity
}

Selection {
  gemIds: GemId[]         // ordered current members; never duplicates
  container: Container
  anchor: Coord           // immutable coordinate of the initial click
  color: ColorId
}

GameState {
  schemaVersion: 1
  levelId: string
  board: SparseGrid<BoardCell>
  gems: Map<GemId, Gem>
  shelf: Shelf
  selection: Selection | null
  status: GameStatus
}
```

`selection` is a reference set over gems still present in its source container. It does not own a second copy of gems. A renderer may lift those gems visually; the reducer sees their ordinary locations and membership in `selection`.

### LevelSpec

```json
{
  "schemaVersion": 1,
  "id": "penguin-01",
  "board": {
    "activeCells": [
      { "row": 0, "col": 0, "targetColor": 0, "gem": { "id": "g-0", "color": 1 } }
    ]
  },
  "initialShelf": { "capacity": 12, "gemIds": [] }
}
```

A fixture MUST satisfy:

```text
- each GemId appears exactly once across board and Shelf;
- each active board cell has a target color;
- for every color c:
    count(world gems with c) == count(active board targets with c);
- Shelf length <= capacity;
- initially locked gems match their target cells;
- initial state is canonicalizable without runtime random input.
```

## 4. Derived predicates and topology

```text
isLocked(cell)  := cell.gemId != null
                   && gem(cell.gemId).color == cell.targetColor

isMovableBoard(cell) := cell.gemId != null && !isLocked(cell)

isMovableShelf(index) := 0 <= index < shelf.gemIds.length
```

`Neighbors8(coord)` consists of the eight row/column deltas around `coord`. Board adjacency ignores inactive cells. Shelf adjacency uses the physical coordinates derived from compact row-major indices.

A selectable component is the maximal component containing the clicked gem such that every member:

```text
- is in the same container;
- is movable in that container;
- has the clicked gem color;
- is reachable through Neighbors8 members satisfying the prior conditions.
```

For a non-empty selected set `S`, define:

```text
Frontier(S): members with at least one 8-neighbor position not in S
SafeToRemove(S): members v where S - {v} is empty or remains 8-connected
Candidates(S): Frontier(S) ∩ SafeToRemove(S)
```

The reducer MUST preserve the invariant that a non-empty `selection.gemIds` forms one selectable connected component. Each extraction recomputes `Candidates(S)`.

## 5. Commands and reducer behavior

```text
GameCommand =
  | SelectBoardGem { coord }
  | SelectShelfGem { index }
  | CancelSelection
  | PlaceSelectionAtTarget { coord }
  | PlaceSelectionInShelf
  | RestartLevel
```

The pure reducer contract is:

```text
reduce(state, command, config)
  -> { nextState, events[], rejection?: Rejection }
```

A rejection preserves logical state and gives a stable reason code. Event examples: `SelectionChanged`, `GemPlaced`, `ShelfCompacted`, `Won`, `CommandRejected`.

### SelectBoardGem / SelectShelfGem

- Selecting a locked board gem rejects with `LockedGem`.
- Selecting an empty or invalid coordinate rejects with `NoSelectableGem`.
- Selecting a movable component replaces any prior selection; the prior selection only loses visual lift because its gems never left their source.
- A Shelf selection uses its compact current layout before any later removal or compaction.

### CancelSelection

Clears `selection`. It moves no gem, so all selected source locations remain unchanged.

### PlaceSelectionAtTarget

1. Require an active empty board cell at the command coordinate whose target color equals `selection.color`.
2. Find the maximal same-target-color, empty, eight-neighbor target component containing that coordinate.
3. Sort target cells by `(ChebyshevDistance(target, command.coord), row, col)`.
4. Until source or target is exhausted:
   - compute current `Candidates(S)`;
   - take the minimum source candidate by `(ChebyshevDistance(source, selection.anchor), row, col)`;
   - move its gem into the next target cell;
   - remove it from source and `selection`;
   - if source is Shelf, compact the Shelf immediately;
   - recompute candidates for any remaining selection.
5. Clear `selection` only when no members remain.
6. Recompute `status`; emit `Won` only when the victory predicate becomes true.

### PlaceSelectionInShelf

1. Require a board-origin selection and at least one free Shelf slot.
2. Let `count = min(selection.size, shelf.capacity - shelf.gemIds.length)`.
3. Repeat `count` safe extractions in source priority order.
4. Append extracted gems to `shelf.gemIds`, which places them into the leftmost available logical slots.
5. Keep any unextracted gems selected and connected.

A full Shelf rejects `PlaceSelectionInShelf`; the player may select a Shelf component instead, which replaces the visual selection without moving the prior component.

### Shelf compaction

Whenever a gem leaves Shelf, remove its sequence element. Every later sequence element shifts one logical index toward zero. This is semantic state, not merely a UI animation.

### RestartLevel

Reloads the canonical fixed `LevelSpec` initial state. Profile persistence and purchases are outside baseline state; baseline restart only resets the level attempt.

## 6. Victory, safety, and liveness

```text
isWon(state) :=
  state.shelf.gemIds is empty
  && state.selection is null
  && every active board cell has a gem
  && every active board gem matches its target color
```

The reducer never produces `Lost`. A rejected command is observable diagnostic feedback while status remains `Playing`.

Required safety invariants:

- Gem identities occur once in world state.
- Per-color gem totals are conserved.
- Locked board gems never move.
- Shelf is compact and does not exceed capacity.
- A non-empty selection remains connected.
- A placed gem always matches the target cell that receives it.

For baseline fixtures, completeness is shown by a winning command log replayed through the production reducer. This proves a winning path without claiming that every arbitrary player command sequence terminates.

## 7. Serialization and presentation boundary

`state.dump()` returns canonical JSON with stable ordering of coordinates, gem IDs, Shelf sequence, selection member IDs, status, and schema version. It never serializes screen pixels, animation timing, or object references.

A `PresentationAdapter`:

```text
- reads canonical state and events;
- maps pointer coordinates to logical Board/Shelf commands;
- renders the baseline through React, CSS Grid, SVG, and short CSS state transitions;
- never writes GameState directly.
```

The baseline application is built with Bun, TypeScript strict mode, React, and Vite. The production result is a static `dist/` artifact; production does not run a Bun service or retain authoritative game state. A future Cocos adapter replaces presentation only; commands, reducer, state, events, and Harness remain unchanged.


## 8. Harness architecture

The Harness exposes equivalent operations:

```text
scenario.load(name | JSON)
state.dump()
command.apply(command)
trace.replay(commandLog)
test.run(selector)
snapshot.diff(expected, actual)
```

Each `command.apply` captures:

```text
command
before canonical state
next canonical state
events
rejection, if any
field-level diff
```

Baseline fixture suite:

1. Same-color movable eight-neighbor selection, including diagonal connectivity, locked/other-color barriers, stable output, and invalid start.
2. A fixed level's complete winning replay and victory assertion.
3. Shelf capacity, row-major compaction, rejected invalid target, cancellation, and selection replacement.
4. Determinism: identical fixture and command log produce byte-equivalent canonical dumps.

### Required acceptance fixtures

| Fixture | Initial state | Command sequence | Expected result | Failure diagnostic |
| --- | --- | --- | --- | --- |
| `component-diagonal` | Diagonally touching movable gems, plus locked and other-color barriers | `SelectBoardGem(start)` | Exact stable component membership | Clicked coordinate, expected/actual member IDs, rejected reason, component diff |
| `fixed-level-win` | Named fixed LevelSpec with empty Shelf | Committed winning command log | `Won`, empty Shelf, all active cells locked | First divergent command, before/after dump, events, semantic diff |
| `shelf-boundary` | Oversized selected component and partially/full Shelf variants | Select, place to Shelf, select from Shelf, cancel/invalid place | Partial absorption, row-major compaction, stable rejection/cancellation | Capacity, compact sequence before/after, selection IDs, rejection |
| `deterministic-replay` | Same fixture serialized twice | Same command log twice | Byte-equivalent final canonical dumps | First changed canonical JSON path and expected/actual values |

## 9. AI-agent repair loop

The AI agent receives only:

```text
- relevant requirement/spec sections;
- the current fixture and acceptance command log;
- targeted reducer/Harness source;
- structured trace, rejection, and snapshot diff on failure;
- explicit scope constraints.
```

For each visible change, the audit record stores rule/spec version, inputs, changed files, commands/tests run, results, failure reason, and next decision. An agent may make a minimal patch and run focused checks. If it encounters an assumption conflict or a rule not specified by the baseline, it stops and requests human clarification rather than inventing behavior.

## 10. C++ exercise boundary

`FindConnectedMovableGems` is an independent, pure C++ function over `GemCell` input. It uses the same conceptual selection predicate—same color, movable, eight-neighbor component—but has no UI, Shelf, reducer, or power-up dependency. Its concrete signature, stable BFS order, tests, complexity, and placement-priority extension inputs are defined in the C++ delta specification.

## 11. Extension and refactoring boundaries

The following changes are extension-safe because they do not alter the core state/command protocol:

```text
- Replace vector/web presentation with a Cocos PresentationAdapter.
- Add power-ups through a policy/command layer after their rules receive an approved spec.
- Add persistent profile, purchases, or additional Shelf rows outside LevelAttemptState.
- Add fixed content by shipping more LevelSpec JSON fixtures.
- Add a random mode through a separately validated generator and solver contract.
```

The following changes intentionally require rule-core review or refactoring because they alter established invariants:

```text
- Changing eight-neighbor topology or same-color component semantics.
- Allowing locked gems to move.
- Making Shelf sparse instead of compact.
- Adding loss, timers, or move limits.
- Replacing conservation with gem creation, deletion, or recoloring.
- Making reducer output depend on uncontrolled randomness or presentation timing.
```

Any such refactor MUST update the core gameplay specification, fixture validators, replay baselines, Harness assertions, C++ exercise alignment where relevant, and agent-context constraints together.
