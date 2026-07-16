#include "pixel_audio.hpp"

#include <array>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>

namespace {

using brilliant_sort::audio::AudioCue;
using brilliant_sort::audio::AudioDiagnostics;
using brilliant_sort::audio::CueColor;
using brilliant_sort::audio::CueKind;
using brilliant_sort::audio::kReferenceSampleRate;
using brilliant_sort::audio::PixelAudioEngine;

constexpr std::size_t kRenderBlockFrames = 256;
constexpr std::uint64_t kFnvOffset = 14'695'981'039'346'656'037ULL;
constexpr std::uint64_t kFnvPrime = 1'099'511'628'211ULL;

struct RenderSummary {
  std::uint64_t hash = kFnvOffset;
  AudioDiagnostics diagnostics{};
};

void HashSample(std::uint64_t &hash, std::int16_t sample) {
  const std::uint16_t bits = static_cast<std::uint16_t>(sample);
  hash ^= bits & 0xffU;
  hash *= kFnvPrime;
  hash ^= bits >> 8U;
  hash *= kFnvPrime;
}

RenderSummary RenderReference(std::uint32_t seconds) {
  PixelAudioEngine engine(kReferenceSampleRate);
  if (!engine.Initialize()) {
    return {};
  }
  const std::array<AudioCue, 6> cues{
      AudioCue{1, CueKind::Selection, CueColor::Ice, 4, 0, 0},
      AudioCue{2, CueKind::ShelfStore, CueColor::Navy, 3, 0, 0},
      AudioCue{3, CueKind::TargetPlace, CueColor::Coral, 5, 0, 0},
      AudioCue{4, CueKind::Progress, CueColor::None, 52, 100, 0},
      AudioCue{5, CueKind::ShelfCompact, CueColor::None, 6, 0, 0},
      AudioCue{6, CueKind::Rejected, CueColor::None, 2, 0, 0},
  };
  for (const AudioCue &cue : cues) {
    if (!engine.PushCue(cue)) {
      return {};
    }
  }

  std::array<std::int16_t, kRenderBlockFrames> block{};
  std::uint64_t remaining =
      static_cast<std::uint64_t>(seconds) * kReferenceSampleRate;
  RenderSummary summary{};
  while (remaining > 0U) {
    const std::size_t frames = static_cast<std::size_t>(
        remaining > block.size() ? block.size() : remaining);
    engine.Render(block.data(), frames);
    for (std::size_t index = 0; index < frames; ++index) {
      HashSample(summary.hash, block[index]);
    }
    remaining -= frames;
  }
  summary.diagnostics = engine.diagnostics();
  return summary;
}

[[nodiscard]] std::uint32_t ReadSeconds(int argc, char **argv) {
  constexpr std::uint32_t kDefaultSeconds = 8;
  constexpr std::uint32_t kMaximumSeconds = 120;
  if (argc != 3 || std::strcmp(argv[1], "--seconds") != 0) {
    return kDefaultSeconds;
  }
  const unsigned long parsed = std::strtoul(argv[2], nullptr, 10);
  if (parsed == 0UL || parsed > kMaximumSeconds) {
    return kDefaultSeconds;
  }
  return static_cast<std::uint32_t>(parsed);
}

} // namespace

int main(int argc, char **argv) {
  const std::uint32_t seconds = ReadSeconds(argc, argv);
  const RenderSummary first = RenderReference(seconds);
  const RenderSummary second = RenderReference(seconds);
  const bool identical =
      first.hash == second.hash &&
      first.diagnostics.peak_absolute_sample ==
          second.diagnostics.peak_absolute_sample &&
      first.diagnostics.rendered_frames == second.diagnostics.rendered_frames;
  std::cout << "pcm_hash=" << first.hash
            << " frames=" << first.diagnostics.rendered_frames
            << " peak=" << first.diagnostics.peak_absolute_sample
            << " deterministic=" << (identical ? "true" : "false") << '\n';
  return identical ? EXIT_SUCCESS : EXIT_FAILURE;
}
