#include "audio_worklet_adapter.hpp"

#include <new>

namespace brilliant_sort::audio {
namespace {

#if defined(__EMSCRIPTEN__)
#define PIXEL_AUDIO_WORKLET_EXPORT __attribute__((used))
#else
#define PIXEL_AUDIO_WORKLET_EXPORT
#endif

[[nodiscard]] PixelAudioEngine *
EngineFromHandle(std::uintptr_t handle) noexcept {
  return reinterpret_cast<PixelAudioEngine *>(handle);
}

} // namespace

extern "C" PIXEL_AUDIO_WORKLET_EXPORT std::uintptr_t
bs_audio_worklet_create(std::uint32_t sample_rate) noexcept {
  auto *engine = new (std::nothrow) PixelAudioEngine(sample_rate);
  if (engine == nullptr) {
    return 0;
  }
  if (!engine->Initialize()) {
    delete engine;
    return 0;
  }
  return reinterpret_cast<std::uintptr_t>(engine);
}

extern "C" PIXEL_AUDIO_WORKLET_EXPORT void
bs_audio_worklet_destroy(std::uintptr_t handle) noexcept {
  delete EngineFromHandle(handle);
}

extern "C" PIXEL_AUDIO_WORKLET_EXPORT int
bs_audio_worklet_push_cue(std::uintptr_t handle, const AudioCue *cue) noexcept {
  PixelAudioEngine *engine = EngineFromHandle(handle);
  return engine != nullptr && cue != nullptr && engine->PushCue(*cue) ? 0 : -1;
}

extern "C" PIXEL_AUDIO_WORKLET_EXPORT void
bs_audio_worklet_set_muted(std::uintptr_t handle, int muted) noexcept {
  PixelAudioEngine *const engine = EngineFromHandle(handle);
  if (engine != nullptr) {
    engine->SetMuted(muted != 0);
  }
}

extern "C" PIXEL_AUDIO_WORKLET_EXPORT void
bs_audio_worklet_render(std::uintptr_t handle, float *interleaved_output,
                        std::size_t frames, std::uint32_t channels) noexcept {
  PixelAudioEngine *const engine = EngineFromHandle(handle);
  if (engine == nullptr) {
    return;
  }
  engine->RenderInterleavedFloat(interleaved_output, frames, channels);
}

} // namespace brilliant_sort::audio
