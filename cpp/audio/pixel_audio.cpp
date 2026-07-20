#include "pixel_audio.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>

namespace brilliant_sort::audio {
namespace {

constexpr std::uint32_t kQ15Maximum = 32'767;
constexpr std::uint32_t kQ16Maximum = 65'535;
constexpr std::uint32_t kMinimumSampleRate = 8'000;
constexpr std::uint32_t kMaximumSampleRate = 192'000;
constexpr std::uint32_t kMasterRampMilliseconds = 10;
constexpr std::size_t kMaxCuesPerRender = 16;
constexpr std::uint64_t kOneSampleQ32 = std::uint64_t{1} << 32U;
constexpr std::uint32_t kLfsrSeed = 0xace1U;
constexpr std::array<std::int16_t, 16> kSineQuarter{
    0,      3'212,  6'393,  9'512,  12'539, 15'446, 18'204, 20'787,
    23'170, 25'329, 27'245, 28'898, 30'273, 31'356, 32'137, 32'610,
};
constexpr std::array<std::int16_t, 32> kSawLow{
    0,      15'276,  20'871,  17'410,  13'063,  12'651,  13'562,  12'074,
    9'147,  7'814,   7'966,   7'056,   4'638,   2'879,   2'637,   2'080,
    0,      -2'080,  -2'637,  -2'879,  -4'638,  -7'056,  -7'966,  -7'814,
    -9'147, -12'074, -13'562, -12'651, -13'063, -17'410, -20'871, -15'276,
};
constexpr std::array<std::int16_t, 32> kSawMedium{
    0,       10'217,  18'663,  24'029,  25'787,  24'279,  20'552,  15'996,
    11'915,  9'156,   7'913,   7'767,   7'914,   7'517,   6'025,   3'377,
    0,       -3'377,  -6'025,  -7'517,  -7'914,  -7'767,  -7'913,  -9'156,
    -11'915, -15'996, -20'552, -24'279, -25'787, -24'029, -18'663, -10'217,
};
constexpr std::array<std::int16_t, 32> kSawHigh{
    0,       6'393,   12'539,  18'204,  23'170,  27'245,  30'273,  32'137,
    32'767,  32'137,  30'273,  27'245,  23'170,  18'204,  12'539,  6'393,
    0,       -6'393,  -12'539, -18'204, -23'170, -27'245, -30'273, -32'137,
    -32'767, -32'137, -30'273, -27'245, -23'170, -18'204, -12'539, -6'393,
};
constexpr std::array<std::uint32_t, 49> kPhaseIncrementsAt48k{
    5'852'465,  6'200'470,  6'569'170,  6'959'793,  7'373'644,  7'812'103,
    8'276'635,  8'768'789,  9'290'209,  9'842'633,  10'427'907, 11'047'982,
    11'704'930, 12'400'941, 13'138'339, 13'919'586, 14'747'287, 15'624'207,
    16'553'270, 17'537'579, 18'580'418, 19'685'267, 20'855'814, 22'095'965,
    23'409'859, 24'801'882, 26'276'679, 27'839'171, 29'494'575, 31'248'413,
    33'106'541, 35'075'158, 37'160'835, 39'370'534, 41'711'627, 44'191'930,
    46'819'719, 49'603'764, 52'553'357, 55'678'342, 58'989'149, 62'496'826,
    66'213'081, 70'150'316, 74'321'671, 78'741'067, 83'423'255, 88'383'859,
    93'639'437,
};
constexpr std::array<std::int32_t, 7> kColorMidiNotes{60, 62, 64, 67,
                                                      69, 72, 65};
constexpr std::array<std::int32_t, 3> kPlacementIntervals{0, 4, 7};
constexpr std::array<std::uint32_t, 6> kFanfareOffsets{0, 12, 24, 36, 48, 72};
constexpr std::array<std::int32_t, 6> kFanfareNotes{72, 76, 79, 84, 79, 84};

[[nodiscard]] constexpr bool IsCriticalCue(CueKind kind) noexcept {
  return kind == CueKind::Won || kind == CueKind::Restart;
}

[[nodiscard]] constexpr bool IsKnownCueKind(CueKind kind) noexcept {
  return static_cast<std::uint8_t>(kind) <=
         static_cast<std::uint8_t>(CueKind::Restart);
}

[[nodiscard]] constexpr bool IsColor(CueColor color) noexcept {
  return static_cast<std::uint8_t>(color) <=
         static_cast<std::uint8_t>(CueColor::Jade);
}

[[nodiscard]] constexpr std::int32_t ClampInt32(std::int64_t value,
                                                std::int32_t minimum,
                                                std::int32_t maximum) noexcept {
  if (value < minimum) {
    return minimum;
  }
  if (value > maximum) {
    return maximum;
  }
  return static_cast<std::int32_t>(value);
}

[[nodiscard]] constexpr std::uint32_t
ClampUnsigned(std::int64_t value, std::uint32_t minimum,
              std::uint32_t maximum) noexcept {
  if (value < static_cast<std::int64_t>(minimum)) {
    return minimum;
  }
  if (value > static_cast<std::int64_t>(maximum)) {
    return maximum;
  }
  return static_cast<std::uint32_t>(value);
}

[[nodiscard]] constexpr std::int32_t SineQ15(std::uint32_t phase) noexcept {
  const std::uint32_t table_index = phase >> 26U;
  const std::uint32_t quadrant = table_index >> 4U;
  const std::uint32_t offset = table_index & 0x0fU;
  switch (quadrant) {
  case 0:
    return kSineQuarter[offset];
  case 1:
    return kSineQuarter[15U - offset];
  case 2:
    return -kSineQuarter[offset];
  default:
    return -kSineQuarter[15U - offset];
  }
}

[[nodiscard]] constexpr std::int32_t TriangleQ15(std::uint32_t phase) noexcept {
  const std::uint32_t position = phase >> 16U;
  if (position < 32'768U) {
    return static_cast<std::int32_t>(position * 2U) - 32'768;
  }
  return 32'767 - static_cast<std::int32_t>((position - 32'768U) * 2U);
}

