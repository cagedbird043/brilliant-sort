#pragma once

#include "pixel_audio.hpp"

#include <cstddef>
#include <cstdint>

namespace brilliant_sort::audio {

/**
 * C ABI consumed by an Emscripten AudioWorklet host. Creation and cue ingress
 * occur outside the realtime callback; only render is called from the worklet.
 */
extern "C" {

[[nodiscard]] std::uintptr_t
bs_audio_worklet_create(std::uint32_t sample_rate) noexcept;
void bs_audio_worklet_destroy(std::uintptr_t handle) noexcept;
[[nodiscard]] int bs_audio_worklet_push_cue(std::uintptr_t handle,
                                            const AudioCue *cue) noexcept;
void bs_audio_worklet_set_muted(std::uintptr_t handle, int muted) noexcept;
void bs_audio_worklet_render(std::uintptr_t handle, float *interleaved_output,
                             std::size_t frames,
                             std::uint32_t channels) noexcept;
}

} // namespace brilliant_sort::audio
