#include "game_core.hpp"

#include <cstdlib>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

namespace {

[[noreturn]] void Fail(std::string_view message) {
  std::cerr << "FAILED: " << message << '\n';
  std::exit(EXIT_FAILURE);
}

void Expect(bool condition, std::string_view message) {
  if (!condition) {
    Fail(message);
  }
}

void ExpectContains(std::string_view actual, std::string_view expected,
                    std::string_view message) {
  Expect(actual.find(expected) != std::string_view::npos, message);
}

std::string ReadSessionResult(std::uintptr_t session_handle) {
  const std::size_t length = bs_core_result_length(session_handle);
  Expect(length > 0U, "session result should not be empty");
  std::vector<char> bytes(length);
  Expect(bs_core_copy_result(session_handle, bytes.data(), bytes.size()) ==
             length,
         "session result should copy completely");
  return {bytes.data(), bytes.size()};
}

constexpr std::string_view kSwapLevel = R"json(
{
  "schemaVersion": 1,
  "id": "core-unit",
  "rows": 1,
  "cols": 2,
  "shelfCapacity": 12,
  "cells": [
    { "row": 0, "col": 0, "targetColor": "ice", "gem": { "id": "a", "color": "navy" } },
    { "row": 0, "col": 1, "targetColor": "navy", "gem": { "id": "b", "color": "ice" } }
  ]
}
)json";

constexpr std::string_view kExpectedWonDump =
    "{\"schemaVersion\":1,\"levelId\":\"core-unit\",\"board\":{\"rows\":1,"
    "\"cols\":2,\"cells\":[{\"row\":0,\"col\":0,\"targetColor\":\"ice\","
    "\"gemId\":\"b\"},{\"row\":0,\"col\":1,\"targetColor\":\"navy\",\"gemId\":"
    "\"a\"}]},\"gems\":[{\"id\":\"a\",\"color\":\"navy\"},{\"id\":\"b\","
    "\"color\":\"ice\"}],\"shelf\":{\"width\":12,\"capacity\":12,\"gemIds\":[]}"
    ",\"selection\":null,\"status\":\"won\"}";

