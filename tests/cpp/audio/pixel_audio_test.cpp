#include "pixel_audio.hpp"

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <iterator>
#include <limits>
#include <new>
#include <span>
#include <string>
#include <string_view>

namespace {

std::atomic<bool> g_count_allocations{false};
std::atomic<std::uint64_t> g_allocation_count{0};

void *Allocate(std::size_t size) {
  if (g_count_allocations.load(std::memory_order_relaxed)) {
    g_allocation_count.fetch_add(1U, std::memory_order_relaxed);
  }
  void *const result = std::malloc(size == 0U ? 1U : size);
  if (result == nullptr) {
    throw std::bad_alloc();
  }
  return result;
}

void *AllocateAligned(std::size_t size, std::size_t alignment) {
  if (g_count_allocations.load(std::memory_order_relaxed)) {
    g_allocation_count.fetch_add(1U, std::memory_order_relaxed);
  }
  const std::size_t adjusted_size =
      ((size + alignment - 1U) / alignment) * alignment;
  void *const result = std::aligned_alloc(
      alignment, adjusted_size == 0U ? alignment : adjusted_size);
  if (result == nullptr) {
    throw std::bad_alloc();
  }
  return result;
}

} // namespace

void *operator new(std::size_t size) { return Allocate(size); }

void *operator new[](std::size_t size) { return Allocate(size); }

void operator delete(void *pointer) noexcept { std::free(pointer); }

void operator delete[](void *pointer) noexcept { std::free(pointer); }

void operator delete(void *pointer, std::size_t) noexcept {
  std::free(pointer);
}

void operator delete[](void *pointer, std::size_t) noexcept {
  std::free(pointer);
}

void *operator new(std::size_t size, std::align_val_t alignment) {
  return AllocateAligned(size, static_cast<std::size_t>(alignment));
}

void *operator new[](std::size_t size, std::align_val_t alignment) {
  return AllocateAligned(size, static_cast<std::size_t>(alignment));
}

void operator delete(void *pointer, std::align_val_t) noexcept {
  std::free(pointer);
}

void operator delete[](void *pointer, std::align_val_t) noexcept {
  std::free(pointer);
}

void operator delete(void *pointer, std::size_t, std::align_val_t) noexcept {
  std::free(pointer);
}

void operator delete[](void *pointer, std::size_t, std::align_val_t) noexcept {
  std::free(pointer);
}

