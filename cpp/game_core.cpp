#include "game_core.hpp"

#include "connected_gems.hpp"

#include <algorithm>
#include <array>
#include <charconv>
#include <cstdint>
#include <cstring>
#include <limits>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace {

constexpr int kSchemaVersion = 1;

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

enum class Color {
  kNavy = 0,
  kIce = 1,
  kCoral = 2,
  kJade = 3,
  kObsidian = 4,
  kPearl = 5,
  kAmber = 6,
  kCount = 7,
};

[[nodiscard]] const char *ColorName(Color color) {
  switch (color) {
  case Color::kNavy:
    return "navy";
  case Color::kIce:
    return "ice";
  case Color::kCoral:
    return "coral";
  case Color::kJade:
    return "jade";
  case Color::kObsidian:
    return "obsidian";
  case Color::kPearl:
    return "pearl";
  case Color::kAmber:
    return "amber";
  case Color::kCount:
    break;
  }

  return "unknown";
}

[[nodiscard]] std::optional<Color> ColorFromName(std::string_view name) {
  if (name == "navy") {
    return Color::kNavy;
  }
  if (name == "ice") {
    return Color::kIce;
  }
  if (name == "coral") {
    return Color::kCoral;
  }
  if (name == "jade") {
    return Color::kJade;
  }
  if (name == "obsidian") {
    return Color::kObsidian;
  }
  if (name == "pearl") {
    return Color::kPearl;
  }
  if (name == "amber") {
    return Color::kAmber;
  }
  return std::nullopt;
}

struct Coord {
  int row = 0;
  int col = 0;
};

[[nodiscard]] std::string CoordKey(Coord coord) {
  return std::to_string(coord.row) + ":" + std::to_string(coord.col);
}

[[nodiscard]] int CompareCoords(Coord left, Coord right) {
  if (left.row != right.row) {
    return left.row < right.row ? -1 : 1;
  }
  if (left.col != right.col) {
    return left.col < right.col ? -1 : 1;
  }
  return 0;
}

[[nodiscard]] int ChebyshevDistance(Coord left, Coord right) {
  const int row_distance =
      left.row >= right.row ? left.row - right.row : right.row - left.row;
  const int col_distance =
      left.col >= right.col ? left.col - right.col : right.col - left.col;
  return std::max(row_distance, col_distance);
}

[[nodiscard]] int CompareByAnchor(Coord anchor, Coord left, Coord right) {
  const int distance_difference =
      ChebyshevDistance(left, anchor) - ChebyshevDistance(right, anchor);
  if (distance_difference != 0) {
    return distance_difference;
  }
  return CompareCoords(left, right);
}

struct Gem {
  std::string id;
  Color color = Color::kNavy;
};

struct BoardCell {
  Color target_color = Color::kNavy;
  std::optional<std::string> gem_id;
};

enum class SelectionContainer {
  kBoard,
  kShelf,
};

struct Selection {
  SelectionContainer container = SelectionContainer::kBoard;
  Coord anchor;
  Color color = Color::kNavy;
  std::vector<std::string> gem_ids;
};

struct State {
  std::string level_id;
  int rows = 0;
  int cols = 0;
  int shelf_capacity = 0;
  std::vector<std::optional<BoardCell>> board_cells;
  std::map<std::string, Gem> gems;
  std::vector<std::string> shelf_gem_ids;
  std::optional<Selection> selection;
  bool won = false;
};

struct Location {
  std::string gem_id;
  Coord coord;
};

struct GameEvent {
  std::string type;
  std::optional<std::string> detail;
};

struct Rejection {
  std::string code;
  std::string detail;
};

struct Transition {
  std::vector<GameEvent> events;
  std::optional<Rejection> rejection;
};

class JsonValue {
public:
  enum class Kind {
    kNull,
    kBoolean,
    kNumber,
    kString,
    kArray,
    kObject,
  };

  JsonValue() = default;

  static JsonValue Boolean(bool value) {
    JsonValue result;
    result.kind = Kind::kBoolean;
    result.boolean_value = value;
    return result;
  }

  static JsonValue Number(std::int64_t value) {
    JsonValue result;
    result.kind = Kind::kNumber;
    result.number_value = value;
    return result;
  }

  static JsonValue String(std::string value) {
    JsonValue result;
    result.kind = Kind::kString;
    result.string_value = std::move(value);
    return result;
  }

  static JsonValue Array(std::vector<JsonValue> value) {
    JsonValue result;
    result.kind = Kind::kArray;
    result.array_value = std::move(value);
    return result;
  }

  static JsonValue
  Object(std::vector<std::pair<std::string, JsonValue>> value) {
    JsonValue result;
    result.kind = Kind::kObject;
    result.object_value = std::move(value);
    return result;
  }

  Kind kind = Kind::kNull;
  bool boolean_value = false;
  std::int64_t number_value = 0;
  std::string string_value;
  std::vector<JsonValue> array_value;
  std::vector<std::pair<std::string, JsonValue>> object_value;
};

class JsonParser {
public:
  explicit JsonParser(std::string_view text) : text_(text) {}

  [[nodiscard]] JsonValue Parse() {
    SkipWhitespace();
    JsonValue value = ParseValue();
    SkipWhitespace();
    if (position_ != text_.size()) {
      Fail("unexpected trailing content");
    }
    return value;
  }

private:
  [[noreturn]] void Fail(std::string_view message) const {
    throw std::runtime_error("JSON parse error at byte " +
                             std::to_string(position_) + ": " +
                             std::string(message));
  }

  void SkipWhitespace() {
    while (position_ < text_.size()) {
      const char current = text_[position_];
      if (current != ' ' && current != '\n' && current != '\r' &&
          current != '\t') {
        return;
      }
      ++position_;
    }
  }

  [[nodiscard]] char Peek() const {
    if (position_ >= text_.size()) {
      Fail("unexpected end of input");
    }
    return text_[position_];
  }

  void Expect(char expected) {
    if (Peek() != expected) {
      Fail(std::string("expected '") + expected + "'");
    }
    ++position_;
  }

  void ConsumeLiteral(std::string_view literal) {
    if (text_.substr(position_, literal.size()) != literal) {
      Fail("invalid literal");
    }
    position_ += literal.size();
  }

  [[nodiscard]] JsonValue ParseValue() {
    SkipWhitespace();
    switch (Peek()) {
    case '{':
      return ParseObject();
    case '[':
      return ParseArray();
    case '"':
      return JsonValue::String(ParseString());
    case 't':
      ConsumeLiteral("true");
      return JsonValue::Boolean(true);
    case 'f':
      ConsumeLiteral("false");
      return JsonValue::Boolean(false);
    case 'n':
      ConsumeLiteral("null");
      return JsonValue();
    default:
      return ParseNumber();
    }
  }

