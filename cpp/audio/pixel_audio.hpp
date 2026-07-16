#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <span>
#include <type_traits>

namespace brilliant_sort::audio {

constexpr std::uint32_t kReferenceSampleRate = 48'000;
constexpr std::size_t kMaxMusicVoices = 12;
constexpr std::size_t kMaxEffectVoices = 8;
constexpr std::size_t kMaxVoices = kMaxMusicVoices + kMaxEffectVoices;
constexpr std::size_t kCueCapacity = 64;
constexpr std::size_t kCueCriticalReserve = 8;

/** Presentation-only cue types. Their numeric values are the wire ABI. */
enum class CueKind : std::uint8_t {
  Selection = 0,
  ShelfStore = 1,
  TargetPlace = 2,
  ShelfCompact = 3,
  Rejected = 4,
  Progress = 5,
  Won = 6,
};

enum class CueColor : std::uint8_t {
  Obsidian = 0,
  Pearl = 1,
  Amber = 2,
  Navy = 3,
  Ice = 4,
  Coral = 5,
  None = 0xff,
};

/**
 * Fixed 12-byte packet shared with the browser bridge. `primary` is a count,
 * moved-count, rejection code, or matched total; `secondary` is total for a
 * progress cue and zero for all other cue kinds.
 */
struct alignas(4) AudioCue {
  std::uint32_t sequence = 0;
  CueKind kind = CueKind::Selection;
  CueColor color = CueColor::None;
  std::uint16_t primary = 0;
  std::uint16_t secondary = 0;
  std::uint16_t reserved = 0;
};
static_assert(sizeof(AudioCue) == 12);
static_assert(std::is_standard_layout_v<AudioCue>);
static_assert(std::is_trivially_copyable_v<AudioCue>);

class AudioCueQueue {
public:
  AudioCueQueue() noexcept;

  /** Single-producer operation. Low-priority/noncritical writes preserve a
   * reserve so a Won cue never waits behind cosmetic feedback. */
  [[nodiscard]] bool Push(const AudioCue &cue) noexcept;

  /** Single-consumer operation, called only by the render thread. */
  [[nodiscard]] bool Pop(AudioCue &cue) noexcept;