[[nodiscard]] constexpr std::int32_t
SawQ15(std::uint32_t phase, std::uint32_t phase_increment) noexcept {
  const std::size_t index = static_cast<std::size_t>(phase >> 27U);
  if (phase_increment < 35'000'000U) {
    return kSawLow[index];
  }
  if (phase_increment < 70'000'000U) {
    return kSawMedium[index];
  }
  return kSawHigh[index];
}

[[nodiscard]] constexpr std::uint32_t MixWord(std::uint32_t value) noexcept {
  value ^= value >> 16U;
  value *= 0x7feb'352dU;
  value ^= value >> 15U;
  value *= 0x846c'a68bU;
  value ^= value >> 16U;
  return value;
}

[[nodiscard]] constexpr std::uint32_t ColorMidi(CueColor color) noexcept {
  const std::size_t index =
      IsColor(color) ? static_cast<std::size_t>(color) : 0U;
  return static_cast<std::uint32_t>(kColorMidiNotes[index]);
}

[[nodiscard]] constexpr std::uint32_t NextLfsr(std::uint32_t lfsr) noexcept {
  const std::uint32_t feedback =
      (lfsr ^ (lfsr >> 2U) ^ (lfsr >> 3U) ^ (lfsr >> 5U)) & 1U;
  const std::uint32_t advanced = (lfsr >> 1U) | (feedback << 15U);
  return advanced == 0U ? kLfsrSeed : advanced;
}

[[nodiscard]] constexpr std::int16_t Saturate16(std::int64_t sample) noexcept {
  if (sample > std::numeric_limits<std::int16_t>::max()) {
    return std::numeric_limits<std::int16_t>::max();
  }
  if (sample < std::numeric_limits<std::int16_t>::min()) {
    return std::numeric_limits<std::int16_t>::min();
  }
  return static_cast<std::int16_t>(sample);
}

[[nodiscard]] constexpr std::uint32_t
AbsolutePcm(std::int16_t sample) noexcept {
  const std::int32_t widened = sample;
  return static_cast<std::uint32_t>(widened < 0 ? -widened : widened);
}

} // namespace

AudioCueQueue::AudioCueQueue() noexcept { Reset(); }

bool AudioCueQueue::Push(const AudioCue &cue) noexcept {
  if (!IsKnownCueKind(cue.kind)) {
    return false;
  }
  const std::uint32_t write = write_.load(std::memory_order_relaxed);
  const std::uint32_t read = read_.load(std::memory_order_acquire);
  const std::uint32_t used = write - read;
  if (used >= kCueCapacity) {
    return false;
  }
  if (!IsCriticalCue(cue.kind) && used >= kCueCapacity - kCueCriticalReserve) {
    return false;
  }
  slots_[write % kCueCapacity] = cue;
  write_.store(write + 1U, std::memory_order_release);
  return true;
}

bool AudioCueQueue::Pop(AudioCue &cue) noexcept {
  const std::uint32_t read = read_.load(std::memory_order_relaxed);
  const std::uint32_t write = write_.load(std::memory_order_acquire);
  if (read == write) {
    return false;
  }
  cue = slots_[read % kCueCapacity];
  read_.store(read + 1U, std::memory_order_release);
  return true;
}

std::size_t AudioCueQueue::Size() const noexcept {
  const std::uint32_t write = write_.load(std::memory_order_acquire);
  const std::uint32_t read = read_.load(std::memory_order_acquire);
  return static_cast<std::size_t>(write - read);
}

void AudioCueQueue::Reset() noexcept {
  read_.store(0U, std::memory_order_relaxed);
  write_.store(0U, std::memory_order_relaxed);
}

