cmake_minimum_required(VERSION 3.24)

project(pixel_audio LANGUAGES CXX)

include(CTest)
include("${CMAKE_CURRENT_LIST_DIR}/../../cmake/PixelAudio.cmake")

pixel_audio_add_native_targets()