  [[nodiscard]] JsonValue ParseObject() {
    Expect('{');
    SkipWhitespace();
    std::vector<std::pair<std::string, JsonValue>> fields;
    if (Peek() == '}') {
      ++position_;
      return JsonValue::Object(std::move(fields));
    }

    while (true) {
      SkipWhitespace();
      if (Peek() != '"') {
        Fail("object key must be a string");
      }
      std::string key = ParseString();
      if (std::any_of(fields.begin(), fields.end(), [&key](const auto &field) {
            return field.first == key;
          })) {
        Fail("duplicate object key");
      }
      SkipWhitespace();
      Expect(':');
      SkipWhitespace();
      fields.emplace_back(std::move(key), ParseValue());
      SkipWhitespace();
      const char separator = Peek();
      if (separator == '}') {
        ++position_;
        return JsonValue::Object(std::move(fields));
      }
      if (separator != ',') {
        Fail("expected ',' or '}'");
      }
      ++position_;
    }
  }

  [[nodiscard]] JsonValue ParseArray() {
    Expect('[');
    SkipWhitespace();
    std::vector<JsonValue> items;
    if (Peek() == ']') {
      ++position_;
      return JsonValue::Array(std::move(items));
    }

    while (true) {
      items.push_back(ParseValue());
      SkipWhitespace();
      const char separator = Peek();
      if (separator == ']') {
        ++position_;
        return JsonValue::Array(std::move(items));
      }
      if (separator != ',') {
        Fail("expected ',' or ']'");
      }
      ++position_;
      SkipWhitespace();
    }
  }

  [[nodiscard]] int ParseHexDigit() {
    if (position_ >= text_.size()) {
      Fail("incomplete unicode escape");
    }
    const char digit = text_[position_++];
    if (digit >= '0' && digit <= '9') {
      return digit - '0';
    }
    if (digit >= 'a' && digit <= 'f') {
      return digit - 'a' + 10;
    }
    if (digit >= 'A' && digit <= 'F') {
      return digit - 'A' + 10;
    }
    Fail("invalid unicode escape");
  }

  [[nodiscard]] std::uint32_t ParseUnicodeCodeUnit() {
    std::uint32_t code_unit = 0;
    for (int digit = 0; digit < 4; ++digit) {
      code_unit =
          (code_unit << 4U) | static_cast<std::uint32_t>(ParseHexDigit());
    }
    return code_unit;
  }