PixelAudioEngine::PixelAudioEngine(std::uint32_t sample_rate) noexcept
    : sample_rate_(sample_rate) {}

bool PixelAudioEngine::Initialize() noexcept {
  if (sample_rate_ < kMinimumSampleRate || sample_rate_ > kMaximumSampleRate) {
    return false;
  }
  if (!LoadScore(TuxScore())) {
    return false;
  }
  initialized_ = true;
  return true;
}

bool PixelAudioEngine::LoadScore(const ScoreDefinition &score) noexcept {
  if (!ValidateScore(score).ok()) {
    return false;
  }
  score_ = score;
  const std::uint64_t denominator =
      static_cast<std::uint64_t>(score_.tempo_bpm) * score_.ticks_per_beat;
  samples_per_tick_q32_ =
      ((static_cast<std::uint64_t>(sample_rate_) * 60U) << 32U) / denominator;
  ResetTransport();
  return samples_per_tick_q32_ != 0U;
}

bool PixelAudioEngine::PushCue(const AudioCue &cue) noexcept {
  if (!IsKnownCueKind(cue.kind)) {
    ++diagnostics_.dropped_cues;
    return false;
  }
  const bool requires_color = cue.kind == CueKind::Selection ||
                              cue.kind == CueKind::ShelfStore ||
                              cue.kind == CueKind::TargetPlace;
  if (requires_color && !IsColor(cue.color)) {
    ++diagnostics_.dropped_cues;
    return false;
  }
  if (cue.kind == CueKind::Restart) {
    if (cue_queue_.Push(cue)) {
      won_submitted_.store(false, std::memory_order_release);
      return true;
    }
    ++diagnostics_.dropped_cues;
    return false;
  }
  if (cue.kind == CueKind::Won) {
    bool expected = false;
    if (!won_submitted_.compare_exchange_strong(expected, true,
                                                std::memory_order_acq_rel,
                                                std::memory_order_acquire)) {
      return true;
    }
    if (cue_queue_.Push(cue)) {
      return true;
    }
    won_submitted_.store(false, std::memory_order_release);
    ++diagnostics_.dropped_cues;
    return false;
  }
  if (cue_queue_.Push(cue)) {
    return true;
  }
  ++diagnostics_.dropped_cues;
  return false;
}

void PixelAudioEngine::SetMuted(bool muted) noexcept {
  muted_requested_.store(muted, std::memory_order_release);
}

bool PixelAudioEngine::muted() const noexcept {
  return muted_requested_.load(std::memory_order_acquire);
}

void PixelAudioEngine::Render(std::int16_t *output,
                              std::size_t frames) noexcept {
  if (output == nullptr || frames == 0U) {
    return;
  }
  ++diagnostics_.render_callbacks;
  if (!initialized_) {
    std::fill_n(output, frames, static_cast<std::int16_t>(0));
    return;
  }
  DrainCues();
  for (std::size_t index = 0; index < frames; ++index) {
    output[index] = RenderOne();
  }
  RefreshVoiceDiagnostics();
}

void PixelAudioEngine::RenderInterleavedFloat(float *output, std::size_t frames,
                                              std::uint32_t channels) noexcept {
  if (output == nullptr || frames == 0U || channels == 0U) {
    return;
  }
  ++diagnostics_.render_callbacks;
  if (!initialized_) {
    std::fill_n(output, frames * channels, 0.0F);
    return;
  }
  DrainCues();
  for (std::size_t frame = 0; frame < frames; ++frame) {
    const float sample = static_cast<float>(RenderOne()) / 32'768.0F;
    const std::size_t offset = frame * channels;
    for (std::uint32_t channel = 0; channel < channels; ++channel) {
      output[offset + channel] = sample;
    }
  }
  RefreshVoiceDiagnostics();
}

AudioDiagnostics PixelAudioEngine::diagnostics() const noexcept {
  return diagnostics_;
}

std::uint32_t PixelAudioEngine::sample_rate() const noexcept {
  return sample_rate_;
}

std::size_t PixelAudioEngine::pending_cues() const noexcept {
  return cue_queue_.Size();
}

void PixelAudioEngine::ResetTransport() noexcept {
  music_voices_.fill({});
  effect_voices_.fill({});
  cue_queue_.Reset();
  muted_requested_.store(false, std::memory_order_release);
  won_submitted_.store(false, std::memory_order_release);
  master_gain_q15_ = kQ15Maximum;
  transport_sample_q32_ = 0;
  next_tick_q32_ = 0;
  transport_tick_ = 0;
  voice_age_ = 0;
  active_layer_ = 0;
  pending_layer_ = 0;
  victory_pending_ = false;
  victory_started_ = false;
  victory_start_tick_ = 0;
  diagnostics_ = {};
}

