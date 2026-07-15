#ifndef BRILLIANT_SORT_GAME_CORE_HPP
#define BRILLIANT_SORT_GAME_CORE_HPP

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>

struct CoreDispatchResult {
    std::string json;
    bool protocol_error = false;
};

class BrilliantSortCore {
public:
    static std::unique_ptr<BrilliantSortCore> Create(
        std::string_view level_json,
        std::string* error_detail);

    ~BrilliantSortCore();
    BrilliantSortCore(BrilliantSortCore&&) noexcept;
    BrilliantSortCore& operator=(BrilliantSortCore&&) noexcept;
    BrilliantSortCore(const BrilliantSortCore&) = delete;
    BrilliantSortCore& operator=(const BrilliantSortCore&) = delete;

    [[nodiscard]] std::string InitialTransitionJson() const;
    [[nodiscard]] CoreDispatchResult DispatchJson(std::string_view command_json);
    [[nodiscard]] std::string CanonicalDump() const;

private:
    class Impl;

    explicit BrilliantSortCore(std::unique_ptr<Impl> impl);

    std::unique_ptr<Impl> impl_;
};

[[nodiscard]] std::string MakeCoreProtocolError(
    std::string_view code,
    std::string_view detail);

extern "C" {
std::uintptr_t bs_core_create(const char* level_json_bytes, std::size_t length);
int bs_core_dispatch(
    std::uintptr_t session_handle,
    const char* command_json_bytes,
    std::size_t length);
std::size_t bs_core_result_length(std::uintptr_t session_handle);
std::size_t bs_core_copy_result(
    std::uintptr_t session_handle,
    char* output_bytes,
    std::size_t capacity);
void bs_core_destroy(std::uintptr_t session_handle);
}

#endif  // BRILLIANT_SORT_GAME_CORE_HPP