  [[nodiscard]] std::size_t Size() const noexcept;
  void Reset() noexcept;

private:
  std::array<AudioCue, kCueCapacity> slots_{};
  std::atomic<std::uint32_t> read_{0};
  std::atomic<std::uint32_t> write_{0};
};

enum class Waveform : std::uint8_t {
  Pulse = 0,
  Triangle = 1,
  Saw = 2,
  Fm = 3,
  Noise = 4,
};

enum class InstrumentId : std::uint8_t {
  Lead = 0,
  Bass = 1,
  Pad = 2,
  Arp = 3,
  Selection = 4,
  Shelf = 5,
  Placement = 6,
  Compact = 7,
  Rejected = 8,
  Progress = 9,
  Fanfare = 10,
  Count = 11,
};

/** Fixed 32-byte patch contract; all runtime synthesis controls are bounded. */
struct alignas(4) InstrumentSpec {
  Waveform waveform = Waveform::Pulse;
  std::uint8_t duty_q8 = 128;
  std::int8_t duty_sweep_q8 = 0;
  std::uint8_t arpeggio_count = 0;
  std::uint16_t attack_ms = 0;
  std::uint16_t decay_ms = 0;
  std::uint16_t sustain_q15 = 0;
  std::uint16_t release_ms = 0;
  std::uint16_t gain_q15 = 0;
  std::uint16_t vibrato_rate_hz = 0;
  std::uint16_t vibrato_depth_q15 = 0;
  std::uint16_t portamento_ms = 0;
  std::uint16_t arpeggio_period_ms = 0;
  std::int8_t pitch_start_semitones = 0;
  std::uint8_t fm_depth = 0;
  std::array<std::int8_t, 4> arpeggio_semitones{};
  std::array<std::uint8_t, 4> reserved{};
};
static_assert(sizeof(InstrumentSpec) == 32);
static_assert(std::is_standard_layout_v<InstrumentSpec>);
static_assert(std::is_trivially_copyable_v<InstrumentSpec>);

struct ChordDefinition {
  std::array<std::uint8_t, 4> scale_degrees{};
  std::uint8_t count = 0;
  std::array<std::uint8_t, 3> reserved{};
};
static_assert(sizeof(ChordDefinition) == 8);

/**
 * Static score payload. It contains no string, vector, allocator, or dynamic
 * parser state, so it can be copied before a realtime render session starts.
 */
struct alignas(4) ScoreDefinition {
  std::uint32_t seed = 0;
  std::uint16_t tempo_bpm = 0;
  std::uint16_t ticks_per_beat = 0;
  std::uint16_t beats_per_bar = 0;
  std::uint16_t loop_bars = 0;
  std::uint8_t max_music_voices = 0;
  std::uint8_t permitted_transforms = 0;
  std::uint8_t scale_root_midi = 0;
  std::uint8_t scale_count = 0;
  std::array<std::int8_t, 7> scale_semitones{};
  std::uint8_t reserved_scale = 0;
  std::array<std::uint8_t, 3> layer_threshold_percent{};
  std::uint8_t arrangement_layer_count = 0;
  std::array<std::uint8_t, 4> section_bars{};
  std::array<ChordDefinition, 8> chord_progression{};
  std::array<std::uint8_t, 8> motif_degrees{};
  std::array<std::uint16_t, 4> rhythm_masks{};
  std::array<InstrumentId, 4> instrument_assignments{};
};
static_assert(std::is_standard_layout_v<ScoreDefinition>);
static_assert(std::is_trivially_copyable_v<ScoreDefinition>);

constexpr std::uint8_t kTransformMotifRotation = 1U << 0U;
constexpr std::uint8_t kTransformOctaveDisplacement = 1U << 1U;
constexpr std::uint8_t kTransformChordToneSubstitution = 1U << 2U;
constexpr std::uint8_t kTransformBoundedOmission = 1U << 3U;
constexpr std::uint8_t kTransformArpeggioOrder = 1U << 4U;
constexpr std::uint8_t kAllPermittedTransforms =
    kTransformMotifRotation | kTransformOctaveDisplacement |
    kTransformChordToneSubstitution | kTransformBoundedOmission |
    kTransformArpeggioOrder;

enum class ScoreError : std::uint8_t {
  None = 0,
  MissingSeed,
  InvalidTempo,
  InvalidTicks,
  InvalidLoopDuration,
  InvalidVoiceBudget,
  InvalidScale,
  InvalidThresholds,
  InvalidSections,
  InvalidChord,
  InvalidMotif,
  InvalidRhythm,
  UnsupportedInstrument,
  UnsupportedTransform,
};

struct ScoreValidation {
  ScoreError error = ScoreError::None;

  [[nodiscard]] constexpr bool ok() const noexcept {
    return error == ScoreError::None;
  }
};

[[nodiscard]] const ScoreDefinition &TuxScore() noexcept;
[[nodiscard]] ScoreValidation
ValidateScore(const ScoreDefinition &score) noexcept;
[[nodiscard]] const InstrumentSpec &Instrument(InstrumentId id) noexcept;

struct AudioDiagnostics {
  std::uint64_t rendered_frames = 0;
  std::uint64_t render_callbacks = 0;
  std::uint64_t cues_consumed = 0;
  std::uint32_t dropped_cues = 0;
  std::uint32_t peak_absolute_sample = 0;
  std::uint16_t active_music_voices = 0;
  std::uint16_t active_effect_voices = 0;
  std::uint16_t fanfare_count = 0;
  std::uint16_t reserved = 0;
};

class PixelAudioEngine {
public:
  explicit PixelAudioEngine(
      std::uint32_t sample_rate = kReferenceSampleRate) noexcept;

  [[nodiscard]] bool Initialize() noexcept;
  [[nodiscard]] bool LoadScore(const ScoreDefinition &score) noexcept;
  [[nodiscard]] bool PushCue(const AudioCue &cue) noexcept;
  void SetMuted(bool muted) noexcept;
  [[nodiscard]] bool muted() const noexcept;

  /** The native deterministic reference path. */
  void Render(std::int16_t *output, std::size_t frames) noexcept;

  /** AudioWorklet boundary conversion; synthesis itself remains integer. */
  void RenderInterleavedFloat(float *output, std::size_t frames,
                              std::uint32_t channels) noexcept;

  [[nodiscard]] AudioDiagnostics diagnostics() const noexcept;
  [[nodiscard]] std::uint32_t sample_rate() const noexcept;
  [[nodiscard]] std::size_t pending_cues() const noexcept;

private:
  enum class EnvelopeStage : std::uint8_t {
    Attack,
    Decay,
    Sustain,
    Release,
    Inactive,
  };

