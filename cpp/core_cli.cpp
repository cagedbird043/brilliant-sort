#include "game_core.hpp"

#include <fstream>
#include <iostream>
#include <memory>
#include <string>
#include <string_view>

namespace {

[[nodiscard]] std::string ReadFile(const char* path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) {
        throw std::runtime_error(std::string("cannot open level file: ") + path);
    }
    return {
        std::istreambuf_iterator<char>(input),
        std::istreambuf_iterator<char>(),
    };
}

}  // namespace

int main(int argc, char* argv[]) {
    if (argc != 3 || std::string_view(argv[1]) != "--level") {
        std::cerr << "Usage: brilliant_sort_core_cli --level <level.json>\n";
        return 64;
    }

    try {
        const std::string level_json = ReadFile(argv[2]);
        std::string error_detail;
        std::unique_ptr<BrilliantSortCore> core = BrilliantSortCore::Create(level_json, &error_detail);
        if (core == nullptr) {
            std::cout << MakeCoreProtocolError("invalid-level", error_detail) << '\n';
            return 2;
        }

        std::cout << core->InitialTransitionJson() << '\n';
        std::string command_json;
        while (std::getline(std::cin, command_json)) {
            if (command_json.empty()) {
                continue;
            }
            const CoreDispatchResult transition = core->DispatchJson(command_json);
            std::cout << transition.json << '\n';
            if (transition.protocol_error) {
                return 2;
            }
        }
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