void PixelAudioEngine::RestartForReplay() noexcept {
  music_voices_.fill({});
  effect_voices_.fill({});
  won_submitted_.store(false, std::memory_order_release);
  transport_sample_q32_ = 0;
  next_tick_q32_ = 0;
  transport_tick_ = 0;
  voice_age_ = 0;
  active_layer_ = 0;
  pending_layer_ = 0;
  victory_pending_ = false;
  victory_started_ = false;
  victory_start_tick_ = 0;
}

void PixelAudioEngine::DrainCues() noexcept {
  AudioCue cue{};
  for (std::size_t count = 0; count < kMaxCuesPerRender && cue_queue_.Pop(cue);
       ++count) {
    ApplyCue(cue);
    ++diagnostics_.cues_consumed;
  }
}

void PixelAudioEngine::ApplyCue(const AudioCue &cue) noexcept {
  switch (cue.kind) {
  case CueKind::Selection:
    TriggerEffect(InstrumentId::Selection,
                  static_cast<std::int32_t>(ColorMidi(cue.color)),
                  52U + std::min<std::uint32_t>(cue.primary, 6U) * 4U);
    return;
  case CueKind::ShelfStore:
    TriggerEffect(InstrumentId::Shelf,
                  static_cast<std::int32_t>(ColorMidi(cue.color)) - 12,
                  82U + std::min<std::uint32_t>(cue.primary, 6U) * 5U);
    return;
  case CueKind::TargetPlace: {
    const std::uint32_t chord_size = std::min<std::uint32_t>(
        kPlacementIntervals.size(), std::max<std::uint32_t>(1U, cue.primary));
    for (std::uint32_t index = 0; index < chord_size; ++index) {
      TriggerEffect(InstrumentId::Placement,
                    static_cast<std::int32_t>(ColorMidi(cue.color)) +
                        kPlacementIntervals[index],
                    96U + index * 16U);
    }
    return;
  }
  case CueKind::ShelfCompact:
    TriggerEffect(InstrumentId::Compact,
                  48 + static_cast<std::int32_t>(cue.primary % 12U), 42U);
    return;
  case CueKind::Rejected:
    TriggerEffect(InstrumentId::Rejected,
                  62 + static_cast<std::int32_t>(cue.primary % 8U), 76U);
    return;
  case CueKind::Progress: {
    if (cue.secondary == 0U) {
      return;
    }
    const std::uint32_t percent =
        (static_cast<std::uint32_t>(cue.primary) * 100U) / cue.secondary;
    std::uint8_t requested_layer = 0;
    for (std::size_t index = 0; index < score_.layer_threshold_percent.size();
         ++index) {
      if (percent >= score_.layer_threshold_percent[index]) {
        requested_layer = static_cast<std::uint8_t>(index + 1U);
      }
    }
    if (requested_layer > pending_layer_) {
      pending_layer_ = requested_layer;
      TriggerEffect(InstrumentId::Progress, 72 + requested_layer * 3, 110U);
    }
    return;
  }
  case CueKind::Restart:
    RestartForReplay();
    return;
  case CueKind::Won:
    if (!victory_started_) {
      victory_pending_ = true;
    }
    return;
  }
}

void PixelAudioEngine::ProcessScoreTick() noexcept {
  const std::uint32_t ticks_per_bar =
      static_cast<std::uint32_t>(score_.ticks_per_beat) * score_.beats_per_bar;
  const std::uint32_t loop_ticks = ticks_per_bar * score_.loop_bars;
  const std::uint32_t tick_in_loop =
      static_cast<std::uint32_t>(transport_tick_ % loop_ticks);
  const std::uint32_t tick_in_bar = tick_in_loop % ticks_per_bar;
  const std::uint32_t bar_index = tick_in_loop / ticks_per_bar;

  if (victory_started_) {
    ProcessVictoryTick(
        static_cast<std::uint32_t>(transport_tick_ - victory_start_tick_));
    ++transport_tick_;
    return;
  }

  if (tick_in_bar == 0U) {
    if (victory_pending_) {
      victory_pending_ = false;
      victory_started_ = true;
      victory_start_tick_ = transport_tick_;
      ++diagnostics_.fanfare_count;
      ProcessVictoryTick(0U);
      ++transport_tick_;
      return;
    }
    active_layer_ = pending_layer_;
    ScheduleBar(bar_index);
  }

  if (tick_in_bar % score_.ticks_per_beat == 0U) {
    const ChordDefinition &chord =
        score_.chord_progression[bar_index % score_.chord_progression.size()];
    TriggerMusic(score_.instrument_assignments[1],
                 ScaleMidi(chord.scale_degrees[0], 0),
                 score_.ticks_per_beat - 2U);
    if (active_layer_ >= 2U &&
        tick_in_bar % (score_.ticks_per_beat * 2U) == 0U) {
      TriggerMusic(score_.instrument_assignments[3],
                   ScaleMidi(chord.scale_degrees[2], 2), score_.ticks_per_beat);
    }
  }

  const std::uint32_t sixteenth_ticks = ticks_per_bar / 16U;
  if (sixteenth_ticks != 0U && tick_in_bar % sixteenth_ticks == 0U) {
    ScheduleMelody(tick_in_bar, bar_index);
  }
  ++transport_tick_;
}

