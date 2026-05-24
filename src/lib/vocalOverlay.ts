import type * as alphaTab from "@coderline/alphatab";

/** When "1", vocal lyrics are stamped onto the other tracks so they show above whichever
 * track you view (Songsterr-style). Off by default. */
export const SHOW_VOCALS_ON_TRACK_KEY = "dodotabs.showVocalsOnTrack";

interface Word {
  tick: number; // absolute playback tick where the word is sung
  text: string;
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

// Show the vocal line above whatever track is displayed (Songsterr-style), without merging
// tracks: pick the single vocal track, then stamp its words onto every other track's primary
// voice placed by TIME (each word lands on the beat sounding at the same tick). It mutates
// beat.lyrics on the target tracks; reloading the file (a fresh score) undoes it.
//
// The vocal track is the richest NON-percussion lyric track. Percussion is excluded because
// with beatTextAsLyrics on, drum sticking ("L"/"R") and instrument cues ("hi hat") look like
// lyrics and would otherwise get merged into the sung line. Returns true if any words placed.
export function applyVocalOverlay(score: alphaTab.model.Score): boolean {
  // 1. Choose the source (vocal) track: the non-percussion track with the most lyric beats.
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
  if (!source) return false;

  // 2. Harvest its sung words + their absolute ticks.
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
  if (words.length === 0) return false;
  words.sort((a, b) => a.tick - b.tick);

  // 3. Stamp the words onto every other track.
  const sourceIndex = source.index;
  let placed = false;
  for (const track of score.tracks) {
    if (track.index === sourceIndex) continue;
    const staff = track.staves[0];
    if (!staff) continue;

    // The track's primary-voice beats in tick order.
    const beats: alphaTab.model.Beat[] = [];
    for (const bar of staff.bars) {
      const voice = bar.voices[0];
      if (voice) beats.push(...voice.beats);
    }
    if (beats.length === 0) continue;
    beats.sort((a, b) => a.absolutePlaybackStart - b.absolutePlaybackStart);

    // Walk words and beats together; each word attaches to the beat sounding at its tick
    // (the latest beat starting at or before the word). Words before the first beat go to it.
    const buckets = new Map<alphaTab.model.Beat, string[]>();
    let bi = 0;
    for (const w of words) {
      while (bi + 1 < beats.length && beats[bi + 1].absolutePlaybackStart <= w.tick) bi++;
      const target = beats[bi];
      const arr = buckets.get(target);
      if (arr) arr.push(w.text);
      else buckets.set(target, [w.text]);
    }
    for (const [beat, texts] of buckets) {
      beat.lyrics = [texts.join(" ")];
      placed = true;
    }
  }
  return placed;
}