namespace {

using brilliant_sort::audio::AudioCue;
using brilliant_sort::audio::AudioCueQueue;
using brilliant_sort::audio::CueColor;
using brilliant_sort::audio::CueKind;
using brilliant_sort::audio::InstrumentId;
using brilliant_sort::audio::kCueCapacity;
using brilliant_sort::audio::kCueCriticalReserve;
using brilliant_sort::audio::kReferenceSampleRate;
using brilliant_sort::audio::PixelAudioEngine;
using brilliant_sort::audio::ScoreDefinition;
using brilliant_sort::audio::ScoreError;
using brilliant_sort::audio::TuxScore;
using brilliant_sort::audio::ValidateScore;

[[noreturn]] void Fail(std::string_view message) {
  std::cerr << "FAILED: " << message << '\n';
  std::exit(EXIT_FAILURE);
}

void Expect(bool condition, std::string_view message) {
  if (!condition) {
    Fail(message);
  }
}

[[nodiscard]] std::size_t JsonValueOffset(std::string_view json,
                                          std::string_view key) {
  const std::size_t key_offset = json.find(key);
  Expect(key_offset != std::string_view::npos,
         "JSON source should contain key");
  const std::size_t colon_offset = json.find(':', key_offset + key.size());
  Expect(colon_offset != std::string_view::npos,
         "JSON source key should have a value");
  return colon_offset + 1U;
}

void SkipJsonWhitespace(std::string_view json, std::size_t &offset) {
  while (offset < json.size() &&
         (json[offset] == ' ' || json[offset] == '\n' || json[offset] == '\r' ||
          json[offset] == '\t')) {
    ++offset;
  }
}

[[nodiscard]] std::uint64_t ReadJsonUnsigned(std::string_view json,
                                             std::size_t &offset) {
  while (offset < json.size() && (json[offset] < '0' || json[offset] > '9')) {
    ++offset;
  }
  Expect(offset < json.size(), "JSON source should contain an unsigned value");
  std::uint64_t value = 0;
  while (offset < json.size() && json[offset] >= '0' && json[offset] <= '9') {
    value = value * 10U + static_cast<std::uint64_t>(json[offset] - '0');
    ++offset;
  }
  return value;
}

[[nodiscard]] std::uint64_t JsonUnsigned(std::string_view json,
                                         std::string_view key) {
  std::size_t offset = JsonValueOffset(json, key);
  return ReadJsonUnsigned(json, offset);
}

[[nodiscard]] std::string_view JsonString(std::string_view json,
                                          std::string_view key) {
  std::size_t offset = JsonValueOffset(json, key);
  SkipJsonWhitespace(json, offset);
  Expect(offset < json.size() && json[offset] == '"',
         "JSON source should contain a string value");
  const std::size_t start = ++offset;
  const std::size_t end = json.find('"', start);
  Expect(end != std::string_view::npos,
         "JSON source string value should close");
  return json.substr(start, end - start);
}

template <typename Value, std::size_t Count>
void ExpectJsonUnsignedArray(std::string_view json, std::string_view key,
                             const std::array<Value, Count> &expected,
                             std::string_view message) {
  std::size_t offset = JsonValueOffset(json, key);
  for (const Value value : expected) {
    Expect(ReadJsonUnsigned(json, offset) == static_cast<std::uint64_t>(value),
           message);
  }
}

void TestTuxScoreSourceConsistency() {
#ifndef PIXEL_AUDIO_SCORE_PATH
#error "PIXEL_AUDIO_SCORE_PATH must be supplied by the standalone CMake target"
#endif
  std::ifstream source(PIXEL_AUDIO_SCORE_PATH);
  Expect(source.good(), "reviewed Tux score source should be readable");
  const std::string json{std::istreambuf_iterator<char>(source),
                         std::istreambuf_iterator<char>()};
  const ScoreDefinition &score = TuxScore();

  Expect(JsonUnsigned(json, "schemaVersion") == 1U,
         "Tux score source schema should be supported");
  Expect(JsonString(json, "id") == "tux-01",
         "Tux score source should identify tux-01");
  Expect(JsonUnsigned(json, "seed") == score.seed,
         "source seed should match compiled score");
  Expect(JsonUnsigned(json, "tempoBpm") == score.tempo_bpm,
         "source tempo should match compiled score");
  Expect(JsonUnsigned(json, "ticksPerBeat") == score.ticks_per_beat,
         "source ticks should match compiled score");
  Expect(JsonUnsigned(json, "beatsPerBar") == score.beats_per_bar,
         "source meter should match compiled score");
  Expect(JsonUnsigned(json, "loopBars") == score.loop_bars,
         "source loop should match compiled score");
  Expect(JsonUnsigned(json, "maxMusicVoices") == score.max_music_voices,
         "source voice budget should match compiled score");
  Expect(JsonUnsigned(json, "permittedTransformMask") ==
             score.permitted_transforms,
         "source transforms should match compiled score");
  Expect(JsonUnsigned(json, "rootMidi") == score.scale_root_midi,
         "source scale root should match compiled score");
  Expect(JsonUnsigned(json, "layerCount") == score.arrangement_layer_count,
         "source layer count should match compiled score");
  Expect(score.scale_count == score.scale_semitones.size(),
         "compiled Tux score should retain the source scale cardinality");
  ExpectJsonUnsignedArray(json, "semitones", score.scale_semitones,
                          "source scale should match compiled score");
  ExpectJsonUnsignedArray(json, "layerThresholdPercent",
                          score.layer_threshold_percent,
                          "source thresholds should match compiled score");
  ExpectJsonUnsignedArray(json, "sectionBars", score.section_bars,
                          "source sections should match compiled score");
  ExpectJsonUnsignedArray(json, "motifDegrees", score.motif_degrees,
                          "source motif should match compiled score");
  ExpectJsonUnsignedArray(json, "rhythmMasks", score.rhythm_masks,
                          "source rhythm should match compiled score");

  std::size_t chord_offset = JsonValueOffset(json, "chordProgression");
  for (const auto &chord : score.chord_progression) {
    Expect(chord.count == chord.scale_degrees.size(),
           "source Tux chords should retain their bounded four-note shape");
    for (std::size_t degree = 0; degree < chord.count; ++degree) {
      Expect(ReadJsonUnsigned(json, chord_offset) ==
                 chord.scale_degrees[degree],
             "source chord grammar should match compiled score");
    }
  }

  constexpr std::array<InstrumentId, 4> kInstrumentAssignments{
      InstrumentId::Lead, InstrumentId::Bass, InstrumentId::Pad,
      InstrumentId::Arp};
  constexpr std::array<std::string_view, 4> kInstrumentNames{"Lead", "Bass",
                                                             "Pad", "Arp"};
  std::size_t instrument_offset =
      JsonValueOffset(json, "instrumentAssignments");
  for (std::size_t index = 0; index < kInstrumentNames.size(); ++index) {
    const std::string_view name = kInstrumentNames[index];
    Expect(score.instrument_assignments[index] == kInstrumentAssignments[index],
           "compiled instrument assignment should match Tux source");
    while (instrument_offset < json.size() && json[instrument_offset] != '"') {
      ++instrument_offset;
    }
    Expect(instrument_offset < json.size(),
           "source instrument assignment should be readable");
    const std::size_t start = ++instrument_offset;
    const std::size_t end = json.find('"', start);
    Expect(end != std::string_view::npos,
           "source instrument assignment should close");
    Expect(json.substr(start, end - start) == name,
           "source instrument assignment should match compiled score");
    instrument_offset = end + 1U;
  }
}

void TestJadeCueAbi() {
  static_assert(static_cast<std::uint8_t>(CueKind::Won) == 6U);
  static_assert(static_cast<std::uint8_t>(CueKind::Restart) == 7U);
  static_assert(static_cast<std::uint8_t>(CueColor::Obsidian) == 0U);
  static_assert(static_cast<std::uint8_t>(CueColor::Pearl) == 1U);
  static_assert(static_cast<std::uint8_t>(CueColor::Amber) == 2U);
  static_assert(static_cast<std::uint8_t>(CueColor::Navy) == 3U);
  static_assert(static_cast<std::uint8_t>(CueColor::Ice) == 4U);
  static_assert(static_cast<std::uint8_t>(CueColor::Coral) == 5U);
  static_assert(static_cast<std::uint8_t>(CueColor::Jade) == 6U);
  static_assert(static_cast<std::uint8_t>(CueColor::None) == 0xffU);
  PixelAudioEngine engine(kReferenceSampleRate);
  Expect(engine.Initialize(), "engine should initialize for jade cue");
  Expect(
      engine.PushCue(AudioCue{1, CueKind::Selection, CueColor::Jade, 1, 0, 0}),
      "jade cue should use the stable audio ABI");
  std::array<std::int16_t, 64> pcm{};
  engine.Render(pcm.data(), pcm.size());
  Expect(engine.diagnostics().cues_consumed == 1U,
         "jade cue should be consumed by the synth");
}

void TestQueuePriorityAndOrder() {
  AudioCueQueue queue;
  for (std::size_t index = 0; index < kCueCapacity - kCueCriticalReserve;
       ++index) {
    const AudioCue cue{
        static_cast<std::uint32_t>(index + 1U),
        CueKind::TargetPlace,
        CueColor::Coral,
        2,
        0,
        0,
    };
    Expect(queue.Push(cue),
           "normal cue should occupy only noncritical capacity");
  }
  Expect(!queue.Push(AudioCue{57, CueKind::Selection, CueColor::Ice, 1, 0, 0}),
         "low-priority selection should drop when critical reserve begins");
  Expect(
      !queue.Push(AudioCue{58, CueKind::Progress, CueColor::None, 25, 100, 0}),
      "low-priority progress should drop when critical reserve begins");
  Expect(queue.Push(AudioCue{59, CueKind::Won, CueColor::None, 0, 0, 0}),
         "won cue should consume reserved capacity");
  Expect(queue.Push(AudioCue{60, CueKind::Restart, CueColor::None, 0, 0, 0}),
         "restart cue should consume reserved capacity");

  AudioCue popped{};
  for (std::size_t index = 0; index < kCueCapacity - kCueCriticalReserve;
       ++index) {
    Expect(queue.Pop(popped), "queued normal cue should be available");
    Expect(popped.sequence == index + 1U,
           "queue should preserve producer order");
  }
  Expect(queue.Pop(popped), "reserved won cue should remain available");
  Expect(popped.kind == CueKind::Won, "reserved cue should be won");
  Expect(queue.Pop(popped), "reserved restart cue should remain available");
  Expect(popped.kind == CueKind::Restart, "reserved cue should be restart");
  Expect(!queue.Pop(popped), "queue should be empty after ordered drain");
}

void TestScoreConstraints() {
  Expect(ValidateScore(TuxScore()).ok(), "reviewed Tux score should validate");

  ScoreDefinition missing_seed = TuxScore();
  missing_seed.seed = 0;
  Expect(ValidateScore(missing_seed).error == ScoreError::MissingSeed,
         "score without a fixed seed should be rejected");

  ScoreDefinition invalid_rhythm = TuxScore();
  invalid_rhythm.rhythm_masks[1] = 0;
  Expect(ValidateScore(invalid_rhythm).error == ScoreError::InvalidRhythm,
         "empty rhythm mask should be rejected");

  ScoreDefinition excessive_voices = TuxScore();
  excessive_voices.max_music_voices = 13;
  Expect(ValidateScore(excessive_voices).error ==
             ScoreError::InvalidVoiceBudget,
         "unbounded score voice budget should be rejected");

  ScoreDefinition invalid_instrument = TuxScore();
  invalid_instrument.instrument_assignments[0] =
      static_cast<brilliant_sort::audio::InstrumentId>(255);
  Expect(ValidateScore(invalid_instrument).error ==
             ScoreError::UnsupportedInstrument,
         "unsupported instrument should be rejected");
}

void EnqueueReferenceCues(PixelAudioEngine &engine) {
  constexpr std::array<AudioCue, 7> cues{
      AudioCue{1, CueKind::Selection, CueColor::Ice, 4, 0, 0},
      AudioCue{2, CueKind::ShelfStore, CueColor::Navy, 3, 0, 0},
      AudioCue{3, CueKind::TargetPlace, CueColor::Coral, 5, 0, 0},
      AudioCue{4, CueKind::ShelfCompact, CueColor::None, 4, 0, 0},
      AudioCue{5, CueKind::Rejected, CueColor::None, 2, 0, 0},
      AudioCue{6, CueKind::Progress, CueColor::None, 76, 100, 0},
      AudioCue{7, CueKind::Won, CueColor::None, 0, 0, 0},
  };
  for (const AudioCue &cue : cues) {
    Expect(engine.PushCue(cue), "reference cue should enter bounded queue");
  }
}

void TestDeterministicReferencePcm() {
  constexpr std::size_t kFrames = kReferenceSampleRate * 2U;
  static std::array<std::int16_t, kFrames> first{};
  static std::array<std::int16_t, kFrames> second{};

  PixelAudioEngine first_engine(kReferenceSampleRate);
  PixelAudioEngine second_engine(kReferenceSampleRate);
  Expect(first_engine.Initialize(), "first engine should initialize");
  Expect(second_engine.Initialize(), "second engine should initialize");
  EnqueueReferenceCues(first_engine);
  EnqueueReferenceCues(second_engine);
  first_engine.Render(first.data(), first.size());
  second_engine.Render(second.data(), second.size());

  const std::uint64_t first_hash = brilliant_sort::audio::HashPcmFNV1a(first);
  const std::uint64_t second_hash = brilliant_sort::audio::HashPcmFNV1a(second);
  Expect(first_hash == second_hash, "fixed 48kHz runs should hash identically");
  Expect(first_hash != 0U, "reference hash should contain PCM data");
  Expect(first_engine.diagnostics().peak_absolute_sample ==
             second_engine.diagnostics().peak_absolute_sample,
         "deterministic runs should retain the same peak diagnostic");
  Expect(first_engine.diagnostics().fanfare_count == 1U,
         "duplicate-safe victory should schedule one fanfare");
}

void TestVictoryFanfareCanRepeatAfterReplay() {
  PixelAudioEngine engine(kReferenceSampleRate);
  Expect(engine.Initialize(),
         "engine should initialize for replay victory test");
  std::array<std::int16_t, 256> pcm{};

  Expect(engine.PushCue(AudioCue{1, CueKind::Won, CueColor::None, 0, 0, 0}),
         "first victory should enter the audio queue");
  engine.Render(pcm.data(), pcm.size());
  Expect(engine.diagnostics().fanfare_count == 1U,
         "first victory should start one fanfare");

  engine.SetMuted(true);
  Expect(engine.PushCue(AudioCue{2, CueKind::Restart, CueColor::None, 0, 0, 0}),
         "replay should enqueue a transport restart");
  Expect(engine.PushCue(AudioCue{3, CueKind::Won, CueColor::None, 0, 0, 0}),
         "second-run victory should enter the audio queue after restart");
  engine.Render(pcm.data(), pcm.size());
  Expect(engine.diagnostics().fanfare_count == 2U,
         "second-run victory should start another fanfare");
  Expect(engine.muted(),
         "replay transport restart should preserve the mute preference");
}

void TestBoundedSaturatedOutput() {
  PixelAudioEngine engine(kReferenceSampleRate);
  Expect(engine.Initialize(),
         "engine should initialize for bounded output test");
  for (std::uint32_t sequence = 1; sequence <= 32; ++sequence) {
    Expect(engine.PushCue(AudioCue{sequence, CueKind::TargetPlace,
                                   CueColor::Amber, 65'535, 0, 0}),
           "bounded placement cue should enqueue");
  }
  std::array<std::int16_t, 2'048> pcm{};
  engine.Render(pcm.data(), pcm.size());
  for (const std::int16_t sample : pcm) {
    Expect(sample >= std::numeric_limits<std::int16_t>::min() &&
               sample <= std::numeric_limits<std::int16_t>::max(),
           "saturated output should remain signed 16-bit PCM");
  }
  const auto diagnostics = engine.diagnostics();
  Expect(diagnostics.active_music_voices <= 12U,
         "music voices should remain reserved and bounded");
  Expect(diagnostics.active_effect_voices <= 8U,
         "effect voices should remain reserved and bounded");
  Expect(diagnostics.peak_absolute_sample <= 32'768U,
         "mix bus should saturate without wraparound");
}

void TestDeviceSampleRates() {
  constexpr std::array<std::uint32_t, 3> kSupportedRates{44'100, 48'000,
                                                         96'000};
  for (const std::uint32_t sample_rate : kSupportedRates) {
    PixelAudioEngine engine(sample_rate);
    Expect(engine.Initialize(),
           "supported device sample rate should initialize");
    Expect(engine.sample_rate() == sample_rate,
           "engine should retain the device sample rate");
    Expect(engine.PushCue(
               AudioCue{1, CueKind::Selection, CueColor::Pearl, 4, 0, 0}),
           "device-rate engine should accept cues");
    std::array<std::int16_t, 256> pcm{};
    engine.Render(pcm.data(), pcm.size());
    Expect(engine.diagnostics().rendered_frames == pcm.size(),
           "device-rate engine should render the requested frame count");
  }

  PixelAudioEngine below_minimum(7'999);
  PixelAudioEngine above_maximum(192'001);
  Expect(!below_minimum.Initialize(),
         "sample rates below the supported device range should fail");
  Expect(!above_maximum.Initialize(),
         "sample rates above the supported device range should fail");
}

void TestRenderHasNoAllocations() {
  PixelAudioEngine engine(kReferenceSampleRate);
  Expect(engine.Initialize(),
         "engine should initialize before allocation audit");
  EnqueueReferenceCues(engine);
  std::array<std::int16_t, 512> pcm{};
  const std::uint64_t before =
      g_allocation_count.load(std::memory_order_relaxed);
  g_count_allocations.store(true, std::memory_order_relaxed);
  engine.Render(pcm.data(), pcm.size());
  g_count_allocations.store(false, std::memory_order_relaxed);
  const std::uint64_t after =
      g_allocation_count.load(std::memory_order_relaxed);
  Expect(after == before, "render callback should make zero heap allocations");
}

} // namespace

int main() {
  TestQueuePriorityAndOrder();
  TestScoreConstraints();
  TestTuxScoreSourceConsistency();
  TestJadeCueAbi();
  TestDeterministicReferencePcm();
  TestVictoryFanfareCanRepeatAfterReplay();
  TestBoundedSaturatedOutput();
  TestDeviceSampleRates();
  TestRenderHasNoAllocations();
  std::cout << "pixel_audio tests passed\n";
  return EXIT_SUCCESS;
}