void PixelAudioEngine::ProcessVictoryTick(
    std::uint32_t elapsed_ticks) noexcept {
  for (std::size_t index = 0; index < kFanfareOffsets.size(); ++index) {
    if (elapsed_ticks == kFanfareOffsets[index]) {
      const std::uint32_t duration = index + 1U == kFanfareOffsets.size()
                                         ? score_.ticks_per_beat * 7U
                                         : score_.ticks_per_beat;
      TriggerMusic(InstrumentId::Fanfare, kFanfareNotes[index], duration);
    }
  }
}

void PixelAudioEngine::ScheduleBar(std::uint32_t bar_index) noexcept {
  const ChordDefinition &chord =
      score_.chord_progression[bar_index % score_.chord_progression.size()];
  const std::uint32_t pad_duration =
      static_cast<std::uint32_t>(score_.ticks_per_beat) * score_.beats_per_bar -
      4U;
  const std::size_t chord_voice_count = active_layer_ >= 1U ? chord.count : 3U;
  for (std::size_t index = 0; index < chord_voice_count; ++index) {
    TriggerMusic(score_.instrument_assignments[2],
                 ScaleMidi(chord.scale_degrees[index], 1), pad_duration);
  }
}

void PixelAudioEngine::ScheduleMelody(std::uint32_t tick_in_bar,
                                      std::uint32_t bar_index) noexcept {
  const std::uint32_t ticks_per_bar =
      static_cast<std::uint32_t>(score_.ticks_per_beat) * score_.beats_per_bar;
  const std::uint32_t sixteenth_ticks = ticks_per_bar / 16U;
  const std::uint32_t slot = tick_in_bar / sixteenth_ticks;
  const std::uint64_t loop_ticks =
      static_cast<std::uint64_t>(ticks_per_bar) * score_.loop_bars;
  const std::uint64_t loop_index = transport_tick_ / loop_ticks;
  const std::uint32_t variation = VariationWord(bar_index);
  const std::uint16_t rhythm =
      score_.rhythm_masks[(bar_index + static_cast<std::uint32_t>(loop_index)) %
                          score_.rhythm_masks.size()];
  if ((rhythm & (std::uint16_t{1} << (15U - slot))) == 0U) {
    return;
  }
  if ((score_.permitted_transforms & kTransformBoundedOmission) != 0U &&
      ((variation >> ((slot % 8U) * 4U)) & 0x0fU) == 0U) {
    return;
  }

  std::uint32_t motif_index = slot % score_.motif_degrees.size();
  if ((score_.permitted_transforms & kTransformMotifRotation) != 0U) {
    motif_index =
        (motif_index + (variation & 0x07U)) % score_.motif_degrees.size();
  }
  std::uint8_t degree = score_.motif_degrees[motif_index];
  const ChordDefinition &chord =
      score_.chord_progression[bar_index % score_.chord_progression.size()];
  if ((score_.permitted_transforms & kTransformChordToneSubstitution) != 0U &&
      ((variation >> 8U) & 0x03U) == 0U) {
    degree = chord.scale_degrees[(slot + (variation >> 12U)) % chord.count];
  }
  std::int32_t octave = 2;
  if ((score_.permitted_transforms & kTransformOctaveDisplacement) != 0U) {
    octave += static_cast<std::int32_t>((variation >> 20U) % 3U) - 1;
  }
  TriggerMusic(score_.instrument_assignments[0], ScaleMidi(degree, octave),
               sixteenth_ticks + 2U);

  if (active_layer_ >= 3U && slot % 4U == 2U) {
    TriggerMusic(score_.instrument_assignments[3],
                 ScaleMidi(chord.scale_degrees[1], octave + 1),
                 sixteenth_ticks);
  }
}

void PixelAudioEngine::TriggerMusic(InstrumentId id, std::int32_t midi_note,
                                    std::uint32_t duration_ticks) noexcept {
  const std::uint32_t duration =
      std::max<std::uint32_t>(1U, SamplesForTicks(duration_ticks));
  StartVoice(music_voices_, Instrument(id), midi_note, duration);
}

void PixelAudioEngine::TriggerEffect(InstrumentId id, std::int32_t midi_note,
                                     std::uint32_t duration_ms) noexcept {
  const std::uint32_t duration =
      std::max<std::uint32_t>(1U, MillisecondsToSamples(duration_ms));
  StartVoice(effect_voices_, Instrument(id), midi_note, duration);
}

