cmake_minimum_required(VERSION 3.24)

project(brilliant_sort_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(BRILLIANT_SORT_CORE_SOURCES
    cpp/connected_gems.cpp
    cpp/game_core.cpp
)

function(brilliant_sort_enable_warnings target)
    target_compile_options(${target} PRIVATE -Wall -Wextra -Werror -pedantic)
endfunction()

if(NOT EMSCRIPTEN)
    add_library(brilliant_sort_core STATIC ${BRILLIANT_SORT_CORE_SOURCES})
    target_include_directories(brilliant_sort_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/cpp)
    brilliant_sort_enable_warnings(brilliant_sort_core)

    add_executable(connected_gems_test cpp/connected_gems_test.cpp)
    target_link_libraries(connected_gems_test PRIVATE brilliant_sort_core)
    brilliant_sort_enable_warnings(connected_gems_test)

    add_executable(game_core_test cpp/game_core_test.cpp)
    target_link_libraries(game_core_test PRIVATE brilliant_sort_core)
    brilliant_sort_enable_warnings(game_core_test)

    add_executable(brilliant_sort_core_cli cpp/core_cli.cpp)
    target_link_libraries(brilliant_sort_core_cli PRIVATE brilliant_sort_core)
    brilliant_sort_enable_warnings(brilliant_sort_core_cli)

    include(CTest)
    if(BUILD_TESTING)
        add_test(NAME connected_gems COMMAND connected_gems_test)
        add_test(NAME game_core COMMAND game_core_test)
    endif()
endif()

if(EMSCRIPTEN)
    set(
        BRILLIANT_SORT_WASM_OUTPUT_DIR
        "${CMAKE_BINARY_DIR}/wasm"
        CACHE PATH
        "Directory for Emscripten JavaScript and WebAssembly output")

    add_executable(brilliant_sort_wasm ${BRILLIANT_SORT_CORE_SOURCES})
    target_include_directories(brilliant_sort_wasm PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/cpp)
    brilliant_sort_enable_warnings(brilliant_sort_wasm)
    target_link_options(
        brilliant_sort_wasm
        PRIVATE
            "--no-entry"
            "-sMODULARIZE=1"
            "-sEXPORT_ES6=1"
            "-sEXPORT_NAME=createBrilliantSortCoreModule"
            "-sENVIRONMENT=web,node"
            "-sALLOW_MEMORY_GROWTH=1"
            "-sFILESYSTEM=0"
            "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']"
            "-sEXPORTED_FUNCTIONS=['_malloc','_free','_bs_core_create','_bs_core_dispatch','_bs_core_result_length','_bs_core_copy_result','_bs_core_destroy']")
    set_target_properties(
        brilliant_sort_wasm
        PROPERTIES
            OUTPUT_NAME "brilliant-sort-core"
            SUFFIX ".mjs"
            RUNTIME_OUTPUT_DIRECTORY "${BRILLIANT_SORT_WASM_OUTPUT_DIR}")
endif()
