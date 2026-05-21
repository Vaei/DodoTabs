// A "sound profile" is the normalised magnitude spectrum of the metronome click,
// captured during calibration. Live detection compares each transient's spectrum
// to it (cosine similarity), so clicks are recognised by their timbre at any
// volume, and unrelated transients are rejected.

export const FFT_SIZE = 256;
export const NBINS = FFT_SIZE / 2; // 128 (bin 0 = DC, ignored)

const PROFILE_KEY = "dodotabs.metronomeProfile";

// Hann window to reduce spectral leakage.
const hann = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// In-place iterative radix-2 FFT.
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = i + k + half;
        const vr = re[b] * cwr - im[b] * cwi;
        const vi = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = ncwr;
      }
    }
  }
}

/** Normalised magnitude spectrum (L2) of a block. `re`/`im` are reused scratch buffers. */
export function magSpectrum(block: Float32Array, re: Float32Array, im: Float32Array): Float32Array {
  for (let i = 0; i < FFT_SIZE; i++) {
    re[i] = block[i] * hann[i];
    im[i] = 0;
  }
  fft(re, im);
  const mag = new Float32Array(NBINS);
  let norm = 0;
  for (let b = 1; b < NBINS; b++) {
    const m = Math.hypot(re[b], im[b]);
    mag[b] = m;
    norm += m * m;
  }
  norm = Math.sqrt(norm) || 1;
  for (let b = 1; b < NBINS; b++) mag[b] /= norm;
  return mag;
}

/** Cosine similarity of two L2-normalised spectra (0..1). */
export function cosine(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 1; i < NBINS; i++) d += a[i] * b[i];
  return d;
}

export function loadProfile(): Float32Array | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== NBINS) return null;
    return Float32Array.from(arr);
  } catch {
    return null;
  }
}

export function saveProfile(v: Float32Array): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(Array.from(v)));
}

export function clearProfileStore(): void {
  localStorage.removeItem(PROFILE_KEY);
}
