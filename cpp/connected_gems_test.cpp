#include "connected_gems.hpp"

#include <cstdlib>
#include <iostream>
#include <string_view>
#include <utility>
#include <vector>

namespace {

using Board = std::vector<std::vector<GemCell>>;
using Position = std::pair<int, int>;

[[noreturn]] void Fail(std::string_view message) {
    std::cerr << "FAILED: " << message << '\n';
    std::exit(EXIT_FAILURE);
}

void Expect(bool condition, std::string_view message) {
    if (!condition) {
        Fail(message);
    }
}

void ExpectPositions(
    const std::vector<Position>& actual,
    const std::vector<Position>& expected,
    std::string_view message) {
    Expect(actual == expected, message);
}

void ExpectBoardUnchanged(const Board& actual, const Board& expected) {
    Expect(actual.size() == expected.size(), "board row count changed");
    for (std::size_t row = 0; row < actual.size(); ++row) {
        Expect(actual[row].size() == expected[row].size(), "board column count changed");
        for (std::size_t col = 0; col < actual[row].size(); ++col) {
            Expect(
                actual[row][col].color == expected[row][col].color &&
                    actual[row][col].movable == expected[row][col].movable,
                "board cell changed");
        }
    }
}

void TestDiagonalConnectivity() {
    const Board board{
        {{1, true}, {-1, false}, {-1, false}},
        {{-1, false}, {1, true}, {-1, false}},
        {{-1, false}, {-1, false}, {1, true}},
    };

    ExpectPositions(
        FindConnectedMovableGems(board, 0, 0),
        {{0, 0}, {1, 1}, {2, 2}},
        "diagonal same-color gems should form one component");
}

void TestLockedAndColorBarriers() {
    const Board colorBarrier{{{1, true}, {2, true}, {1, true}}};
    ExpectPositions(
        FindConnectedMovableGems(colorBarrier, 0, 0),
        {{0, 0}},
        "a different-color gem should block a component path");

    const Board lockedBarrier{{{1, true}, {1, false}, {1, true}}};
    ExpectPositions(
        FindConnectedMovableGems(lockedBarrier, 0, 0),
        {{0, 0}},
        "a locked same-color gem should block a component path");
}

void TestInvalidAndIneligibleStarts() {
    const Board board{
        {{1, true}, {-1, true}},
        {{1, true}},
    };

    ExpectPositions(
        FindConnectedMovableGems(board, 0, 1),
        {},
        "an empty start should return no positions");
    ExpectPositions(
        FindConnectedMovableGems(board, 1, 1),
        {},
        "a column beyond a short row should return no positions");
    ExpectPositions(
        FindConnectedMovableGems(board, -1, 0),
        {},
        "a negative row should return no positions");
    ExpectPositions(
        FindConnectedMovableGems(board, 0, -1),
        {},
        "a negative column should return no positions");
    ExpectPositions(
        FindConnectedMovableGems(board, 2, 0),
        {},
        "a row beyond the board should return no positions");

    const Board lockedStart{{{2, false}}};
    ExpectPositions(
        FindConnectedMovableGems(lockedStart, 0, 0),
        {},
        "a locked start should return no positions");

    const Board emptyBoard;
    ExpectPositions(
        FindConnectedMovableGems(emptyBoard, 0, 0),
        {},
        "an empty board should return no positions");
}

void TestStableBreadthFirstOrder() {
    const Board board{
        {{-1, false}, {1, true}, {-1, false}},
        {{-1, false}, {1, true}, {1, true}},
        {{-1, false}, {-1, false}, {1, true}},
    };

    ExpectPositions(
        FindConnectedMovableGems(board, 1, 1),
        {{1, 1}, {0, 1}, {1, 2}, {2, 2}},
        "component order should use the fixed breadth-first neighbor order");
}

void TestInputIsNotMutated() {
    Board board{
        {{1, true}, {1, true}, {-1, false}},
        {{1, true}, {1, false}, {1, true}},
        {{-1, false}, {1, true}, {1, true}},
    };
    const Board before = board;

    const std::vector<Position> component = FindConnectedMovableGems(board, 0, 0);

    Expect(!component.empty(), "test fixture should contain a valid component");
    ExpectBoardUnchanged(board, before);
}

}  // namespace

int main() {
    TestDiagonalConnectivity();
    TestLockedAndColorBarriers();
    TestInvalidAndIneligibleStarts();
    TestStableBreadthFirstOrder();
    TestInputIsNotMutated();

    std::cout << "connected_gems tests passed\n";
    return EXIT_SUCCESS;
}