void PixelAudioEngine::StartVoice(std::array<Voice, kMaxMusicVoices> &voices,
                                  const InstrumentSpec &instrument,
                                  std::int32_t midi_note,
                                  std::uint32_t duration_samples) noexcept {
  const std::size_t pool_size =
      std::min<std::size_t>(score_.max_music_voices, voices.size());
  Voice *selected = &voices[0];
  for (std::size_t index = 0; index < pool_size; ++index) {
    Voice &voice = voices[index];
    if (!voice.active) {
      selected = &voice;
      break;
    }
    if (voice.age < selected->age) {
      selected = &voice;
    }
  }
  ConfigureVoice(*selected, instrument, midi_note, duration_samples);
}

void PixelAudioEngine::StartVoice(std::array<Voice, kMaxEffectVoices> &voices,
                                  const InstrumentSpec &instrument,
                                  std::int32_t midi_note,
                                  std::uint32_t duration_samples) noexcept {
  Voice *selected = &voices[0];
  for (Voice &voice : voices) {
    if (!voice.active) {
      selected = &voice;
      break;
    }
    if (voice.age < selected->age) {
      selected = &voice;
    }
  }
  ConfigureVoice(*selected, instrument, midi_note, duration_samples);
}

void PixelAudioEngine::ConfigureVoice(Voice &voice,
                                      const InstrumentSpec &instrument,
                                      std::int32_t midi_note,
                                      std::uint32_t duration_samples) noexcept {
  voice = {};
  voice.instrument = instrument;
  const std::int32_t clamped_note = std::clamp(midi_note, 36, 84);
  voice.midi_note = static_cast<std::uint8_t>(clamped_note);
  voice.target_phase_increment = PhaseIncrementForMidi(clamped_note);
  const std::int32_t start_note =
      std::clamp(clamped_note + instrument.pitch_start_semitones, 36, 84);
  voice.phase_increment = PhaseIncrementForMidi(start_note);
  const std::uint32_t portamento_samples =
      MillisecondsToSamples(instrument.portamento_ms);
  const std::uint32_t pitch_distance =
      voice.phase_increment > voice.target_phase_increment
          ? voice.phase_increment - voice.target_phase_increment
          : voice.target_phase_increment - voice.phase_increment;
  voice.portamento_step =
      portamento_samples == 0U
          ? pitch_distance
          : std::max<std::uint32_t>(1U, pitch_distance / portamento_samples);
  voice.vibrato_increment = static_cast<std::uint32_t>(
      (static_cast<std::uint64_t>(instrument.vibrato_rate_hz) << 32U) /
      sample_rate_);
  voice.duration_remaining = duration_samples;
  voice.release_samples =
      std::max<std::uint32_t>(1U, MillisecondsToSamples(instrument.release_ms));
  voice.arpeggio_period = MillisecondsToSamples(instrument.arpeggio_period_ms);
  voice.arpeggio_remaining = voice.arpeggio_period;
  voice.duty_q16 = static_cast<std::uint32_t>(instrument.duty_q8) << 8U;
  voice.lfsr = kLfsrSeed ^ static_cast<std::uint32_t>(++voice_age_);
  voice.age = voice_age_;
  voice.active = true;

  const std::uint32_t attack_samples =
      MillisecondsToSamples(instrument.attack_ms);
  if (attack_samples == 0U) {
    voice.envelope_q16 = kQ16Maximum;
    voice.envelope_stage = EnvelopeStage::Decay;
    const std::uint32_t decay_difference =
        kQ16Maximum - instrument.sustain_q15 * 2U;
    const std::uint32_t decay_samples =
        MillisecondsToSamples(instrument.decay_ms);
    voice.envelope_step_q16 =
        decay_samples == 0U
            ? decay_difference
            : std::max<std::uint32_t>(1U, decay_difference / decay_samples);
  } else {
    voice.envelope_stage = EnvelopeStage::Attack;
    voice.envelope_step_q16 =
        std::max<std::uint32_t>(1U, kQ16Maximum / attack_samples);
  }
}

std::int16_t PixelAudioEngine::RenderOne() noexcept {
  if (transport_sample_q32_ >= next_tick_q32_) {
    ProcessScoreTick();
    next_tick_q32_ += samples_per_tick_q32_;
  }

  std::int64_t mix = 0;
  for (Voice &voice : music_voices_) {
    mix += RenderVoice(voice);
  }
  for (Voice &voice : effect_voices_) {
    mix += RenderVoice(voice);
  }

  const std::uint32_t ramp_samples = std::max<std::uint32_t>(
      1U, MillisecondsToSamples(kMasterRampMilliseconds));
  const std::uint32_t ramp_step =
      std::max<std::uint32_t>(1U, kQ15Maximum / ramp_samples);
  const std::uint32_t target_gain =
      muted_requested_.load(std::memory_order_acquire) ? 0U : kQ15Maximum;
  if (master_gain_q15_ < target_gain) {
    master_gain_q15_ =
        std::min<std::uint32_t>(target_gain, master_gain_q15_ + ramp_step);
  } else if (master_gain_q15_ > target_gain) {
    master_gain_q15_ =
        master_gain_q15_ > ramp_step ? master_gain_q15_ - ramp_step : 0U;
  }
  mix = (mix * master_gain_q15_) >> 15U;
  const std::int16_t output = Saturate16(mix);
  diagnostics_.peak_absolute_sample =
      std::max(diagnostics_.peak_absolute_sample, AbsolutePcm(output));
  ++diagnostics_.rendered_frames;
  transport_sample_q32_ += kOneSampleQ32;
  return output;
}

