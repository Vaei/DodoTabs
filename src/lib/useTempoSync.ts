import { useCallback, useEffect, useRef, useState } from "react";
import type { AlphaTabController } from "./useAlphaTab";
import {
  FFT_SIZE,
  NBINS,
  cosine,
  clearProfileStore,
  loadProfile,
  magSpectrum,
  saveProfile,
} from "./clickProfile";
import { DEFAULT_PROFILE } from "./defaultProfile";

// Listens to the microphone purely to find the metronome's *beat phase*, so
// playback can be started exactly on a click. The tempo itself is set manually
// (the BPM control), since reliable BPM detection from a mic — especially with a
// guitar playing over it — isn't dependable. An optional recorded "sound profile"
// (spectral template) makes onset detection more selective.

const INPUT_DEVICE_KEY = "dodotabs.inputDevice";
const SYNC_OFFSET_KEY = "dodotabs.syncOffsetMs";
const BUFFER_SIZE = 256;
const REFRACTORY_MS = 120;
const MATCH_THR = 0.6;
const CALIBRATION_MS = 6000;

export interface TempoSyncState {
  listening: boolean;
  level: number;
  beat: boolean; // a click was heard very recently (phase available)
  hasProfile: boolean;
  calibrating: boolean;
  profileClicks: number;
  error: string | null;
}

export interface TempoSyncController {
  state: TempoSyncState;
  start: () => Promise<void>;
  stop: () => void;
  msToNextBeat: () => number | null;
  recordProfile: () => Promise<void>;
  applyDefaultProfile: () => void;
  clearProfile: () => void;
}

