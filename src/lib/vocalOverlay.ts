import type * as alphaTab from "@coderline/alphatab";

/** When "1", vocal lyrics are shown above the top-most displayed track (Songsterr-style).
 * Off by default. */
export const SHOW_VOCALS_ON_TRACK_KEY = "dodotabs.showVocalsOnTrack";

interface Word {
  tick: number; // absolute playback tick where the word is sung
  text: string;
}

export interface VocalSource {
  sourceIndex: number; // the track the lyrics came from (its own staff shows them natively)
  words: Word[]; // sung words in tick order
}

// Count the beats that carry lyric text in a track.
function lyricBeatCount(track: alphaTab.model.Track): number {
  let n = 0;
  for (const staff of track.staves)
    for (const bar of staff.bars)
      for (const voice of bar.voices)
        for (const beat of voice.beats) {
          const ly = beat.lyrics;
          if (ly && ly.some((s) => s && s.trim())) n++;
        }
  return n;
}

// Find the vocal line and its sung words. The vocal track is the richest NON-percussion
// lyric track; percussion is excluded because with beatTextAsLyrics on, drum sticking
// ("L"/"R") and instrument cues ("hi hat") look like lyrics. Returns null if none found.
export function harvestVocalWords(score: alphaTab.model.Score): VocalSource | null {
  let source: alphaTab.model.Track | null = null;
  let bestCount = 0;
  for (const track of score.tracks) {
    if (track.isPercussion) continue;
    const n = lyricBeatCount(track);
    if (n > bestCount) {
      bestCount = n;
      source = track;
    }
  }
  if (!source) return null;

  const words: Word[] = [];
  for (const staff of source.staves)
    for (const bar of staff.bars)
      for (const voice of bar.voices)
        for (const beat of voice.beats) {
          const ly = beat.lyrics;
          if (!ly) continue;
          const text = ly.filter((s) => s && s.trim()).join(" ").trim();
          if (text) words.push({ tick: beat.absolutePlaybackStart, text });
        }
  if (words.length === 0) return null;
  words.sort((a, b) => a.tick - b.tick);
  return { sourceIndex: source.index, words };
}

// Stamp the sung words onto a target track's primary voice, placed by TIME (each word lands
// on the beat sounding at the same tick). Returns the beats that were written, so the caller
// can clear them later (set their lyrics back to null) when the target changes.
export function stampVocals(track: alphaTab.model.Track, words: Word[]): alphaTab.model.Beat[] {
  const staff = track.staves[0];
  if (!staff) return [];
  const beats: alphaTab.model.Beat[] = [];
  for (const bar of staff.bars) {
    const voice = bar.voices[0];
    if (voice) beats.push(...voice.beats);
  }
  if (beats.length === 0) return [];
  beats.sort((a, b) => a.absolutePlaybackStart - b.absolutePlaybackStart);

  const buckets = new Map<alphaTab.model.Beat, string[]>();
  let bi = 0;
  for (const w of words) {
    while (bi + 1 < beats.length && beats[bi + 1].absolutePlaybackStart <= w.tick) bi++;
    const target = beats[bi];
    const arr = buckets.get(target);
    if (arr) arr.push(w.text);
    else buckets.set(target, [w.text]);
  }
  const stamped: alphaTab.model.Beat[] = [];
  for (const [beat, texts] of buckets) {
    beat.lyrics = [texts.join(" ")];
    stamped.push(beat);
  }
  return stamped;
}
