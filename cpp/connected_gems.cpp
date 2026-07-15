#include "connected_gems.hpp"

#include <array>
#include <cstddef>

namespace {

using Position = std::pair<int, int>;

constexpr std::array<Position, 8> kNeighborOffsets{{
    {-1, 0},
    {-1, 1},
    {0, 1},
    {1, 1},
    {1, 0},
    {1, -1},
    {0, -1},
    {-1, -1},
}};

bool IsInBounds(const std::vector<std::vector<GemCell>>& board, int row, int col) {
    return row >= 0 && col >= 0 &&
           static_cast<std::size_t>(row) < board.size() &&
           static_cast<std::size_t>(col) < board[static_cast<std::size_t>(row)].size();
}

}  // namespace

std::vector<std::pair<int, int>> FindConnectedMovableGems(
    const std::vector<std::vector<GemCell>>& board,
    int startRow,
    int startCol) {
    if (!IsInBounds(board, startRow, startCol)) {
        return {};
    }

    const GemCell& start = board[static_cast<std::size_t>(startRow)]
                                [static_cast<std::size_t>(startCol)];
    if (start.color == -1 || !start.movable) {
        return {};
    }

    std::vector<std::vector<bool>> visited;
    visited.reserve(board.size());
    for (const auto& row : board) {
        visited.emplace_back(row.size(), false);
    }

    std::vector<Position> component;
    component.emplace_back(startRow, startCol);
    visited[static_cast<std::size_t>(startRow)][static_cast<std::size_t>(startCol)] = true;

    // component doubles as the FIFO queue, preserving breadth-first discovery order.
    for (std::size_t next = 0; next < component.size(); ++next) {
        const Position current = component[next];
        for (const Position offset : kNeighborOffsets) {
            const int row = current.first + offset.first;
            const int col = current.second + offset.second;
            if (!IsInBounds(board, row, col)) {
                continue;
            }

            const std::size_t rowIndex = static_cast<std::size_t>(row);
            const std::size_t colIndex = static_cast<std::size_t>(col);
            if (visited[rowIndex][colIndex]) {
                continue;
            }

            const GemCell& candidate = board[rowIndex][colIndex];
            if (candidate.color != start.color || !candidate.movable) {
                continue;
            }

            // Mark at enqueue time so no second parent can enqueue this cell.
            visited[rowIndex][colIndex] = true;
            component.emplace_back(row, col);
        }
    }

    return component;
}
