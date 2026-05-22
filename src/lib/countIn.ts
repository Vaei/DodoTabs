// A self-contained metronome count-in: plays `beats` clicks `intervalMs` apart, then
// calls `onDone` one beat after the last click (the downbeat). Used for the
// "count-in at full speed" option so the count-in tempo is independent of the
// playback speed, and so the song never sounds until the count-in is over. Returns a
// cancel function (stops pending clicks and the onDone callback).
export function playCountIn(beats: number, intervalMs: number, onDone: () => void): () => void {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor || beats <= 0 || intervalMs <= 0) {
    onDone();
    return () => {};
  }

  const ctx = new Ctor();
  void ctx.resume?.();
  const lead = 0.08; // small lead so the first click isn't clipped
  const interval = intervalMs / 1000;

  const click = (at: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.06);
  };

  for (let i = 0; i < beats; i++) {
    click(ctx.currentTime + lead + i * interval, i === 0);
  }

  let cancelled = false;
  const close = () => ctx.close().catch(() => {});
  const doneTimer = window.setTimeout(() => {
    if (cancelled) return;
    onDone();
    close();
  }, (lead + beats * interval) * 1000);

  return () => {
    cancelled = true;
    window.clearTimeout(doneTimer);
    close(); // stops any still-scheduled clicks
  };
}
