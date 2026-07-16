#include "pixel_audio.hpp"

#include <array>
#include <cstddef>
#include <cstdint>

namespace brilliant_sort::audio {
namespace {

constexpr InstrumentSpec kLead{
    Waveform::Pulse,
    116,
    1,
    0,
    4,
    42,
    20'480,
    80,
    7'600,
    5,
    460,
    18,
    0,
    0,
    0,
    {},
    {},
};

constexpr InstrumentSpec kBass{
    Waveform::Triangle,
    128,
    0,
    0,
    3,
    58,
    24'576,
    95,
    10'800,
    0,
    0,
    9,
    0,
    -5,
    0,
    {},
    {},
};

constexpr InstrumentSpec kPad{
    Waveform::Saw, 128, 0, 0, 18, 120, 16'384, 220, 4'200, 2,
    220,           0,   0, 0, 0,  {},  {},
};

constexpr InstrumentSpec kArp{
    Waveform::Fm,  128, 0, 3, 2, 38, 17'408, 72, 5'800, 6, 520, 0, 82, 0, 108,
    {0, 4, 7, 12}, {},
};

constexpr InstrumentSpec kSelection{
    Waveform::Pulse,
    92,
    2,
    0,
    1,
    25,
    18'432,
    52,
    11'500,
    8,
    290,
    0,
    0,
    0,
    0,
    {},
    {},
};

constexpr InstrumentSpec kShelf{
    Waveform::Triangle,
    128,
    0,
    0,
    2,
    44,
    16'384,
    80,
    9'200,
    0,
    0,
    8,
    0,
    -7,
    0,
    {},
    {},
};

constexpr InstrumentSpec kPlacement{
    Waveform::Saw, 128, 0, 0, 2, 34, 18'432, 92, 7'000, 4,
    180,           0,   0, 0, 0, {}, {},
};

constexpr InstrumentSpec kCompact{
    Waveform::Pulse,
    64,
    0,
    0,
    1,
    18,
    12'288,
    38,
    8'000,
    0,
    0,
    0,
    0,
    -12,
    0,
    {},
    {},
};

constexpr InstrumentSpec kRejected{
    Waveform::Noise,
    128,
    0,
    0,
    1,
    12,
    9'830,
    65,
    7'600,
    0,
    0,
    28,
    0,
    10,
    0,
    {},
    {},
};

constexpr InstrumentSpec kProgress{
    Waveform::Fm,   128, 0, 2, 3, 40, 16'384, 96, 5'000, 5, 360, 0, 96, 0, 84,
    {0, 7, 12, 19}, {},
};

constexpr InstrumentSpec kFanfare{
    Waveform::Fm, 128, 0, 0, 4,  80, 22'528, 180, 9'400, 5,
    420,          0,   0, 0, 76, {}, {},
};

constexpr std::array<InstrumentSpec,
                     static_cast<std::size_t>(InstrumentId::Count)>
    kInstruments{
        kLead,      kBass,    kPad,      kArp,      kSelection, kShelf,
        kPlacement, kCompact, kRejected, kProgress, kFanfare,
    };

constexpr ScoreDefinition MakeTuxScore() {
  ScoreDefinition score{};
  score.seed = 0x5455'5830U; // "TUX0"
  score.tempo_bpm = 104;
  score.ticks_per_beat = 24;
  score.beats_per_bar = 4;
  score.loop_bars = 48;
  score.max_music_voices = static_cast<std::uint8_t>(kMaxMusicVoices);
  score.permitted_transforms = kAllPermittedTransforms;
  score.scale_root_midi = 48; // C3
  score.scale_count = 7;
  score.scale_semitones = {0, 2, 4, 5, 7, 9, 11};
  score.layer_threshold_percent = {25, 50, 75};
  score.arrangement_layer_count = 4;
  score.section_bars = {12, 12, 12, 12};
  score.chord_progression = {
      ChordDefinition{{0, 2, 4, 6}, 4, {}},
      ChordDefinition{{5, 0, 2, 4}, 4, {}},
      ChordDefinition{{3, 5, 0, 2}, 4, {}},
      ChordDefinition{{4, 6, 1, 3}, 4, {}},
      ChordDefinition{{0, 2, 4, 6}, 4, {}},
      ChordDefinition{{2, 4, 6, 1}, 4, {}},
      ChordDefinition{{5, 0, 2, 4}, 4, {}},
      ChordDefinition{{4, 6, 1, 3}, 4, {}},
  };
  score.motif_degrees = {0, 2, 4, 2, 5, 4, 2, 1};
  score.rhythm_masks = {0b1010'1010'1010'1000U, 0b1000'1010'1000'1010U,
                        0b1010'0010'1010'0010U, 0b1000'1000'1010'1010U};
  score.instrument_assignments = {
      InstrumentId::Lead,
      InstrumentId::Bass,
      InstrumentId::Pad,
      InstrumentId::Arp,
  };
  return score;
}

constexpr ScoreDefinition kTuxScore = MakeTuxScore();

[[nodiscard]] constexpr bool IsSupportedInstrument(InstrumentId instrument) {
  return static_cast<std::uint8_t>(instrument) <
         static_cast<std::uint8_t>(InstrumentId::Count);
}

} // namespace

const ScoreDefinition &TuxScore() noexcept { return kTuxScore; }

const InstrumentSpec &Instrument(InstrumentId id) noexcept {
  const std::size_t index = static_cast<std::size_t>(id);
  return index < kInstruments.size() ? kInstruments[index]
                                     : kInstruments.front();
}

ScoreValidation ValidateScore(const ScoreDefinition &score) noexcept {
  if (score.seed == 0U) {
    return {ScoreError::MissingSeed};
  }
  if (score.tempo_bpm < 60U || score.tempo_bpm > 200U) {
    return {ScoreError::InvalidTempo};
  }
  if (score.ticks_per_beat < 12U || score.ticks_per_beat > 48U ||
      score.beats_per_bar == 0U) {
    return {ScoreError::InvalidTicks};
  }
  const std::uint64_t loop_seconds_numerator =
      static_cast<std::uint64_t>(score.loop_bars) * score.beats_per_bar * 60U;
  const std::uint64_t minimum_loop_numerator =
      static_cast<std::uint64_t>(score.tempo_bpm) * 90U;
  const std::uint64_t maximum_loop_numerator =
      static_cast<std::uint64_t>(score.tempo_bpm) * 120U;
  if (loop_seconds_numerator < minimum_loop_numerator ||
      loop_seconds_numerator > maximum_loop_numerator) {
    return {ScoreError::InvalidLoopDuration};
  }
  if (score.max_music_voices == 0U ||
      score.max_music_voices > kMaxMusicVoices) {
    return {ScoreError::InvalidVoiceBudget};
  }
  if (score.scale_count < 3U ||
      score.scale_count > score.scale_semitones.size()) {
    return {ScoreError::InvalidScale};
  }
  for (std::size_t index = 0; index < score.scale_count; ++index) {
    const std::int8_t degree = score.scale_semitones[index];
    if (degree < 0 || degree > 11 ||
        (index > 0U && degree <= score.scale_semitones[index - 1U])) {
      return {ScoreError::InvalidScale};
    }
  }
  if (score.arrangement_layer_count != 4U ||
      score.layer_threshold_percent[0] == 0U ||
      score.layer_threshold_percent[0] >= score.layer_threshold_percent[1] ||
      score.layer_threshold_percent[1] >= score.layer_threshold_percent[2] ||
      score.layer_threshold_percent[2] > 100U) {
    return {ScoreError::InvalidThresholds};
  }
  std::uint16_t section_total = 0;
  for (const std::uint8_t bars : score.section_bars) {
    if (bars == 0U) {
      return {ScoreError::InvalidSections};
    }
    section_total = static_cast<std::uint16_t>(section_total + bars);
  }
  if (section_total != score.loop_bars) {
    return {ScoreError::InvalidSections};
  }
  for (const ChordDefinition &chord : score.chord_progression) {
    if (chord.count < 3U || chord.count > chord.scale_degrees.size()) {
      return {ScoreError::InvalidChord};
    }
    for (std::size_t index = 0; index < chord.count; ++index) {
      if (chord.scale_degrees[index] >= score.scale_count) {
        return {ScoreError::InvalidChord};
      }
    }
  }
  for (const std::uint8_t degree : score.motif_degrees) {
    if (degree >= score.scale_count) {
      return {ScoreError::InvalidMotif};
    }
  }
  for (const std::uint16_t mask : score.rhythm_masks) {
    if (mask == 0U) {
      return {ScoreError::InvalidRhythm};
    }
  }
  for (const InstrumentId instrument : score.instrument_assignments) {
    if (!IsSupportedInstrument(instrument)) {
      return {ScoreError::UnsupportedInstrument};
    }
  }
  if ((score.permitted_transforms &
       static_cast<std::uint8_t>(~kAllPermittedTransforms)) != 0U ||
      score.permitted_transforms == 0U) {
    return {ScoreError::UnsupportedTransform};
  }
  return {};
}

} // namespace brilliant_sort::audio
