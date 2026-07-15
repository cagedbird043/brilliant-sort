# C++ Connected Movable Gems Specification

## ADDED Requirements

### Requirement: The function exposes the required pure C++ interface

The implementation SHALL provide:

```cpp
struct GemCell {
    int color;      // -1 means no gem
    bool movable;   // false means locked or otherwise ineligible
};

std::vector<std::pair<int, int>> FindConnectedMovableGems(
    const std::vector<std::vector<GemCell>>& board,
    int startRow,
    int startCol);
```

The function SHALL be pure: it SHALL not mutate `board`, depend on UI state, use randomness, or require Shelf/reducer state.

#### Scenario: Input board remains unchanged

- **GIVEN** a valid board and start coordinate
- **WHEN** the function is called
- **THEN** the returned positions may be inspected
- **AND THEN** every input `GemCell` retains its original color and movable flag.

### Requirement: Invalid or ineligible starts return an empty result

The function SHALL return an empty vector when the start row/column is out of bounds, the start row is shorter than the requested column, the start cell has color `-1`, or the start cell is not movable.

#### Scenario: Locked start

- **GIVEN** a board whose start cell has color `2` and `movable == false`
- **WHEN** the function is called at that start cell
- **THEN** the result is empty.

#### Scenario: Empty and out-of-bounds starts

- **GIVEN** a board with an empty `color == -1` cell and an out-of-bounds coordinate
- **WHEN** the function is called for either coordinate
- **THEN** each result is empty.

### Requirement: Traversal returns the same-color movable eight-neighbor component

For a valid start, the function SHALL return exactly the positions reachable from the start through cells that both have the start color and are movable. The eight directions are north, northeast, east, southeast, south, southwest, west, and northwest. A cell SHALL not be returned more than once.

#### Scenario: Diagonal reachability

- **GIVEN** movable color-1 cells at `(0,0)`, `(1,1)`, and `(2,2)`
- **AND GIVEN** no other eligible color-1 cells
- **WHEN** traversal starts at `(0,0)`
- **THEN** all three positions are returned.

#### Scenario: Color and movable barriers

- **GIVEN** a path of color-1 cells interrupted by either a color-2 cell or a non-movable color-1 cell
- **AND GIVEN** no alternate eight-neighbor eligible path
- **WHEN** traversal starts on one side of the interruption
- **THEN** no position beyond the interruption is returned.

### Requirement: Output order is stable BFS order

The start position SHALL be first. Remaining positions SHALL be emitted in breadth-first discovery order using this fixed neighbor order:

```text
north, northeast, east, southeast,
south, southwest, west, northwest
```

The implementation SHALL mark a cell visited when it is enqueued, not when it is dequeued, so duplicate queue entries cannot alter output order.

#### Scenario: Stable ordered result

- **GIVEN** a start at `(1,1)` with eligible unvisited neighbors north `(0,1)`, east `(1,2)`, and southeast `(2,2)`
- **WHEN** the function is called
- **THEN** the prefix of the output is `[(1,1), (0,1), (1,2), (2,2)]`.

### Requirement: Complexity is linear in the discovered search space

The implementation SHALL use iterative breadth-first search. Its time complexity SHALL be `O(V + E)` over traversed eligible cells and eight-neighbor edges, which is `O(V)` for bounded-degree grids. Its auxiliary memory SHALL be `O(V)` for visited bookkeeping and queue storage.

#### Scenario: Large connected fixture

- **GIVEN** a large connected movable component
- **WHEN** traversal runs
- **THEN** it completes without recursive stack dependence
- **AND THEN** each reachable coordinate is returned once.

### Requirement: Placement-priority extension needs explicit extra rules

The connected-component function SHALL not claim to choose which gem moves next. A future placement-priority layer SHALL require at least the selected component anchor, current source coordinates, destination target component and anchor, safe-removal predicate, container/Shelf capacity, locked-cell rules, and a deterministic tie-breaking policy.

#### Scenario: Traversal alone cannot choose a placement order

- **GIVEN** a three-gem line selected from its middle
- **WHEN** a caller asks which single gem should move first
- **THEN** this function returns the full component only
- **AND THEN** the caller must apply the separate safe-boundary placement policy to avoid splitting the remainder.