void TestWinningTraceAndCanonicalDump() {
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create(kSwapLevel, &error);
  Expect(core != nullptr, "valid LevelSpec should create a core");
  Expect(error.empty(), "valid LevelSpec should not return an error");

  const std::vector<std::string_view> trace{
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json",
      R"json({"type":"place-selection-in-shelf"})json",
      R"json({"type":"select-board-gem","coord":{"row":0,"col":1}})json",
      R"json({"type":"place-selection-at-target","coord":{"row":0,"col":0}})json",
      R"json({"type":"select-shelf-gem","index":0})json",
      R"json({"type":"place-selection-at-target","coord":{"row":0,"col":1}})json",
  };
  for (const std::string_view command : trace) {
    const CoreDispatchResult result = core->DispatchJson(command);
    Expect(!result.protocol_error, "winning trace command should parse");
    ExpectContains(result.json, "\"canonicalDump\"",
                   "transition should include canonical evidence");
  }

  Expect(core->CanonicalDump() == kExpectedWonDump,
         "winning trace should reach exact canonical dump");
  const CoreDispatchResult won_transition = core->DispatchJson(
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json");
  ExpectContains(won_transition.json, "\"code\":\"game-won\"",
                 "terminal state should reject further commands");

  const CoreDispatchResult restarted =
      core->DispatchJson(R"json({"type":"restart-level"})json");
  Expect(!restarted.protocol_error, "restart command should parse");
  ExpectContains(restarted.json, "\"status\":\"playing\"",
                 "restart should restore playing state");
}

void TestLockedRejectionAndProtocolError() {
  constexpr std::string_view level = R"json(
{
  "schemaVersion": 1,
  "id": "locked",
  "rows": 1,
  "cols": 3,
  "shelfCapacity": 12,
  "cells": [
    { "row": 0, "col": 0, "targetColor": "ice", "gem": { "id": "locked", "color": "ice" } },
    { "row": 0, "col": 1, "targetColor": "coral", "gem": { "id": "navy", "color": "navy" } },
    { "row": 0, "col": 2, "targetColor": "navy", "gem": { "id": "coral", "color": "coral" } }
  ]
}
)json";
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create(level, &error);
  Expect(core != nullptr, "locked fixture should create a core");

  const std::string before = core->CanonicalDump();
  const CoreDispatchResult locked = core->DispatchJson(
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json");
  ExpectContains(locked.json, "\"code\":\"locked-gem\"",
                 "matching gem should reject selection");
  Expect(core->CanonicalDump() == before, "rejection should not mutate state");

  const CoreDispatchResult malformed = core->DispatchJson("{");
  Expect(malformed.protocol_error,
         "malformed command should return protocol error");
  ExpectContains(malformed.json, "\"code\":\"invalid-command\"",
                 "protocol error should be actionable");
}

void TestExpandedPaletteAndConfiguredShelf() {
  constexpr std::string_view level = R"json(
{
  "schemaVersion": 1,
  "id": "configured-shelf",
  "rows": 1,
  "cols": 3,
  "shelfCapacity": 16,
  "cells": [
    { "row": 0, "col": 0, "targetColor": "obsidian", "gem": { "id": "pearl", "color": "pearl" } },
    { "row": 0, "col": 1, "targetColor": "pearl", "gem": { "id": "amber", "color": "amber" } },
    { "row": 0, "col": 2, "targetColor": "amber", "gem": { "id": "obsidian", "color": "obsidian" } }
  ]
}
)json";
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create(level, &error);
  Expect(core != nullptr,
         "expanded palette and sixteen-slot Shelf should create a core");
  ExpectContains(core->CanonicalDump(), "\"width\":16,\"capacity\":16",
                 "Shelf width should follow capacity");
  ExpectContains(core->CanonicalDump(), "\"color\":\"obsidian\"",
                 "new colors should remain canonical");

  const CoreDispatchResult selected = core->DispatchJson(
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json");
  Expect(!selected.protocol_error, "expanded-color gem should be selectable");
  const CoreDispatchResult stored =
      core->DispatchJson(R"json({"type":"place-selection-in-shelf"})json");
  ExpectContains(stored.json, "\"gemIds\":[\"pearl\"]",
                 "configured Shelf should accept the selected gem");
}

void TestGlobalWand() {
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create(kSwapLevel, &error);
  Expect(core != nullptr, "global wand fixture should create a core");

  const CoreDispatchResult solved =
      core->DispatchJson(R"json({"type":"apply-global-wand"})json");
  Expect(!solved.protocol_error, "global wand command should parse");
  ExpectContains(solved.json,
                 "\"events\":[{\"type\":\"global-wand-applied\",\"detail\":"
                 "\"2\"},{\"type\":\"won\"}]",
                 "global wand should emit one aggregate event before won");
  Expect(core->CanonicalDump() == kExpectedWonDump,
         "global wand should reach the exact deterministic won dump");
  const CoreDispatchResult repeated =
      core->DispatchJson(R"json({"type":"apply-global-wand"})json");
  ExpectContains(repeated.json, "\"code\":\"game-won\"",
                 "a completed level should reject a duplicate global wand");

  core = BrilliantSortCore::Create(kSwapLevel, &error);
  const CoreDispatchResult mid_game_selected = core->DispatchJson(
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json");
  Expect(!mid_game_selected.protocol_error,
         "mid-game global wand setup should select a gem");
  const CoreDispatchResult mid_game_stored =
      core->DispatchJson(R"json({"type":"place-selection-in-shelf"})json");
  Expect(!mid_game_stored.protocol_error,
         "mid-game global wand setup should populate Shelf");
  const CoreDispatchResult mid_game =
      core->DispatchJson(R"json({"type":"apply-global-wand"})json");
  ExpectContains(mid_game.json, "\"gemIds\":[]",
                 "global wand should empty a populated Shelf");
  ExpectContains(mid_game.json, "\"selection\":null",
                 "global wand should clear a mid-game selection");
  ExpectContains(mid_game.json, "\"status\":\"won\"",
                 "global wand should win from a mid-game state");
}

void TestCAbiSession() {
  const std::uintptr_t session =
      bs_core_create(kSwapLevel.data(), kSwapLevel.size());
  Expect(session != 0U, "C ABI should create a session");
  const std::string initial = ReadSessionResult(session);
  ExpectContains(initial, "\"state\"",
                 "C ABI creation should expose initial transition");

  constexpr std::string_view command =
      R"json({"type":"select-board-gem","coord":{"row":0,"col":0}})json";
  Expect(bs_core_dispatch(session, command.data(), command.size()) == 0,
         "C ABI should dispatch a valid command");
  const std::string selected = ReadSessionResult(session);
  ExpectContains(selected, "\"selection-changed\"",
                 "C ABI should expose ordered events");
  bs_core_destroy(session);
}

void TestArticulationSelectionRemainder() {
  constexpr std::string_view level = R"json(
{
  "schemaVersion": 1,
  "id": "articulation-selection",
  "rows": 2,
  "cols": 3,
  "shelfCapacity": 1,
  "cells": [
    { "row": 0, "col": 0, "targetColor": "coral", "gem": { "id": "A", "color": "ice" } },
    { "row": 0, "col": 1, "targetColor": "coral", "gem": { "id": "B", "color": "ice" } },
    { "row": 0, "col": 2, "targetColor": "coral", "gem": { "id": "C", "color": "ice" } },
    { "row": 1, "col": 0, "targetColor": "ice", "gem": { "id": "D", "color": "coral" } },
    { "row": 1, "col": 1, "targetColor": "ice", "gem": { "id": "E", "color": "coral" } },
    { "row": 1, "col": 2, "targetColor": "ice", "gem": { "id": "F", "color": "coral" } }
  ]
}
)json";
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create(level, &error);
  Expect(core != nullptr, "articulation fixture should create a core");

  const CoreDispatchResult selected = core->DispatchJson(
      R"json({"type":"select-board-gem","coord":{"row":0,"col":1}})json");
  Expect(!selected.protocol_error, "bridge gem should create the selection");
  const CoreDispatchResult stored =
      core->DispatchJson(R"json({"type":"place-selection-in-shelf"})json");
  ExpectContains(stored.json, "\"detail\":\"B->shelf\"",
                 "the immutable anchor should move first");
  ExpectContains(
      core->CanonicalDump(),
      "\"shelf\":{\"width\":1,\"capacity\":1,\"gemIds\":[\"B\"]},"
      "\"selection\":{\"container\":\"board\",\"anchor\":{\"row\":0,"
      "\"col\":1},\"color\":\"ice\",\"gemIds\":[\"A\",\"C\"]}",
      "disconnected endpoints should remain in one Selection snapshot");
}

void TestInvalidLevel() {
  std::string error;
  std::unique_ptr<BrilliantSortCore> core =
      BrilliantSortCore::Create("{}", &error);
  Expect(core == nullptr, "incomplete LevelSpec should not create a core");
  Expect(!error.empty(), "invalid LevelSpec should explain the failure");
}

} // namespace

int main() {
  TestWinningTraceAndCanonicalDump();
  TestLockedRejectionAndProtocolError();
  TestExpandedPaletteAndConfiguredShelf();
  TestGlobalWand();
  TestCAbiSession();
  TestArticulationSelectionRemainder();
  TestInvalidLevel();
  std::cout << "game_core tests passed\n";
  return EXIT_SUCCESS;
}
