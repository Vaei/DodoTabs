// A self-contained metronome count-in: plays `beats` clicks `intervalMs` apart, then
// calls `onDone` one beat after the last click (the downbeat). Used for the
// "count-in at full speed" option so the count-in tempo is independent of the
// playback speed, and so the song never sounds until the count-in is over. Returns a
// cancel function (stops pending clicks and the onDone callback).

// One shared AudioContext for the whole app. Browsers cap the number of contexts
// (~6), so creating one per count-in eventually throws and breaks playback.
let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  void sharedCtx.resume?.();
  return sharedCtx;
}

export function playCountIn(beats: number, intervalMs: number, onDone: () => void): () => void {
  const ctx = getCtx();
  if (!ctx || beats <= 0 || intervalMs <= 0) {
    onDone();
    return () => {};
  }

  const lead = 0.08; // small lead so the first click isn't clipped
  const interval = intervalMs / 1000;
  const oscillators: OscillatorNode[] = [];

  for (let i = 0; i < beats; i++) {
    const at = ctx.currentTime + lead + i * interval;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = i === 0 ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.06);
    oscillators.push(osc);
  }

  let cancelled = false;
  const doneTimer = window.setTimeout(
    () => {
      if (!cancelled) onDone();
    },
    (lead + beats * interval) * 1000
  );

  return () => {
    cancelled = true;
    window.clearTimeout(doneTimer);
    oscillators.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
  };
}
