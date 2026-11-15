import type { WeaponId } from './types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.noiseBuffer && this.ctx) {
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }

    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public playSwing(weapon: WeaponId, girLengthMeters = 3.5): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;
    const lenT =
      weapon === 'gir_sabuk'
        ? Math.max(0, Math.min(1, (girLengthMeters - 2) / 4))
        : 0.4;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq =
      weapon === 'sabit_modif'
        ? 1100
        : weapon === 'gir_sabuk'
          ? 1120 - lenT * 680
          : weapon === 'kayu_paku'
            ? 460
            : 1450;
    const dur =
      weapon === 'gir_sabuk' ? 0.14 + lenT * 0.28 : 0.18;

    filter.frequency.setValueAtTime(baseFreq * pitchVar, now);
    filter.frequency.exponentialRampToValueAtTime(
      baseFreq * 0.42 * pitchVar,
      now + dur * 0.85,
    );
    filter.Q.value = weapon === 'gir_sabuk' ? 3.0 + lenT * 1.2 : 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(weapon === 'gir_sabuk' ? 0.2 + lenT * 0.12 : 0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Metallic chain & sprocket rattle for gir_sabuk
    if (weapon === 'gir_sabuk') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const rattleStart = (1850 - lenT * 750) * pitchVar;
      osc.frequency.setValueAtTime(rattleStart, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(rattleStart * 0.52, now + dur * 0.85);
      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.065 + lenT * 0.03, now + 0.02);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now + 0.02);
      osc.stop(now + dur + 0.01);
    }
  }

  public playHit(heavy: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitchVar = 0.9 + Math.random() * 0.2;

    // Punchy low impact body
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((heavy ? 150 : 190) * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.16 : 0.11));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.42 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.18 : 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);

    // Crisp transient crack
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = heavy ? 800 : 1200;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(heavy ? 0.24 : 0.14, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.09);
    }
  }

  public playBlock(parry: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'square';
    osc2.type = 'triangle';
    const base = parry ? 980 : 520;
    osc1.frequency.setValueAtTime(base, now);
    osc2.frequency.setValueAtTime(base * 1.48, now);
    osc1.frequency.exponentialRampToValueAtTime(base * 0.88, now + (parry ? 0.28 : 0.14));

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = parry ? 2100 : 1100;
    filter.Q.value = parry ? 4.5 : 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(parry ? 0.28 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (parry ? 0.3 : 0.15));

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.31);
    osc2.stop(now + 0.31);
  }

  public playThrowFuse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // 1. Brisk arm throw whoosh
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = this.noiseBuffer;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(360, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(1150, now + 0.11);
    whooshFilter.Q.value = 1.4;
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.01, now);
    whooshGain.gain.linearRampToValueAtTime(0.18, now + 0.06);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshSrc.start(now);
    whooshSrc.stop(now + 0.17);

    // 2. Sizzling gunpowder fuse hiss
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now + 0.04);
    src.stop(now + 0.64);
  }

  public playPetasanBoom(big = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sharp gunpowder snap / crack transient
    const crack = ctx.createOscillator();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(big ? 580 : 820, now);
    crack.frequency.exponentialRampToValueAtTime(75, now + 0.055);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(big ? 0.36 : 0.28, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    crack.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(now);
    crack.stop(now + 0.065);

    // 2. Concussive sub boom
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(big ? 175 : 230, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + (big ? 0.38 : 0.22));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.58 : 0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (big ? 0.44 : 0.24));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.46);

    // 3. Firecracker blast noise + delayed urban street echo tail
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(6200, now);
      lp.frequency.exponentialRampToValueAtTime(380, now + (big ? 0.48 : 0.26));
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(big ? 0.52 : 0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (big ? 0.5 : 0.27));
      src.connect(lp);
      lp.connect(nGain);
      nGain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.52);

      // Street echo slapback ~95ms later
      const echoDelay = 0.095;
      const echoSrc = ctx.createBufferSource();
      echoSrc.buffer = this.noiseBuffer;
      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'bandpass';
      echoFilter.frequency.value = big ? 760 : 1100;
      echoFilter.Q.value = 0.9;
      const echoGain = ctx.createGain();
      echoGain.gain.setValueAtTime(big ? 0.18 : 0.1, now + echoDelay);
      echoGain.gain.exponentialRampToValueAtTime(0.001, now + echoDelay + (big ? 0.34 : 0.18));
      echoSrc.connect(echoFilter);
      echoFilter.connect(echoGain);
      echoGain.connect(ctx.destination);
      echoSrc.start(now + echoDelay);
      echoSrc.stop(now + echoDelay + 0.36);
    }
  }

  public playTelegraph(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playWaveCue(victory = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = victory ? [392, 493.88, 587.33, 783.99] : [293.66, 369.99, 440];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playDefeat(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [261.63, 220, 174.61];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playIntroBeat(beat: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (beat === 0) {
      // Mellow late-afternoon street chord
      [220, 277.18, 329.63].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now + i * 0.04);
        gain.gain.linearRampToValueAtTime(0.075, now + i * 0.04 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + 0.92);
      });
    } else if (beat === 1) {
      // Tense low confrontation pulse
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(82.41, now + 0.45);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 340;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.52);
    } else if (beat === 3) {
      // Ready-up combat sting
      [146.83, 220, 293.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + 0.44);
      });
    }
  }
}
