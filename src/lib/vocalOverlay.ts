import type * as alphaTab from "@coderline/alphatab";

/** When "1", vocal lyrics are stamped onto the other tracks so they show above whichever
 * track you view (Songsterr-style). Off by default. */
export const SHOW_VOCALS_ON_TRACK_KEY = "dodotabs.showVocalsOnTrack";

interface Word {
  tick: number; // absolute playback tick where the word is sung
  text: string;
}

// Harvest the lyrics from whichever tracks carry them, then stamp those words onto every
// other track's primary voice, placed by TIME (each word lands on the beat sounding at the
// same tick). This makes the vocal line appear above whatever track is displayed, like
// Songsterr, without merging tracks. It mutates beat.lyrics on the target tracks; reloading
// the file (a fresh score) undoes it. Returns true if any words were placed.
export function applyVocalOverlay(score: alphaTab.model.Score): boolean {
  // 1. Collect the sung words + their absolute ticks, and which tracks are lyric sources.
  const words: Word[] = [];
  const sourceTracks = new Set<number>();
  for (const track of score.tracks) {
    let hasLyrics = false;
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            const ly = beat.lyrics;
            if (!ly) continue;
            const text = ly.filter((s) => s && s.trim()).join(" ").trim();
            if (text) {
              hasLyrics = true;
              words.push({ tick: beat.absolutePlaybackStart, text });
            }
          }
        }
      }
    }
    if (hasLyrics) sourceTracks.add(track.index);
  }
  if (words.length === 0) return false;
  words.sort((a, b) => a.tick - b.tick);

  // 2. Stamp the words onto every track that doesn't already carry lyrics.
  let placed = false;
  for (const track of score.tracks) {
    if (sourceTracks.has(track.index)) continue;
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
