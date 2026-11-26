class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastKnockTime = 0;
  private lastClackTime = 0;
  private lastVibrateTime = 0;
  private lastHornTime = 0;
  private lastChimeTime = 0;
  private lastGeeseTime = 0;
  private lastParamotorTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public vibrate(pattern: number | number[]): void {
    if (this.muted || typeof navigator === 'undefined' || !navigator.vibrate) return;
    const now = performance.now();
    if (typeof pattern === 'number') {
      if (now - this.lastVibrateTime < 65) return;
      this.lastVibrateTime = now;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if vibration blocked
    }
  }

  public playWoodKnock(speed: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastKnockTime < 45) return;
    this.lastKnockTime = nowMs;

    const gainVal = Math.min(0.32, Math.max(0.03, (speed - 0.5) * 0.045));
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = 145 + Math.random() * 45;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.055);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, t);
    filter.Q.setValueAtTime(2.2, t);

    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);

    if (speed > 2.2) {
      this.vibrate(25);
    }
  }

  public playMarbleClack(speed: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastClackTime < 55) return;
    this.lastClackTime = nowMs;

    const t = ctx.currentTime;
    const gainVal = Math.min(0.28, Math.max(0.04, speed * 0.04));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450 + Math.random() * 250, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.04);

    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playCarHorn(): void {
    const ctx = this.ensureContext();
    this.vibrate([25, 45, 25]);
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastHornTime < 350) return;
    this.lastHornTime = nowMs;

    const t = ctx.currentTime;
    const bursts = [
      { start: t, dur: 0.095 },
      { start: t + 0.13, dur: 0.135 },
    ];

    for (const b of bursts) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(420, b.start);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(528, b.start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1350, b.start);

      gain.gain.setValueAtTime(0.001, b.start);
      gain.gain.linearRampToValueAtTime(0.13, b.start + 0.015);
      gain.gain.setValueAtTime(0.12, b.start + b.dur - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, b.start + b.dur);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(b.start);
      osc2.start(b.start);
      osc1.stop(b.start + b.dur + 0.01);
      osc2.stop(b.start + b.dur + 0.01);
    }
  }

  public playWaterBubbles(): void {
    const ctx = this.ensureContext();
    this.vibrate(30);
    if (!ctx) return;

    const t = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const start = t + i * 0.085 + Math.random() * 0.03;
      const dur = 0.075 + Math.random() * 0.04;
      const baseF = 240 + i * 38 + Math.random() * 80;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseF, start);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.95, start + dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + dur + 0.015);
    }
  }

  public playMagicChime(): void {
    const ctx = this.ensureContext();
    this.vibrate(20);
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastChimeTime < 220) return;
    this.lastChimeTime = nowMs;

    const t = ctx.currentTime;
    const notes = [987.77, 1318.51, 1567.98, 1975.53]; // B5 E6 G6 B6
    notes.forEach((f, idx) => {
      const start = t + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playGeeseHonk(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastGeeseTime < 4500) return;
    this.lastGeeseTime = nowMs;

    const t = ctx.currentTime;
    const calls = [0, 0.24, 0.56, 0.85];
    calls.forEach((offset, idx) => {
      const start = t + offset;
      const dur = 0.16;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const base = 420 + (idx % 3) * 45;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base * 0.92, start);
      osc.frequency.linearRampToValueAtTime(base * 1.14, start + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 0.85, start + dur);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(920, start);
      filter.Q.setValueAtTime(3.2, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }

  public playParamotorHum(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastParamotorTime < 7000) return;
    this.lastParamotorTime = nowMs;

    const t = ctx.currentTime;
    const dur = 3.2;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(76, t);
    osc.frequency.linearRampToValueAtTime(84, t + dur * 0.45);
    osc.frequency.linearRampToValueAtTime(68, t + dur);

    // Subtle propeller flutter
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14, t);
    lfoGain.gain.setValueAtTime(3.5, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.035, t + 0.7);
    gain.gain.setValueAtTime(0.032, t + dur - 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  public playTrapBell(): void {
    const ctx = this.ensureContext();
    this.vibrate([35, 30, 50]);
    if (!ctx) return;

    const t = ctx.currentTime;
    const freqs = [523.25, 392.0];
    freqs.forEach((f, idx) => {
      const start = t + idx * 0.11;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(f * 2.01, start);

      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc2.start(start);
      osc.stop(start + 0.48);
      osc2.stop(start + 0.48);
    });
  }

  public playTargetLock(index: number): void {
    const ctx = this.ensureContext();
    this.vibrate(35);
    if (!ctx) return;

    const t = ctx.currentTime;
    const base = 587.33 + index * 88;
    [base, base * 1.25].forEach((f, i) => {
      const start = t + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playVictoryFanfare(): void {
    const ctx = this.ensureContext();
    this.vibrate([40, 30, 40, 30, 90]);
    if (!ctx) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const start = t + idx * 0.095;
      const dur = idx === notes.length - 1 ? 0.75 : 0.32;

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(f * 2, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + dur + 0.03);
      overtone.stop(start + dur + 0.03);
    });
  }
}

export const soundEngine = new SoundEngine();
