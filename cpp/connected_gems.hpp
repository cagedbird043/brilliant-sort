#ifndef BRILLIANT_SORT_CONNECTED_GEMS_HPP
#define BRILLIANT_SORT_CONNECTED_GEMS_HPP

#include <utility>
#include <vector>

struct GemCell {
    int color;      // -1 means no gem
    bool movable;   // false means locked or otherwise ineligible
};

// Returns the same-color movable eight-neighbor component containing the start.
// Positions use breadth-first discovery order: N, NE, E, SE, S, SW, W, NW.
// The traversal is O(V) time and O(V) auxiliary memory over the discovered grid.
// It only discovers topology; placement priority requires separate policy inputs.
std::vector<std::pair<int, int>> FindConnectedMovableGems(
    const std::vector<std::vector<GemCell>>& board,
    int startRow,
    int startCol);

#endif  // BRILLIANT_SORT_CONNECTED_GEMS_HPP