  static void AppendUtf8(std::string &output, std::uint32_t code_point) {
    if (code_point <= 0x7FU) {
      output.push_back(static_cast<char>(code_point));
    } else if (code_point <= 0x7FFU) {
      output.push_back(static_cast<char>(0xC0U | (code_point >> 6U)));
      output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    } else if (code_point <= 0xFFFFU) {
      output.push_back(static_cast<char>(0xE0U | (code_point >> 12U)));
      output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    } else {
      output.push_back(static_cast<char>(0xF0U | (code_point >> 18U)));
      output.push_back(
          static_cast<char>(0x80U | ((code_point >> 12U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    }
  }

  [[nodiscard]] std::string ParseString() {
    Expect('"');
    std::string value;
    while (position_ < text_.size()) {
      const char current = text_[position_++];
      if (current == '"') {
        return value;
      }
      if (static_cast<unsigned char>(current) < 0x20U) {
        Fail("unescaped control character in string");
      }
      if (current != '\\') {
        value.push_back(current);
        continue;
      }
      if (position_ >= text_.size()) {
        Fail("incomplete string escape");
      }
      const char escaped = text_[position_++];
      switch (escaped) {
      case '"':
        value.push_back('"');
        break;
      case '\\':
        value.push_back('\\');
        break;
      case '/':
        value.push_back('/');
        break;
      case 'b':
        value.push_back('\b');
        break;
      case 'f':
        value.push_back('\f');
        break;
      case 'n':
        value.push_back('\n');
        break;
      case 'r':
        value.push_back('\r');
        break;
      case 't':
        value.push_back('\t');
        break;
      case 'u': {
        std::uint32_t code_point = ParseUnicodeCodeUnit();
        if (code_point >= 0xD800U && code_point <= 0xDBFFU) {
          if (position_ + 2U > text_.size() || text_[position_] != '\\' ||
              text_[position_ + 1U] != 'u') {
            Fail("high surrogate without low surrogate");
          }
          position_ += 2U;
          const std::uint32_t low = ParseUnicodeCodeUnit();
          if (low < 0xDC00U || low > 0xDFFFU) {
            Fail("invalid low surrogate");
          }
          code_point =
              0x10000U + ((code_point - 0xD800U) << 10U) + (low - 0xDC00U);
        } else if (code_point >= 0xDC00U && code_point <= 0xDFFFU) {
          Fail("low surrogate without high surrogate");
        }
        AppendUtf8(value, code_point);
        break;
      }
      default:
        Fail("invalid string escape");
      }
    }
    Fail("unterminated string");
  }

  [[nodiscard]] JsonValue ParseNumber() {
    const std::size_t start = position_;
    if (Peek() == '-') {
      ++position_;
    }
    if (position_ >= text_.size()) {
      Fail("incomplete number");
    }
    if (text_[position_] == '0') {
      ++position_;
      if (position_ < text_.size() && text_[position_] >= '0' &&
          text_[position_] <= '9') {
        Fail("leading zero in number");
      }
    } else {
      if (text_[position_] < '1' || text_[position_] > '9') {
        Fail("invalid number");
      }
      while (position_ < text_.size() && text_[position_] >= '0' &&
             text_[position_] <= '9') {
        ++position_;
      }
    }
    if (position_ < text_.size() &&
        (text_[position_] == '.' || text_[position_] == 'e' ||
         text_[position_] == 'E')) {
      Fail("only integer JSON numbers are supported by protocol v1");
    }

    std::int64_t value = 0;
    const char *begin = text_.data() + start;
    const char *end = text_.data() + position_;
    const auto [parsed_end, error] = std::from_chars(begin, end, value);
    if (error != std::errc() || parsed_end != end) {
      Fail("integer is outside protocol range");
    }
    return JsonValue::Number(value);
  }

  std::string_view text_;
  std::size_t position_ = 0;
};

[[nodiscard]] const JsonValue &RequireField(const JsonValue &object,
                                            std::string_view name) {
  if (object.kind != JsonValue::Kind::kObject) {
    throw std::runtime_error("expected JSON object");
  }
  for (const auto &field : object.object_value) {
    if (field.first == name) {
      return field.second;
    }
  }
  throw std::runtime_error("missing required field: " + std::string(name));
}

[[nodiscard]] const std::string &RequireString(const JsonValue &value,
                                               std::string_view field_name) {
  if (value.kind != JsonValue::Kind::kString) {
    throw std::runtime_error("field must be a string: " +
                             std::string(field_name));
  }
  return value.string_value;
}

[[nodiscard]] int RequireInteger(const JsonValue &value,
                                 std::string_view field_name) {
  if (value.kind != JsonValue::Kind::kNumber ||
      value.number_value < std::numeric_limits<int>::min() ||
      value.number_value > std::numeric_limits<int>::max()) {
    throw std::runtime_error("field must be a 32-bit integer: " +
                             std::string(field_name));
  }
  return static_cast<int>(value.number_value);
}

[[nodiscard]] const std::vector<JsonValue> &
RequireArray(const JsonValue &value, std::string_view field_name) {
  if (value.kind != JsonValue::Kind::kArray) {
    throw std::runtime_error("field must be an array: " +
                             std::string(field_name));
  }
  return value.array_value;
}

void AppendJsonString(std::string &json, std::string_view value) {
  constexpr char kHexDigits[] = "0123456789abcdef";
  json.push_back('"');
  for (const unsigned char character : value) {
    switch (character) {
    case '"':
      json += "\\\"";
      break;
    case '\\':
      json += "\\\\";
      break;
    case '\b':
      json += "\\b";
      break;
    case '\f':
      json += "\\f";
      break;
    case '\n':
      json += "\\n";
      break;
    case '\r':
      json += "\\r";
      break;
    case '\t':
      json += "\\t";
      break;
    default:
      if (character < 0x20U) {
        json += "\\u00";
        json.push_back(kHexDigits[(character >> 4U) & 0x0FU]);
        json.push_back(kHexDigits[character & 0x0FU]);
      } else {
        json.push_back(static_cast<char>(character));
      }
    }
  }
  json.push_back('"');
}

[[nodiscard]] std::size_t BoardIndex(const State &state, Coord coord) {
  return static_cast<std::size_t>(coord.row) *
             static_cast<std::size_t>(state.cols) +
         static_cast<std::size_t>(coord.col);
}

[[nodiscard]] bool IsBoardCoordInBounds(const State &state, Coord coord) {
  return coord.row >= 0 && coord.col >= 0 && coord.row < state.rows &&
         coord.col < state.cols;
}

[[nodiscard]] BoardCell *BoardCellAt(State &state, Coord coord) {
  if (!IsBoardCoordInBounds(state, coord)) {
    return nullptr;
  }
  std::optional<BoardCell> &cell = state.board_cells[BoardIndex(state, coord)];
  return cell ? &*cell : nullptr;
}

[[nodiscard]] const BoardCell *BoardCellAt(const State &state, Coord coord) {
  if (!IsBoardCoordInBounds(state, coord)) {
    return nullptr;
  }
  const std::optional<BoardCell> &cell =
      state.board_cells[BoardIndex(state, coord)];
  return cell ? &*cell : nullptr;
}

[[nodiscard]] const Gem *GemForId(const State &state,
                                  const std::string &gem_id) {
  const auto found = state.gems.find(gem_id);
  return found == state.gems.end() ? nullptr : &found->second;
}

[[nodiscard]] bool IsLocked(const State &state, const BoardCell &cell) {
  return cell.gem_id.has_value() && GemForId(state, *cell.gem_id) != nullptr &&
         GemForId(state, *cell.gem_id)->color == cell.target_color;
}

[[nodiscard]] bool IsWon(const State &state) {
  if (state.selection.has_value() || !state.shelf_gem_ids.empty()) {
    return false;
  }
  for (const std::optional<BoardCell> &maybe_cell : state.board_cells) {
    if (!maybe_cell.has_value() || !maybe_cell->gem_id.has_value()) {
      if (maybe_cell.has_value()) {
        return false;
      }
      continue;
    }
    const Gem *gem = GemForId(state, *maybe_cell->gem_id);
    if (gem == nullptr || gem->color != maybe_cell->target_color) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] std::vector<std::vector<GemCell>>
BuildBoardGrid(const State &state,
               bool (*eligible)(const State &, const BoardCell &)) {
  std::vector<std::vector<GemCell>> grid(
      static_cast<std::size_t>(state.rows),
      std::vector<GemCell>(static_cast<std::size_t>(state.cols), {-1, false}));
  for (int row = 0; row < state.rows; ++row) {
    for (int col = 0; col < state.cols; ++col) {
      const BoardCell *cell = BoardCellAt(state, {row, col});
      if (cell == nullptr || !eligible(state, *cell)) {
        continue;
      }
      const Gem *gem =
          cell->gem_id.has_value() ? GemForId(state, *cell->gem_id) : nullptr;
      const Color color = gem == nullptr ? cell->target_color : gem->color;
      grid[static_cast<std::size_t>(row)][static_cast<std::size_t>(col)] = {
          static_cast<int>(color),
          true,
      };
    }
  }
  return grid;
}

[[nodiscard]] bool IsMovableBoardGem(const State &state,
                                     const BoardCell &cell) {
  return cell.gem_id.has_value() && !IsLocked(state, cell);
}

[[nodiscard]] bool IsEmptyTarget(const State &, const BoardCell &cell) {
  return !cell.gem_id.has_value();
}

[[nodiscard]] std::vector<Location>
FindBoardMovableComponent(const State &state, Coord start) {
  const std::vector<std::vector<GemCell>> grid =
      BuildBoardGrid(state, IsMovableBoardGem);
  const std::vector<Position> positions =
      FindConnectedMovableGems(grid, start.row, start.col);
  std::vector<Location> component;
  component.reserve(positions.size());
  for (const Position &position : positions) {
    const BoardCell *cell =
        BoardCellAt(state, {position.first, position.second});
    if (cell != nullptr && cell->gem_id.has_value()) {
      component.push_back({*cell->gem_id, {position.first, position.second}});
    }
  }
  return component;
}

[[nodiscard]] std::vector<Location>
FindShelfMovableComponent(const State &state, int start_index) {
  if (start_index < 0 ||
      start_index >= static_cast<int>(state.shelf_gem_ids.size())) {
    return {};
  }
  std::vector<std::vector<GemCell>> grid(
      1U, std::vector<GemCell>(static_cast<std::size_t>(state.shelf_capacity),
                               {-1, false}));
  for (std::size_t index = 0; index < state.shelf_gem_ids.size(); ++index) {
    const Gem *gem = GemForId(state, state.shelf_gem_ids[index]);
    if (gem == nullptr) {
      continue;
    }
    grid[0][index] = {static_cast<int>(gem->color), true};
  }

  const Coord start = {0, start_index};
  const std::vector<Position> positions =
      FindConnectedMovableGems(grid, start.row, start.col);
  std::vector<Location> component;
  component.reserve(positions.size());
  for (const Position &position : positions) {
    const std::size_t index = static_cast<std::size_t>(position.second);
    if (index < state.shelf_gem_ids.size()) {
      component.push_back(
          {state.shelf_gem_ids[index], {position.first, position.second}});
    }
  }
  return component;
}

[[nodiscard]] std::vector<Coord>
FindEmptyTargetComponent(const State &state, Coord start, Color color) {
  const BoardCell *start_cell = BoardCellAt(state, start);
  if (start_cell == nullptr || start_cell->gem_id.has_value() ||
      start_cell->target_color != color) {
    return {};
  }
  const std::vector<std::vector<GemCell>> grid =
      BuildBoardGrid(state, IsEmptyTarget);
  const std::vector<Position> positions =
      FindConnectedMovableGems(grid, start.row, start.col);
  std::vector<Coord> targets;
  targets.reserve(positions.size());
  for (const Position &position : positions) {
    targets.push_back({position.first, position.second});
  }
  std::sort(targets.begin(), targets.end(), [start](Coord left, Coord right) {
    return CompareByAnchor(start, left, right) < 0;
  });
  return targets;
}

[[nodiscard]] std::vector<Location>
GetSelectionLocations(const State &state, const Selection &selection) {
  std::map<std::string, Coord> positions_by_gem_id;
  if (selection.container == SelectionContainer::kBoard) {
    for (int row = 0; row < state.rows; ++row) {
      for (int col = 0; col < state.cols; ++col) {
        const BoardCell *cell = BoardCellAt(state, {row, col});
        if (cell != nullptr && cell->gem_id.has_value()) {
          positions_by_gem_id.emplace(*cell->gem_id, Coord{row, col});
        }
      }
    }
  } else {
    for (std::size_t index = 0; index < state.shelf_gem_ids.size(); ++index) {
      positions_by_gem_id.emplace(state.shelf_gem_ids[index],
                                  Coord{0, static_cast<int>(index)});
    }
  }

  std::vector<Location> locations;
  locations.reserve(selection.gem_ids.size());
  for (const std::string &gem_id : selection.gem_ids) {
    const auto found = positions_by_gem_id.find(gem_id);
    if (found == positions_by_gem_id.end()) {
      return {};
    }
    locations.push_back({gem_id, found->second});
  }
  return locations;
}

[[nodiscard]] bool
CoordinatesAreConnected(const State &state, SelectionContainer container,
                        const std::vector<Coord> &coordinates) {
  if (coordinates.size() < 2U) {
    return true;
  }
  const int rows = container == SelectionContainer::kBoard ? state.rows : 1;
  const int cols = container == SelectionContainer::kBoard
                       ? state.cols
                       : state.shelf_capacity;
  std::vector<std::vector<GemCell>> grid(
      static_cast<std::size_t>(rows),
      std::vector<GemCell>(static_cast<std::size_t>(cols), {-1, false}));
  for (const Coord coord : coordinates) {
    if (coord.row < 0 || coord.col < 0 || coord.row >= rows ||
        coord.col >= cols) {
      return false;
    }
    grid[static_cast<std::size_t>(coord.row)]
        [static_cast<std::size_t>(coord.col)] = {0, true};
  }
  return FindConnectedMovableGems(grid, coordinates.front().row,
                                  coordinates.front().col)
             .size() == coordinates.size();
}

[[nodiscard]] std::vector<Location>
GetExtractionCandidates(const State &state, const Selection &selection) {
  const std::vector<Location> locations =
      GetSelectionLocations(state, selection);
  if (locations.size() != selection.gem_ids.size()) {
    return {};
  }

  std::set<std::string> selected_coordinates;
  for (const Location &location : locations) {
    selected_coordinates.emplace(CoordKey(location.coord));
  }

  std::vector<Location> candidates;
  for (const Location &location : locations) {
    bool is_frontier = false;
    for (const Position &offset : kNeighborOffsets) {
      const Coord neighbor = {
          location.coord.row + offset.first,
          location.coord.col + offset.second,
      };
      if (!selected_coordinates.contains(CoordKey(neighbor))) {
        is_frontier = true;
        break;
      }
    }
    if (!is_frontier) {
      continue;
    }

    std::vector<Coord> remaining;
    remaining.reserve(locations.size() - 1U);
    for (const Location &member : locations) {
      if (member.gem_id != location.gem_id) {
        remaining.push_back(member.coord);
      }
    }
    if (CoordinatesAreConnected(state, selection.container, remaining)) {
      candidates.push_back(location);
    }
  }

  std::sort(candidates.begin(), candidates.end(),
            [&selection](const Location &left, const Location &right) {
              return CompareByAnchor(selection.anchor, left.coord,
                                     right.coord) < 0;
            });
  return candidates;
}

[[nodiscard]] bool ShelfCandidateRemainsConnectedAfterCompaction(
    const State &state, const Selection &selection, const Location &candidate) {
  const std::size_t source_index =
      static_cast<std::size_t>(candidate.coord.col);
  if (source_index >= state.shelf_gem_ids.size() ||
      state.shelf_gem_ids[source_index] != candidate.gem_id) {
    return false;
  }

  std::vector<std::string> compacted = state.shelf_gem_ids;
  compacted.erase(compacted.begin() +
                  static_cast<std::ptrdiff_t>(source_index));
  std::vector<std::string> remaining_gem_ids;
  for (const std::string &gem_id : selection.gem_ids) {
    if (gem_id != candidate.gem_id) {
      remaining_gem_ids.push_back(gem_id);
    }
  }
  if (remaining_gem_ids.size() < 2U) {
    return true;
  }

  std::map<std::string, std::size_t> indices_by_gem_id;
  for (std::size_t index = 0; index < compacted.size(); ++index) {
    indices_by_gem_id.emplace(compacted[index], index);
  }
  std::vector<Coord> remaining_coordinates;
  remaining_coordinates.reserve(remaining_gem_ids.size());
  for (const std::string &gem_id : remaining_gem_ids) {
    const auto found = indices_by_gem_id.find(gem_id);
    if (found == indices_by_gem_id.end()) {
      return false;
    }
    remaining_coordinates.push_back({0, static_cast<int>(found->second)});
  }
  return CoordinatesAreConnected(state, SelectionContainer::kShelf,
                                 remaining_coordinates);
}

[[nodiscard]] std::optional<Location>
NextExtractionCandidate(const State &state, const Selection &selection) {
  const std::vector<Location> candidates =
      GetExtractionCandidates(state, selection);
  if (selection.container == SelectionContainer::kBoard) {
    if (candidates.empty()) {
      return std::nullopt;
    }
    return candidates.front();
  }

  for (const Location &candidate : candidates) {
    if (ShelfCandidateRemainsConnectedAfterCompaction(state, selection,
                                                      candidate)) {
      return candidate;
    }
  }
  return std::nullopt;
}

void RemoveSelectedGem(State &state, const std::string &gem_id) {
  if (!state.selection.has_value()) {
    return;
  }
  std::vector<std::string> &selection_ids = state.selection->gem_ids;
  selection_ids.erase(
      std::remove(selection_ids.begin(), selection_ids.end(), gem_id),
      selection_ids.end());
  if (selection_ids.empty()) {
    state.selection.reset();
  }
}

void MoveSelectionGemToBoard(State &state, const Selection &selection,
                             const Location &source, Coord destination) {
  BoardCell *destination_cell = BoardCellAt(state, destination);
  if (destination_cell == nullptr) {
    throw std::runtime_error("internal error: destination does not exist");
  }
  destination_cell->gem_id = source.gem_id;

  if (selection.container == SelectionContainer::kBoard) {
    BoardCell *source_cell = BoardCellAt(state, source.coord);
    if (source_cell == nullptr) {
      throw std::runtime_error("internal error: source does not exist");
    }
    source_cell->gem_id.reset();
  } else {
    const std::size_t source_index = static_cast<std::size_t>(source.coord.col);
    state.shelf_gem_ids.erase(state.shelf_gem_ids.begin() +
                              static_cast<std::ptrdiff_t>(source_index));
  }
  RemoveSelectedGem(state, source.gem_id);
}

void MoveSelectionGemToShelf(State &state, const Selection &selection,
                             const Location &source) {
  if (selection.container != SelectionContainer::kBoard) {
    throw std::runtime_error("internal error: Shelf move source must be Board");
  }
  BoardCell *source_cell = BoardCellAt(state, source.coord);
  if (source_cell == nullptr) {
    throw std::runtime_error("internal error: source does not exist");
  }
  source_cell->gem_id.reset();
  state.shelf_gem_ids.push_back(source.gem_id);
  RemoveSelectedGem(state, source.gem_id);
}

[[nodiscard]] Transition Reject(std::string_view code,
                                std::string_view detail) {
  Transition result;
  result.rejection = Rejection{std::string(code), std::string(detail)};
  return result;
}

[[nodiscard]] Transition ResolveStatus(State &state, Transition transition) {
  const bool was_won = state.won;
  state.won = IsWon(state);
  if (!was_won && state.won) {
    transition.events.push_back({"won", std::nullopt});
  }
  return transition;
}

[[nodiscard]] Transition SelectBoardGem(State &state, Coord coord) {
  const BoardCell *cell = BoardCellAt(state, coord);
  if (cell == nullptr || !cell->gem_id.has_value()) {
    return Reject("no-selectable-gem",
                  "The Board coordinate has no movable gem");
  }
  const Gem *gem = GemForId(state, *cell->gem_id);
  if (gem == nullptr) {
    return Reject("no-selectable-gem",
                  "The Board gem is not present in this state");
  }
  if (gem->color == cell->target_color) {
    return Reject("locked-gem", "A gem matching its Board target is locked");
  }

  const std::vector<Location> component =
      FindBoardMovableComponent(state, coord);
  if (component.empty()) {
    return Reject("no-selectable-gem",
                  "The Board coordinate has no movable component");
  }
  Selection selection;
  selection.container = SelectionContainer::kBoard;
  selection.anchor = coord;
  selection.color = gem->color;
  selection.gem_ids.reserve(component.size());
  for (const Location &member : component) {
    selection.gem_ids.push_back(member.gem_id);
  }
  state.selection = std::move(selection);
  return Transition{{{"selection-changed", std::string("board")}},
                    std::nullopt};
}

[[nodiscard]] Transition SelectShelfGem(State &state, int index) {
  const std::vector<Location> component =
      FindShelfMovableComponent(state, index);
  if (component.empty()) {
    return Reject("no-selectable-gem", "The Shelf index has no movable gem");
  }
  const Gem *gem = GemForId(state, component.front().gem_id);
  if (gem == nullptr) {
    return Reject("no-selectable-gem",
                  "The Shelf gem is not present in this state");
  }

  Selection selection;
  selection.container = SelectionContainer::kShelf;
  selection.anchor = {0, index};
  selection.color = gem->color;
  selection.gem_ids.reserve(component.size());
  for (const Location &member : component) {
    selection.gem_ids.push_back(member.gem_id);
  }
  state.selection = std::move(selection);
  return Transition{{{"selection-changed", std::string("shelf")}},
                    std::nullopt};
}

[[nodiscard]] Transition PlaceSelectionAtTarget(State &state, Coord coord) {
  if (!state.selection.has_value() || state.selection->gem_ids.empty()) {
    return Reject("no-selection", "Select a component before placing it");
  }
  const BoardCell *target_cell = BoardCellAt(state, coord);
  if (target_cell == nullptr) {
    return Reject("invalid-target",
                  "The target coordinate is not an active Board cell");
  }
  if (target_cell->gem_id.has_value()) {
    return Reject("target-is-occupied",
                  "The target Board cell already contains a gem");
  }
  if (target_cell->target_color != state.selection->color) {
    return Reject("target-color-mismatch",
                  "The target color does not match the selection color");
  }

  const std::vector<Coord> targets =
      FindEmptyTargetComponent(state, coord, state.selection->color);
  Transition transition;
  for (const Coord destination : targets) {
    if (!state.selection.has_value()) {
      break;
    }
    const Selection current_selection = *state.selection;
    const std::optional<Location> source =
        NextExtractionCandidate(state, current_selection);
    if (!source.has_value()) {
      break;
    }
    MoveSelectionGemToBoard(state, current_selection, *source, destination);
    transition.events.push_back({
        "gem-placed",
        source->gem_id + "->" + std::to_string(destination.row) + ":" +
            std::to_string(destination.col),
    });
    if (current_selection.container == SelectionContainer::kShelf) {
      transition.events.push_back({"shelf-compacted", source->gem_id});
    }
  }
  return ResolveStatus(state, std::move(transition));
}

[[nodiscard]] Transition PlaceSelectionInShelf(State &state) {
  if (!state.selection.has_value() || state.selection->gem_ids.empty()) {
    return Reject("no-selection",
                  "Select a Board component before moving it to the Shelf");
  }
  if (state.selection->container != SelectionContainer::kBoard) {
    return Reject("selection-must-come-from-board",
                  "Only a Board selection can be placed into the Shelf");
  }

  const int available_slots =
      state.shelf_capacity - static_cast<int>(state.shelf_gem_ids.size());
  if (available_slots <= 0) {
    return Reject("shelf-full", "The Shelf has no free slots");
  }

  Transition transition;
  for (int moved = 0; moved < available_slots; ++moved) {
    if (!state.selection.has_value()) {
      break;
    }
    const Selection current_selection = *state.selection;
    const std::optional<Location> source =
        NextExtractionCandidate(state, current_selection);
    if (!source.has_value()) {
      break;
    }
    MoveSelectionGemToShelf(state, current_selection, *source);
    transition.events.push_back({"gem-placed", source->gem_id + "->shelf"});
  }
  return ResolveStatus(state, std::move(transition));
}

enum class CommandType {
  kSelectBoardGem,
  kSelectShelfGem,
  kCancelSelection,
  kPlaceSelectionAtTarget,
  kPlaceSelectionInShelf,
  kRestartLevel,
};

struct Command {
  CommandType type = CommandType::kCancelSelection;
  Coord coord;
  int index = 0;
};

[[nodiscard]] Coord ParseCoord(const JsonValue &object,
                               std::string_view field_name) {
  const JsonValue &coord = RequireField(object, field_name);
  return {
      RequireInteger(RequireField(coord, "row"), "row"),
      RequireInteger(RequireField(coord, "col"), "col"),
  };
}

[[nodiscard]] Command ParseCommand(std::string_view command_json) {
  const JsonValue root = JsonParser(command_json).Parse();
  const std::string &type = RequireString(RequireField(root, "type"), "type");
  if (type == "select-board-gem") {
    return {CommandType::kSelectBoardGem, ParseCoord(root, "coord"), 0};
  }
  if (type == "select-shelf-gem") {
    return {
        CommandType::kSelectShelfGem,
        {},
        RequireInteger(RequireField(root, "index"), "index"),
    };
  }
  if (type == "cancel-selection") {
    return {CommandType::kCancelSelection, {}, 0};
  }
  if (type == "place-selection-at-target") {
    return {CommandType::kPlaceSelectionAtTarget, ParseCoord(root, "coord"), 0};
  }
  if (type == "place-selection-in-shelf") {
    return {CommandType::kPlaceSelectionInShelf, {}, 0};
  }
  if (type == "restart-level") {
    return {CommandType::kRestartLevel, {}, 0};
  }
  throw std::runtime_error("unsupported command type: " + type);
}

[[nodiscard]] Transition ApplyCommand(State &state, const State &initial_state,
                                      const Command &command) {
  if (command.type == CommandType::kRestartLevel) {
    state = initial_state;
    return {};
  }
  if (state.won) {
    return Reject("game-won",
                  "Restart the level before issuing another command");
  }

  switch (command.type) {
  case CommandType::kSelectBoardGem:
    return SelectBoardGem(state, command.coord);
  case CommandType::kSelectShelfGem:
    return SelectShelfGem(state, command.index);
  case CommandType::kCancelSelection:
    if (!state.selection.has_value()) {
      return Reject("no-selection", "There is no active selection to cancel");
    }
    state.selection.reset();
    return ResolveStatus(
        state, Transition{{{"selection-cleared", std::nullopt}}, std::nullopt});
  case CommandType::kPlaceSelectionAtTarget:
    return PlaceSelectionAtTarget(state, command.coord);
  case CommandType::kPlaceSelectionInShelf:
    return PlaceSelectionInShelf(state);
  case CommandType::kRestartLevel:
    break;
  }

  throw std::runtime_error("internal error: unknown command");
}

[[nodiscard]] State ParseLevel(std::string_view level_json) {
  const JsonValue root = JsonParser(level_json).Parse();
  if (RequireInteger(RequireField(root, "schemaVersion"), "schemaVersion") !=
      kSchemaVersion) {
    throw std::runtime_error("Unsupported schema version");
  }

  State state;
  state.level_id = RequireString(RequireField(root, "id"), "id");
  state.rows = RequireInteger(RequireField(root, "rows"), "rows");
  state.cols = RequireInteger(RequireField(root, "cols"), "cols");
  state.shelf_capacity =
      RequireInteger(RequireField(root, "shelfCapacity"), "shelfCapacity");
  if (state.rows <= 0 || state.cols <= 0) {
    throw std::runtime_error("Level dimensions must be positive");
  }
  if (state.shelf_capacity <= 0) {
    throw std::runtime_error("Shelf capacity must be positive");
  }
  if (static_cast<std::size_t>(state.rows) >
      std::numeric_limits<std::size_t>::max() /
          static_cast<std::size_t>(state.cols)) {
    throw std::runtime_error("Level dimensions are too large");
  }
  state.board_cells.resize(static_cast<std::size_t>(state.rows) *
                           static_cast<std::size_t>(state.cols));

  std::array<int, static_cast<std::size_t>(Color::kCount)> gem_color_counts{};
  std::array<int, static_cast<std::size_t>(Color::kCount)>
      target_color_counts{};
  const std::vector<JsonValue> &cells =
      RequireArray(RequireField(root, "cells"), "cells");
  for (const JsonValue &cell_json : cells) {
    const int row = RequireInteger(RequireField(cell_json, "row"), "row");
    const int col = RequireInteger(RequireField(cell_json, "col"), "col");
    if (row < 0 || col < 0 || row >= state.rows || col >= state.cols) {
      throw std::runtime_error("Cell " + std::to_string(row) + ":" +
                               std::to_string(col) +
                               " is outside board bounds");
    }
    const std::string &target_color_name =
        RequireString(RequireField(cell_json, "targetColor"), "targetColor");
    const std::optional<Color> target_color = ColorFromName(target_color_name);
    if (!target_color.has_value()) {
      throw std::runtime_error("Unknown target color: " + target_color_name);
    }

    const JsonValue &gem_json = RequireField(cell_json, "gem");
    const std::string &gem_id =
        RequireString(RequireField(gem_json, "id"), "gem.id");
    const std::string &gem_color_name =
        RequireString(RequireField(gem_json, "color"), "gem.color");
    const std::optional<Color> gem_color = ColorFromName(gem_color_name);
    if (!gem_color.has_value()) {
      throw std::runtime_error("Unknown gem color: " + gem_color_name);
    }

    const Coord coord = {row, col};
    const std::size_t index = BoardIndex(state, coord);
    if (state.board_cells[index].has_value()) {
      throw std::runtime_error("Duplicate board cell at " + CoordKey(coord));
    }
    if (state.gems.contains(gem_id)) {
      throw std::runtime_error("Duplicate gem id: " + gem_id);
    }
    state.board_cells[index] = BoardCell{*target_color, gem_id};
    state.gems.emplace(gem_id, Gem{gem_id, *gem_color});
    ++target_color_counts[static_cast<std::size_t>(*target_color)];
    ++gem_color_counts[static_cast<std::size_t>(*gem_color)];
  }

  for (std::size_t color = 0; color < gem_color_counts.size(); ++color) {
    if (gem_color_counts[color] != target_color_counts[color]) {
      throw std::runtime_error("Color conservation failed");
    }
  }
  state.won = IsWon(state);
  return state;
}

[[nodiscard]] std::string StateJson(const State &state) {
  std::string json = "{\"schemaVersion\":1,\"levelId\":";
  AppendJsonString(json, state.level_id);
  json += ",\"board\":{\"rows\":" + std::to_string(state.rows) +
          ",\"cols\":" + std::to_string(state.cols) + ",\"cells\":{";
  bool first_cell = true;
  for (int row = 0; row < state.rows; ++row) {
    for (int col = 0; col < state.cols; ++col) {
      const BoardCell *cell = BoardCellAt(state, {row, col});
      if (cell == nullptr) {
        continue;
      }
      if (!first_cell) {
        json.push_back(',');
      }
      first_cell = false;
      AppendJsonString(json, CoordKey({row, col}));
      json += ":{\"targetColor\":";
      AppendJsonString(json, ColorName(cell->target_color));
      json += ",\"gemId\":";
      if (cell->gem_id.has_value()) {
        AppendJsonString(json, *cell->gem_id);
      } else {
        json += "null";
      }
      json.push_back('}');
    }
  }
  json += "}},\"gems\":{";
  bool first_gem = true;
  for (const auto &[gem_id, gem] : state.gems) {
    if (!first_gem) {
      json.push_back(',');
    }
    first_gem = false;
    AppendJsonString(json, gem_id);
    json += ":{\"id\":";
    AppendJsonString(json, gem.id);
    json += ",\"color\":";
    AppendJsonString(json, ColorName(gem.color));
    json += "}";
  }
  json += "},\"shelf\":{\"width\":" + std::to_string(state.shelf_capacity) +
          ",\"capacity\":" + std::to_string(state.shelf_capacity) +
          ",\"gemIds\":[";
  for (std::size_t index = 0; index < state.shelf_gem_ids.size(); ++index) {
    if (index != 0U) {
      json.push_back(',');
    }
    AppendJsonString(json, state.shelf_gem_ids[index]);
  }
  json += "]},\"selection\":";
  if (!state.selection.has_value()) {
    json += "null";
  } else {
    const Selection &selection = *state.selection;
    json += "{\"container\":";
    AppendJsonString(json, selection.container == SelectionContainer::kBoard
                               ? "board"
                               : "shelf");
    json += ",\"anchor\":{\"row\":" + std::to_string(selection.anchor.row) +
            ",\"col\":" + std::to_string(selection.anchor.col) + "},\"color\":";
    AppendJsonString(json, ColorName(selection.color));
    json += ",\"gemIds\":[";
    for (std::size_t index = 0; index < selection.gem_ids.size(); ++index) {
      if (index != 0U) {
        json.push_back(',');
      }
      AppendJsonString(json, selection.gem_ids[index]);
    }
    json += "]}";
  }
  json += ",\"status\":";
  AppendJsonString(json, state.won ? "won" : "playing");
  json.push_back('}');
  return json;
}

[[nodiscard]] std::string CanonicalStateDump(const State &state) {
  std::string json = "{\"schemaVersion\":1,\"levelId\":";
  AppendJsonString(json, state.level_id);
  json += ",\"board\":{\"rows\":" + std::to_string(state.rows) +
          ",\"cols\":" + std::to_string(state.cols) + ",\"cells\":[";
  bool first_cell = true;
  for (int row = 0; row < state.rows; ++row) {
    for (int col = 0; col < state.cols; ++col) {
      const BoardCell *cell = BoardCellAt(state, {row, col});
      if (cell == nullptr) {
        continue;
      }
      if (!first_cell) {
        json.push_back(',');
      }
      first_cell = false;
      json += "{\"row\":" + std::to_string(row) +
              ",\"col\":" + std::to_string(col) + ",\"targetColor\":";
      AppendJsonString(json, ColorName(cell->target_color));
      json += ",\"gemId\":";
      if (cell->gem_id.has_value()) {
        AppendJsonString(json, *cell->gem_id);
      } else {
        json += "null";
      }
      json.push_back('}');
    }
  }
  json += "]},\"gems\":[";
  bool first_gem = true;
  for (const auto &[gem_id, gem] : state.gems) {
    if (!first_gem) {
      json.push_back(',');
    }
    first_gem = false;
    json += "{\"id\":";
    AppendJsonString(json, gem.id);
    json += ",\"color\":";
    AppendJsonString(json, ColorName(gem.color));
    json.push_back('}');
  }
  json += "],\"shelf\":{\"width\":" + std::to_string(state.shelf_capacity) +
          ",\"capacity\":" + std::to_string(state.shelf_capacity) +
          ",\"gemIds\":[";
  for (std::size_t index = 0; index < state.shelf_gem_ids.size(); ++index) {
    if (index != 0U) {
      json.push_back(',');
    }
    AppendJsonString(json, state.shelf_gem_ids[index]);
  }
  json += "]},\"selection\":";
  if (!state.selection.has_value()) {
    json += "null";
  } else {
    const Selection &selection = *state.selection;
    std::vector<std::string> sorted_ids = selection.gem_ids;
    std::sort(sorted_ids.begin(), sorted_ids.end());
    json += "{\"container\":";
    AppendJsonString(json, selection.container == SelectionContainer::kBoard
                               ? "board"
                               : "shelf");
    json += ",\"anchor\":{\"row\":" + std::to_string(selection.anchor.row) +
            ",\"col\":" + std::to_string(selection.anchor.col) + "},\"color\":";
    AppendJsonString(json, ColorName(selection.color));
    json += ",\"gemIds\":[";
    for (std::size_t index = 0; index < sorted_ids.size(); ++index) {
      if (index != 0U) {
        json.push_back(',');
      }
      AppendJsonString(json, sorted_ids[index]);
    }
    json += "]}";
  }
  json += ",\"status\":";
  AppendJsonString(json, state.won ? "won" : "playing");
  json.push_back('}');
  return json;
}

[[nodiscard]] std::string TransitionJson(const State &state,
                                         const Transition &transition) {
  std::string json =
      "{\"schemaVersion\":1,\"state\":" + StateJson(state) + ",\"events\":[";
  for (std::size_t index = 0; index < transition.events.size(); ++index) {
    if (index != 0U) {
      json.push_back(',');
    }
    const GameEvent &event = transition.events[index];
    json += "{\"type\":";
    AppendJsonString(json, event.type);
    if (event.detail.has_value()) {
      json += ",\"detail\":";
      AppendJsonString(json, *event.detail);
    }
    json.push_back('}');
  }
  json += "],\"rejection\":";
  if (!transition.rejection.has_value()) {
    json += "null";
  } else {
    json += "{\"code\":";
    AppendJsonString(json, transition.rejection->code);
    json += ",\"detail\":";
    AppendJsonString(json, transition.rejection->detail);
    json.push_back('}');
  }
  json += ",\"canonicalDump\":";
  AppendJsonString(json, CanonicalStateDump(state));
  json.push_back('}');
  return json;
}

} // namespace

class BrilliantSortCore::Impl {
public:
  State state;
  State initial_state;
};

BrilliantSortCore::BrilliantSortCore(std::unique_ptr<Impl> impl)
    : impl_(std::move(impl)) {}

BrilliantSortCore::~BrilliantSortCore() = default;

BrilliantSortCore::BrilliantSortCore(BrilliantSortCore &&) noexcept = default;

BrilliantSortCore &
BrilliantSortCore::operator=(BrilliantSortCore &&) noexcept = default;

std::unique_ptr<BrilliantSortCore>
BrilliantSortCore::Create(std::string_view level_json,
                          std::string *error_detail) {
  try {
    auto impl = std::make_unique<Impl>();
    impl->state = ParseLevel(level_json);
    impl->initial_state = impl->state;
    return std::unique_ptr<BrilliantSortCore>(
        new BrilliantSortCore(std::move(impl)));
  } catch (const std::exception &error) {
    if (error_detail != nullptr) {
      *error_detail = error.what();
    }
    return nullptr;
  }
}

std::string BrilliantSortCore::InitialTransitionJson() const {
  return TransitionJson(impl_->state, {});
}

CoreDispatchResult
BrilliantSortCore::DispatchJson(std::string_view command_json) {
  try {
    const Command command = ParseCommand(command_json);
    const Transition transition =
        ApplyCommand(impl_->state, impl_->initial_state, command);
    return {TransitionJson(impl_->state, transition), false};
  } catch (const std::exception &error) {
    return {MakeCoreProtocolError("invalid-command", error.what()), true};
  }
}

std::string BrilliantSortCore::CanonicalDump() const {
  return CanonicalStateDump(impl_->state);
}

std::string MakeCoreProtocolError(std::string_view code,
                                  std::string_view detail) {
  std::string json = "{\"schemaVersion\":1,\"error\":{\"code\":";
  AppendJsonString(json, code);
  json += ",\"detail\":";
  AppendJsonString(json, detail);
  json += "}}";
  return json;
}

namespace {

struct CoreSession {
  std::unique_ptr<BrilliantSortCore> core;
  std::string last_result;
};

[[nodiscard]] CoreSession *SessionFromHandle(std::uintptr_t handle) {
  return reinterpret_cast<CoreSession *>(handle);
}

constexpr int kCoreStatusOk = 0;
constexpr int kCoreStatusInvalidHandle = 1;
constexpr int kCoreStatusProtocolError = 2;

} // namespace

extern "C" std::uintptr_t bs_core_create(const char *level_json_bytes,
                                         std::size_t length) {
  try {
    auto session = std::make_unique<CoreSession>();
    if (level_json_bytes == nullptr && length != 0U) {
      session->last_result = MakeCoreProtocolError(
          "invalid-level", "level JSON bytes are null with a non-zero length");
    } else {
      const std::string_view level_json(
          level_json_bytes == nullptr ? "" : level_json_bytes, length);
      std::string error_detail;
      session->core = BrilliantSortCore::Create(level_json, &error_detail);
      session->last_result =
          session->core != nullptr
              ? session->core->InitialTransitionJson()
              : MakeCoreProtocolError("invalid-level", error_detail);
    }
    return reinterpret_cast<std::uintptr_t>(session.release());
  } catch (const std::exception &error) {
    (void)error;
    return 0U;
  }
}

extern "C" int bs_core_dispatch(std::uintptr_t session_handle,
                                const char *command_json_bytes,
                                std::size_t length) {
  CoreSession *session = SessionFromHandle(session_handle);
  if (session == nullptr) {
    return kCoreStatusInvalidHandle;
  }
  if (session->core == nullptr) {
    session->last_result = MakeCoreProtocolError(
        "invalid-session", "level loading did not succeed");
    return kCoreStatusProtocolError;
  }
  if (command_json_bytes == nullptr && length != 0U) {
    session->last_result = MakeCoreProtocolError(
        "invalid-command",
        "command JSON bytes are null with a non-zero length");
    return kCoreStatusProtocolError;
  }
  const std::string_view command_json(
      command_json_bytes == nullptr ? "" : command_json_bytes, length);
  const CoreDispatchResult result = session->core->DispatchJson(command_json);
  session->last_result = result.json;
  return result.protocol_error ? kCoreStatusProtocolError : kCoreStatusOk;
}

extern "C" std::size_t bs_core_result_length(std::uintptr_t session_handle) {
  const CoreSession *session = SessionFromHandle(session_handle);
  return session == nullptr ? 0U : session->last_result.size();
}

extern "C" std::size_t bs_core_copy_result(std::uintptr_t session_handle,
                                           char *output_bytes,
                                           std::size_t capacity) {
  const CoreSession *session = SessionFromHandle(session_handle);
  if (session == nullptr || output_bytes == nullptr ||
      capacity < session->last_result.size()) {
    return 0U;
  }
  std::memcpy(output_bytes, session->last_result.data(),
              session->last_result.size());
  return session->last_result.size();
}

extern "C" void bs_core_destroy(std::uintptr_t session_handle) {
  delete SessionFromHandle(session_handle);
}