export function useTempoSync(player: AlphaTabController): TempoSyncController {
  // Target tempo = song tempo * playback speed (mirrors the BPM control).
  const tempoRef = useRef(player.state.tempo);
  tempoRef.current = player.state.tempo;
  const speedRef = useRef(player.state.speed);
  speedRef.current = player.state.speed;

  const [state, setState] = useState<TempoSyncState>({
    listening: false,
    level: 0,
    beat: false,
    hasProfile: true, // ships with the built-in Wittner profile
    calibrating: false,
    profileClicks: 0,
    error: null,
  });

  // Audio graph
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const levelTimerRef = useRef<number | null>(null);

  // Onset detection
  const sampleRateRef = useRef(44100);
  const sampleClockRef = useRef(0);
  const floorRef = useRef(0);
  const peakEnvRef = useRef(0);
  const clickPeakRef = useRef(0);
  const armedRef = useRef(true);
  const lastOnsetMsRef = useRef(-1e9); // sample-clock ms (refractory)
  const lastOnsetPerfRef = useRef(0); // performance.now() of last click (beat indicator)
  const levelRef = useRef(0);
  // Smoothed beat-phase anchor (a simple PLL): on-grid clicks nudge it, off-grid
  // transients are ignored. Gives a far more stable phase than a single raw onset.
  const beatAnchorRef = useRef(0);
  const anchorValidRef = useRef(false);

  // Sound profile
  const profileRef = useRef<Float32Array | null>(loadProfile() ?? DEFAULT_PROFILE);
  const reBufRef = useRef(new Float32Array(FFT_SIZE));
  const imBufRef = useRef(new Float32Array(FFT_SIZE));
  const calibratingRef = useRef(false);
  const calibAccumRef = useRef<Float32Array | null>(null);
  const calibCountRef = useRef(0);

  const stop = useCallback(() => {
    if (levelTimerRef.current != null) clearInterval(levelTimerRef.current);
    levelTimerRef.current = null;
    if (procRef.current) procRef.current.onaudioprocess = null;
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    calibratingRef.current = false;
    setState((s) => ({ ...s, listening: false, beat: false, level: 0, calibrating: false }));
  }, []);

  const start = useCallback(async () => {
    if (ctxRef.current) return;
    setState((s) => ({ ...s, error: null }));
    try {
      const deviceId = localStorage.getItem(INPUT_DEVICE_KEY) || undefined;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const ctx = new AudioContext();
      await ctx.resume();
      sampleRateRef.current = ctx.sampleRate;

      const source = ctx.createMediaStreamSource(stream);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 300;
      const proc = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const sink = ctx.createGain();
      sink.gain.value = 0;

      source.connect(hp);
      hp.connect(proc);
      proc.connect(sink);
      sink.connect(ctx.destination);

      sampleClockRef.current = 0;
      floorRef.current = 0;
      peakEnvRef.current = 0;
      clickPeakRef.current = 0;
      armedRef.current = true;
      lastOnsetMsRef.current = -1e9;
      anchorValidRef.current = false;
      beatAnchorRef.current = 0;

      proc.onaudioprocess = (e) => {
        const buf = e.inputBuffer.getChannelData(0);
        const sr = sampleRateRef.current;
        const profile = profileRef.current;
        let blockPeak = 0;
        let env = peakEnvRef.current;
        let noise = floorRef.current;
        let armed = armedRef.current;
        const clickPeak = clickPeakRef.current;
        const baseIndex = sampleClockRef.current;
        let candidateMs = -1;

        for (let i = 0; i < buf.length; i++) {
          const a = Math.abs(buf[i]);
          if (a > blockPeak) blockPeak = a;
          env = a > env ? a : env * 0.999;
          noise = noise * 0.9999 + a * 0.0001;
          const thr = Math.max(noise * 2.5, clickPeak * 0.3, 0.01);
          if (armed && env > thr) {
            armed = false;
            const tMs = ((baseIndex + i) / sr) * 1000;
            if (candidateMs < 0 && tMs - lastOnsetMsRef.current > REFRACTORY_MS) {
              candidateMs = tMs;
            }
          } else if (!armed && env < thr * 0.5) {
            armed = true;
          }
        }

        if (candidateMs >= 0) {
          const vec = magSpectrum(buf, reBufRef.current, imBufRef.current);
          if (calibratingRef.current && calibAccumRef.current) {
            const acc = calibAccumRef.current;
            for (let b = 0; b < acc.length; b++) acc[b] += vec[b];
            calibCountRef.current++;
          }
          const accept = profile ? cosine(vec, profile) >= MATCH_THR : true;
          if (accept) {
            const nowPerf = performance.now();
            lastOnsetMsRef.current = candidateMs;
            lastOnsetPerfRef.current = nowPerf;
            clickPeakRef.current = clickPeak * 0.7 + blockPeak * 0.3;

            // Update the smoothed beat-phase anchor.
            const targetBpm = tempoRef.current * speedRef.current;
            if (targetBpm > 0) {
              const period = 60000 / targetBpm;
              if (!anchorValidRef.current || nowPerf - beatAnchorRef.current > 4000) {
                beatAnchorRef.current = nowPerf;
                anchorValidRef.current = true;
              } else {
                const k = Math.round((nowPerf - beatAnchorRef.current) / period);
                const err = nowPerf - (beatAnchorRef.current + k * period);
                // Only let near-grid clicks adjust the phase (rejects jitter/guitar).
                if (Math.abs(err) < period * 0.3) beatAnchorRef.current += err * 0.2;
              }
            }
          }
        }

        peakEnvRef.current = env;
        floorRef.current = noise;
        armedRef.current = armed;
        sampleClockRef.current = baseIndex + buf.length;
        levelRef.current = Math.min(1, blockPeak * 3);
      };

      ctxRef.current = ctx;
      streamRef.current = stream;
      procRef.current = proc;

      setState((s) => ({ ...s, listening: true, beat: false }));
      levelTimerRef.current = window.setInterval(() => {
        const beat = performance.now() - lastOnsetPerfRef.current < 1200;
        const clicks = calibratingRef.current ? calibCountRef.current : null;
        setState((s) => {
          if (
            Math.abs(s.level - levelRef.current) < 0.03 &&
            s.beat === beat &&
            (clicks == null || clicks === s.profileClicks)
          ) {
            return s;
          }
          return {
            ...s,
            level: levelRef.current,
            beat,
            profileClicks: clicks ?? s.profileClicks,
          };
        });
      }, 80);
    } catch (e) {
      setState((s) => ({
        ...s,
        listening: false,
        error: `Could not access the microphone: ${String((e as Error)?.message ?? e)}`,
      }));
    }
  }, []);

  // Milliseconds until the next metronome click (plus latency offset). The period
  // comes from the manually-set target tempo; the mic only supplies the phase.
  // Returns null if we don't have a tempo or haven't heard a click yet.
  const msToNextBeat = useCallback((): number | null => {
    const targetBpm = tempoRef.current * speedRef.current;
    if (targetBpm <= 0 || !anchorValidRef.current) return null;
    const periodMs = 60000 / targetBpm;
    const offset = Number.parseFloat(localStorage.getItem(SYNC_OFFSET_KEY) ?? "0") || 0;
    const now = performance.now();
    // Phase within the current beat, from the smoothed anchor. If we just passed a
    // beat (e.g. a loop that ended right on it), snap to it and start immediately;
    // otherwise wait for the next beat.
    let phase = (now - beatAnchorRef.current) % periodMs;
    if (phase < 0) phase += periodMs;
    const delay = phase <= periodMs * 0.25 ? 0 : periodMs - phase;
    return Math.max(0, delay + offset);
  }, []);

  const finishCalibration = useCallback(() => {
    calibratingRef.current = false;
    const acc = calibAccumRef.current;
    const count = calibCountRef.current;
    if (acc && count >= 3) {
      let norm = 0;
      for (let b = 0; b < acc.length; b++) {
        acc[b] /= count;
        norm += acc[b] * acc[b];
      }
      norm = Math.sqrt(norm) || 1;
      for (let b = 0; b < acc.length; b++) acc[b] /= norm;
      profileRef.current = acc;
      saveProfile(acc);
      setState((s) => ({ ...s, calibrating: false, hasProfile: true, error: null }));
    } else {
      setState((s) => ({
        ...s,
        calibrating: false,
        error: "No clear clicks detected. Run the metronome in a quiet room and try again.",
      }));
    }
  }, []);

  const recordProfile = useCallback(async () => {
    if (!ctxRef.current) await start();
    calibAccumRef.current = new Float32Array(NBINS);
    calibCountRef.current = 0;
    calibratingRef.current = true;
    setState((s) => ({ ...s, calibrating: true, profileClicks: 0, error: null }));
    window.setTimeout(finishCalibration, CALIBRATION_MS);
  }, [start, finishCalibration]);

  const applyDefaultProfile = useCallback(() => {
    profileRef.current = DEFAULT_PROFILE;
    saveProfile(DEFAULT_PROFILE);
    setState((s) => ({ ...s, hasProfile: true, error: null }));
  }, []);

  const clearProfile = useCallback(() => {
    profileRef.current = null;
    clearProfileStore();
    setState((s) => ({ ...s, hasProfile: false }));
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, msToNextBeat, recordProfile, applyDefaultProfile, clearProfile };
}