  struct Voice {
    InstrumentSpec instrument{};
    std::uint32_t phase = 0;
    std::uint32_t mod_phase = 0;
    std::uint32_t phase_increment = 0;
    std::uint32_t target_phase_increment = 0;
    std::uint32_t portamento_step = 0;
    std::uint32_t vibrato_phase = 0;
    std::uint32_t vibrato_increment = 0;
    std::uint32_t envelope_q16 = 0;
    std::uint32_t envelope_step_q16 = 0;
    std::uint32_t duration_remaining = 0;
    std::uint32_t release_samples = 0;
    std::uint32_t arpeggio_remaining = 0;
    std::uint32_t arpeggio_period = 0;
    std::uint32_t duty_q16 = 0;
    std::uint32_t lfsr = 0xace1U;
    std::int32_t filtered_noise = 0;
    std::uint64_t age = 0;
    std::uint8_t midi_note = 0;
    std::uint8_t arpeggio_index = 0;
    EnvelopeStage envelope_stage = EnvelopeStage::Inactive;
    bool active = false;
  };

  void ResetTransport() noexcept;
  void DrainCues() noexcept;
  void ApplyCue(const AudioCue &cue) noexcept;
  void ProcessScoreTick() noexcept;
  void ProcessVictoryTick(std::uint32_t elapsed_ticks) noexcept;
  void ScheduleBar(std::uint32_t bar_index) noexcept;
  void ScheduleMelody(std::uint32_t tick_in_bar,
                      std::uint32_t bar_index) noexcept;
  void TriggerMusic(InstrumentId id, std::int32_t midi_note,
                    std::uint32_t duration_ticks) noexcept;
  void TriggerEffect(InstrumentId id, std::int32_t midi_note,
                     std::uint32_t duration_ms) noexcept;
  void StartVoice(std::array<Voice, kMaxMusicVoices> &voices,
                  const InstrumentSpec &instrument, std::int32_t midi_note,
                  std::uint32_t duration_samples) noexcept;
  void StartVoice(std::array<Voice, kMaxEffectVoices> &voices,
                  const InstrumentSpec &instrument, std::int32_t midi_note,
                  std::uint32_t duration_samples) noexcept;
  void ConfigureVoice(Voice &voice, const InstrumentSpec &instrument,
                      std::int32_t midi_note,
                      std::uint32_t duration_samples) noexcept;
  [[nodiscard]] std::int16_t RenderOne() noexcept;
  [[nodiscard]] std::int32_t RenderVoice(Voice &voice) noexcept;
  void AdvanceEnvelope(Voice &voice) noexcept;
  void BeginRelease(Voice &voice) noexcept;
  [[nodiscard]] std::uint32_t
  SamplesForTicks(std::uint32_t ticks) const noexcept;
  [[nodiscard]] std::uint32_t
  PhaseIncrementForMidi(std::int32_t midi_note) const noexcept;
  [[nodiscard]] std::uint32_t
  MillisecondsToSamples(std::uint32_t milliseconds) const noexcept;
  [[nodiscard]] std::int32_t ScaleMidi(std::uint8_t degree,
                                       std::int32_t octave) const noexcept;
  [[nodiscard]] std::uint32_t
  VariationWord(std::uint32_t bar_index) const noexcept;
  void RefreshVoiceDiagnostics() noexcept;

  std::uint32_t sample_rate_;
  bool initialized_ = false;
  ScoreDefinition score_{};
  AudioCueQueue cue_queue_{};
  std::array<Voice, kMaxMusicVoices> music_voices_{};
  std::array<Voice, kMaxEffectVoices> effect_voices_{};
  std::atomic<bool> muted_requested_{false};
  std::atomic<bool> won_submitted_{false};
  std::uint32_t master_gain_q15_ = 32'767;
  std::uint64_t samples_per_tick_q32_ = 0;
  std::uint64_t transport_sample_q32_ = 0;
  std::uint64_t next_tick_q32_ = 0;
  std::uint64_t transport_tick_ = 0;
  std::uint64_t voice_age_ = 0;
  std::uint8_t active_layer_ = 0;
  std::uint8_t pending_layer_ = 0;
  bool victory_pending_ = false;
  bool victory_started_ = false;
  std::uint64_t victory_start_tick_ = 0;
  AudioDiagnostics diagnostics_{};
};

[[nodiscard]] std::uint64_t
HashPcmFNV1a(std::span<const std::int16_t> samples) noexcept;

} // namespace brilliant_sort::audio