std::int32_t PixelAudioEngine::RenderVoice(Voice &voice) noexcept {
  if (!voice.active) {
    return 0;
  }
  AdvanceEnvelope(voice);
  if (!voice.active) {
    return 0;
  }

  if (voice.instrument.arpeggio_count > 1U && voice.arpeggio_period != 0U) {
    if (voice.arpeggio_remaining == 0U) {
      const std::uint8_t arpeggio_count =
          std::min<std::uint8_t>(voice.instrument.arpeggio_count, 4U);
      voice.arpeggio_index = static_cast<std::uint8_t>(
          (voice.arpeggio_index + 1U) % arpeggio_count);
      const std::int32_t note =
          static_cast<std::int32_t>(voice.midi_note) +
          voice.instrument.arpeggio_semitones[voice.arpeggio_index];
      voice.target_phase_increment = PhaseIncrementForMidi(note);
      voice.arpeggio_remaining = voice.arpeggio_period;
    } else {
      --voice.arpeggio_remaining;
    }
  }

  if (voice.phase_increment < voice.target_phase_increment) {
    voice.phase_increment =
        std::min(voice.target_phase_increment,
                 voice.phase_increment + voice.portamento_step);
  } else if (voice.phase_increment > voice.target_phase_increment) {
    voice.phase_increment =
        voice.phase_increment > voice.portamento_step
            ? std::max(voice.target_phase_increment,
                       voice.phase_increment - voice.portamento_step)
            : voice.target_phase_increment;
  }

  std::uint32_t phase_increment = voice.phase_increment;
  if (voice.instrument.vibrato_depth_q15 != 0U) {
    const std::int32_t sine = SineQ15(voice.vibrato_phase);
    const std::int64_t delta = (static_cast<std::int64_t>(phase_increment) *
                                sine * voice.instrument.vibrato_depth_q15) >>
                               30U;
    phase_increment =
        ClampUnsigned(static_cast<std::int64_t>(phase_increment) + delta, 1U,
                      std::numeric_limits<std::uint32_t>::max());
    voice.vibrato_phase += voice.vibrato_increment;
  }

  std::int32_t raw = 0;
  switch (voice.instrument.waveform) {
  case Waveform::Pulse:
    raw = (voice.phase >> 16U) < voice.duty_q16 ? 32'767 : -32'768;
    break;
  case Waveform::Triangle:
    raw = TriangleQ15(voice.phase);
    break;
  case Waveform::Saw:
    raw = SawQ15(voice.phase, phase_increment);
    break;
  case Waveform::Fm: {
    const std::int32_t modulator = SineQ15(voice.mod_phase);
    const std::int64_t modulation =
        static_cast<std::int64_t>(modulator) * voice.instrument.fm_depth * 128;
    raw = SineQ15(voice.phase + static_cast<std::uint32_t>(modulation));
    voice.mod_phase += phase_increment * 2U;
    break;
  }
  case Waveform::Noise:
    voice.lfsr = NextLfsr(voice.lfsr);
    raw = (voice.lfsr & 1U) == 0U ? -32'768 : 32'767;
    voice.filtered_noise = (voice.filtered_noise * 3 + raw) / 4;
    raw = voice.filtered_noise;
    break;
  }
  voice.phase += phase_increment;
  const std::int64_t enveloped =
      (static_cast<std::int64_t>(raw) * voice.envelope_q16) >> 16U;
  const std::int64_t amplified = (enveloped * voice.instrument.gain_q15) >> 15U;
  return ClampInt32(amplified, std::numeric_limits<std::int32_t>::min(),
                    std::numeric_limits<std::int32_t>::max());
}

