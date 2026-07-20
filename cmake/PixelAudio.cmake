include_guard(GLOBAL)

get_filename_component(PIXEL_AUDIO_PROJECT_ROOT "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)
set(PIXEL_AUDIO_CPP_DIR "${PIXEL_AUDIO_PROJECT_ROOT}/cpp/audio")
set(PIXEL_AUDIO_TEST_DIR "${PIXEL_AUDIO_PROJECT_ROOT}/tests/cpp/audio")
set(
    PIXEL_AUDIO_ENGINE_SOURCES
    "${PIXEL_AUDIO_CPP_DIR}/pixel_audio.cpp"
    "${PIXEL_AUDIO_CPP_DIR}/tux_score.cpp"
    "${PIXEL_AUDIO_CPP_DIR}/audio_worklet_adapter.cpp")

function(pixel_audio_enable_warnings target)
    target_compile_options(${target} PRIVATE -Wall -Wextra -Werror -pedantic)
    target_compile_features(${target} PRIVATE cxx_std_20)
endfunction()

function(pixel_audio_add_native_targets)
    if(TARGET pixel_audio)
        return()
    endif()

    add_library(pixel_audio STATIC ${PIXEL_AUDIO_ENGINE_SOURCES})
    target_include_directories(pixel_audio PUBLIC "${PIXEL_AUDIO_CPP_DIR}")
    pixel_audio_enable_warnings(pixel_audio)

    add_executable(pixel_audio_offline_renderer "${PIXEL_AUDIO_CPP_DIR}/offline_renderer.cpp")
    target_link_libraries(pixel_audio_offline_renderer PRIVATE pixel_audio)
    pixel_audio_enable_warnings(pixel_audio_offline_renderer)

    if(BUILD_TESTING)
        find_package(Threads REQUIRED)
        add_executable(pixel_audio_test "${PIXEL_AUDIO_TEST_DIR}/pixel_audio_test.cpp")
        target_compile_definitions(
            pixel_audio_test
            PRIVATE PIXEL_AUDIO_SCORE_PATH="${PIXEL_AUDIO_PROJECT_ROOT}/src/audio/tux-01.music.json")
        target_link_libraries(pixel_audio_test PRIVATE pixel_audio Threads::Threads)
        pixel_audio_enable_warnings(pixel_audio_test)
        add_test(NAME pixel_audio COMMAND pixel_audio_test)
        add_test(NAME pixel_audio_offline_hash COMMAND pixel_audio_offline_renderer)
        set_tests_properties(
            pixel_audio_offline_hash
            PROPERTIES
                PASS_REGULAR_EXPRESSION
                    "pcm_hash=10023643131642136347 frames=384000 peak=32768 deterministic=true")
    endif()
endfunction()

function(pixel_audio_add_emscripten_target)
    if(NOT EMSCRIPTEN)
        message(FATAL_ERROR "pixel_audio_add_emscripten_target requires Emscripten")
    endif()
    if(TARGET brilliant_sort_audio)
        return()
    endif()

    add_executable(brilliant_sort_audio ${PIXEL_AUDIO_ENGINE_SOURCES})
    target_include_directories(brilliant_sort_audio PRIVATE "${PIXEL_AUDIO_CPP_DIR}")
    pixel_audio_enable_warnings(brilliant_sort_audio)
    target_link_options(
        brilliant_sort_audio
        PRIVATE
            "--no-entry"
            "-sSTANDALONE_WASM=1"
            "-sFILESYSTEM=0"
            "-sALLOW_MEMORY_GROWTH=0"
            "-sINITIAL_MEMORY=33554432"
            "-sEXPORTED_FUNCTIONS=['_malloc','_free','_bs_audio_worklet_create','_bs_audio_worklet_destroy','_bs_audio_worklet_push_cue','_bs_audio_worklet_set_muted','_bs_audio_worklet_render']")
    set_target_properties(
        brilliant_sort_audio
        PROPERTIES
            OUTPUT_NAME "brilliant-sort-audio"
            SUFFIX ".wasm")
endfunction()