void PixelAudioEngine::AdvanceEnvelope(Voice &voice) noexcept {
  if (voice.duration_remaining > 0U) {
    --voice.duration_remaining;
    if (voice.duration_remaining == 0U) {
      BeginRelease(voice);
    }
  }
  switch (voice.envelope_stage) {
  case EnvelopeStage::Attack:
    if (voice.envelope_q16 + voice.envelope_step_q16 >= kQ16Maximum) {
      voice.envelope_q16 = kQ16Maximum;
      voice.envelope_stage = EnvelopeStage::Decay;
      const std::uint32_t sustain = voice.instrument.sustain_q15 * 2U;
      const std::uint32_t difference = kQ16Maximum - sustain;
      const std::uint32_t decay_samples =
          MillisecondsToSamples(voice.instrument.decay_ms);
      voice.envelope_step_q16 =
          decay_samples == 0U
              ? difference
              : std::max<std::uint32_t>(1U, difference / decay_samples);
    } else {
      voice.envelope_q16 += voice.envelope_step_q16;
    }
    return;
  case EnvelopeStage::Decay: {
    const std::uint32_t sustain = voice.instrument.sustain_q15 * 2U;
    if (voice.envelope_q16 <= sustain + voice.envelope_step_q16) {
      voice.envelope_q16 = sustain;
      voice.envelope_stage = EnvelopeStage::Sustain;
    } else {
      voice.envelope_q16 -= voice.envelope_step_q16;
    }
    return;
  }
  case EnvelopeStage::Sustain:
    return;
  case EnvelopeStage::Release:
    if (voice.envelope_q16 <= voice.envelope_step_q16) {
      voice.envelope_q16 = 0U;
      voice.envelope_stage = EnvelopeStage::Inactive;
      voice.active = false;
    } else {
      voice.envelope_q16 -= voice.envelope_step_q16;
    }
    return;
  case EnvelopeStage::Inactive:
    voice.active = false;
    return;
  }
}

void PixelAudioEngine::BeginRelease(Voice &voice) noexcept {
  if (voice.envelope_stage == EnvelopeStage::Release ||
      voice.envelope_stage == EnvelopeStage::Inactive) {
    return;
  }
  voice.envelope_stage = EnvelopeStage::Release;
  voice.envelope_step_q16 = std::max<std::uint32_t>(
      1U, (voice.envelope_q16 + voice.release_samples - 1U) /
              voice.release_samples);
}

std::uint32_t
PixelAudioEngine::SamplesForTicks(std::uint32_t ticks) const noexcept {
  const std::uint64_t samples = (samples_per_tick_q32_ * ticks) >> 32U;
  return samples > std::numeric_limits<std::uint32_t>::max()
             ? std::numeric_limits<std::uint32_t>::max()
             : static_cast<std::uint32_t>(samples);
}

std::uint32_t
PixelAudioEngine::PhaseIncrementForMidi(std::int32_t midi_note) const noexcept {
  const std::int32_t clamped = std::clamp(midi_note, 36, 84);
  const std::uint32_t at_reference =
      kPhaseIncrementsAt48k[static_cast<std::size_t>(clamped - 36)];
  return static_cast<std::uint32_t>(
      (static_cast<std::uint64_t>(at_reference) * kReferenceSampleRate) /
      sample_rate_);
}

std::uint32_t PixelAudioEngine::MillisecondsToSamples(
    std::uint32_t milliseconds) const noexcept {
  const std::uint64_t samples =
      (static_cast<std::uint64_t>(milliseconds) * sample_rate_) / 1'000U;
  return samples > std::numeric_limits<std::uint32_t>::max()
             ? std::numeric_limits<std::uint32_t>::max()
             : static_cast<std::uint32_t>(samples);
}

std::int32_t PixelAudioEngine::ScaleMidi(std::uint8_t degree,
                                         std::int32_t octave) const noexcept {
  const std::size_t scale_index =
      static_cast<std::size_t>(degree % score_.scale_count);
  return static_cast<std::int32_t>(score_.scale_root_midi) +
         score_.scale_semitones[scale_index] + octave * 12;
}

std::uint32_t
PixelAudioEngine::VariationWord(std::uint32_t bar_index) const noexcept {
  const std::uint32_t ticks_per_bar =
      static_cast<std::uint32_t>(score_.ticks_per_beat) * score_.beats_per_bar;
  const std::uint64_t loop_ticks =
      static_cast<std::uint64_t>(ticks_per_bar) * score_.loop_bars;
  const std::uint32_t loop_index =
      static_cast<std::uint32_t>(transport_tick_ / loop_ticks);
  return MixWord(score_.seed ^ (loop_index * 0x9e37'79b9U) ^
                 (bar_index * 0x85eb'ca6bU));
}

void PixelAudioEngine::RefreshVoiceDiagnostics() noexcept {
  std::uint16_t music_count = 0;
  for (const Voice &voice : music_voices_) {
    if (voice.active) {
      ++music_count;
    }
  }
  std::uint16_t effect_count = 0;
  for (const Voice &voice : effect_voices_) {
    if (voice.active) {
      ++effect_count;
    }
  }
  diagnostics_.active_music_voices = music_count;
  diagnostics_.active_effect_voices = effect_count;
}

std::uint64_t HashPcmFNV1a(std::span<const std::int16_t> samples) noexcept {
  std::uint64_t hash = 14'695'981'039'346'656'037ULL;
  for (const std::int16_t sample : samples) {
    const std::uint16_t bits = static_cast<std::uint16_t>(sample);
    hash ^= bits & 0xffU;
    hash *= 1'099'511'628'211ULL;
    hash ^= bits >> 8U;
    hash *= 1'099'511'628'211ULL;
  }
  return hash;
}

} // namespace brilliant_sort::audio
