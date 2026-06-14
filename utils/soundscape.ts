/**
 * Procedural Web Audio Soundscape Engine
 * Transitions seamlessly between:
 * - "Dawn" / "Morning": Calm, atmospheric orchestral drone with slow triangle string swells and pentatonic chord swells.
 * - "Noon" / "Afternoon": Shifting moods, wider frequencies and bright, resonant synth drones.
 * - "Sunset" / "Night" (Midnight): High-energy, glitchy heavy-synth minor chords, driving beats, and random metallic/cybernetic digital noises.
 */

type SolsticePhase = "dawn" | "morning" | "noon" | "afternoon" | "sunset" | "night";

export class SolsticeSoundscape {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private arpeggioGain: GainNode | null = null;
  private rhythmGain: GainNode | null = null;
  private activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

  private schedulerInterval: number | null = null;
  private currentStep = 0;
  private tempo = 75; // BPM
  private currentPhase: SolsticePhase = "dawn";
  private userVolume = 0.8;
  private soundEnabled = false;

  // Music state
  private lastScheduledTime = 0;
  private chordNotes: number[] = [60, 64, 67, 71, 74]; // Default: Cmaj9 in MIDI
  private melodyIndex = 0;

  constructor() {}

  /**
   * Initializes or returns the audio context safely
   */
  private initAudio() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.soundEnabled ? this.userVolume : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Sub-mix gains
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.droneGain.connect(this.masterGain);

      this.arpeggioGain = this.ctx.createGain();
      this.arpeggioGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.arpeggioGain.connect(this.masterGain);

      this.rhythmGain = this.ctx.createGain();
      this.rhythmGain.gain.setValueAtTime(0.95, this.ctx.currentTime);
      this.rhythmGain.connect(this.masterGain);

      // Start the core drone synthesizers
      this.startAmbientDrones();
    } catch (e) {
      console.error("Failed to initialize Web Audio Soundscape:", e);
    }
  }

  /**
   * Continuous orchestral structure.
   * Multi-oscillator detuned warmth.
   */
  private startAmbientDrones() {
    if (!this.ctx || !this.droneGain) return;

    // Create 3 detuned oscillators to make a rich chorus effect string swell
    const freqs = [110, 165, 220]; // A2, E3, A3
    
    freqs.forEach((freq, index) => {
      if (!this.ctx || !this.droneGain) return;
      const osc = this.ctx.createOscillator();
      const oGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Slow drift
      osc.type = index % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Fine detune for chorus drift
      osc.detune.setValueAtTime((index - 1) * 8, this.ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      filter.Q.setValueAtTime(2, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(oGain);
      oGain.connect(this.droneGain);

      oGain.gain.setValueAtTime(0.16, this.ctx.currentTime);

      // Low frequency oscillator (LFO) to swell the drone volume
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.1 + index * 0.05, this.ctx.currentTime); // very slow
      lfoGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(oGain.gain);

      osc.start();
      lfo.start();

      this.activeOscillators.push({ osc, gain: oGain });
    });
  }

  /**
   * Main scheduler loop runs every 120ms to prepare future synth events
   */
  private startScheduler() {
    this.initAudio();
    if (!this.ctx || this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.lastScheduledTime = this.ctx.currentTime;

    const stepDuration = 60 / (this.tempo * 4); // 16th note length in seconds

    // Schedule 16th note steps incrementally
    this.schedulerInterval = window.setInterval(() => {
      if (!this.ctx || !this.isPlaying) return;
      
      const lookahead = 0.2; // schedule 200ms ahead
      const currentTime = this.ctx.currentTime;

      while (this.lastScheduledTime < currentTime + lookahead) {
        this.scheduleStep(this.currentStep, this.lastScheduledTime);
        this.currentStep = (this.currentStep + 1) % 16;
        this.lastScheduledTime += 60 / (this.tempo * 4); // update next step target time
      }
    }, 100);
  }

  /**
   * Synthesize notes based on step index and current environment state
   */
  private scheduleStep(step: number, time: number) {
    if (!this.ctx || !this.arpeggioGain || !this.rhythmGain) return;

    // 1. CHORD PROGRESSIONS DEPENDING ON LIGHT OR DARKNESS
    // Dawn/Morning: Bright Major 7th, slow, spacious
    // Sunset/Night: Tense Minor 9, Diminished, fast and syncopated
    const isNightStyle = this.currentPhase === "night" || this.currentPhase === "sunset" || this.currentPhase === "afternoon";
    
    // Scale BPM and filters dynamically
    this.updateBpmAndGains();

    // Scheduling the Arp Lead
    // Skip sometimes on Dawn, play constantly on Night/Sunset
    const arpProbability = isNightStyle ? 0.8 : 0.45;
    if (Math.random() < arpProbability && step % 2 === 0) {
      const midiNote = this.chordNotes[this.melodyIndex % this.chordNotes.length];
      this.melodyIndex++;
      const freq = this.midiToFreq(midiNote + (isNightStyle ? (step % 3 === 0 ? 12 : 0) : 0));

      this.playSynthPluck(freq, time, isNightStyle);
    }

    // 2. RHYTHM & DRUMS SECTION - REMOVED PERCUSSIVE DRUMS FOR PURE AMBIENT/GLITCH SYNTH CHORDS
    if (!isNightStyle) {
      // Occasional faint crystal shimmer sweep
      if (step === 0 && Math.random() < 0.25) {
        this.playCrystalSweep(time);
      }
    }
  }

  /**
   * Beautiful major or tense cyber-synth arpeggiation pluck
   */
  private playSynthPluck(frequency: number, time: number, isGlitchy: boolean) {
    if (!this.ctx || !this.arpeggioGain) return;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.frequency.setValueAtTime(frequency, time);

    if (isGlitchy) {
      // Sharp, retro heavy synthesizer
      osc.type = Math.random() > 0.4 ? "sawtooth" : "square";
      filter.type = "lowpass";
      
      // Filter sweep envelope
      filter.frequency.setValueAtTime(1200, time);
      filter.frequency.exponentialRampToValueAtTime(150, time + 0.15);
      filter.Q.setValueAtTime(8, time);

      // Volume envelope (quick punchy decay)
      oscGain.gain.setValueAtTime(0.0, time);
      oscGain.gain.linearRampToValueAtTime(0.68, time + 0.005);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    } else {
      // Light, beautiful celestial bell/string
      osc.type = "triangle";
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, time);
      filter.Q.setValueAtTime(1.5, time);

      // Soft envelope
      oscGain.gain.setValueAtTime(0.0, time);
      oscGain.gain.linearRampToValueAtTime(0.48, time + 0.04);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    }

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.arpeggioGain);

    osc.start(time);
    osc.stop(time + (isGlitchy ? 0.35 : 0.8));
  }

  /**
   * cybernetic dark analog synthesizer kick
   */
  private playAnalogKick(time: number) {
    if (!this.ctx || !this.rhythmGain) return;

    const osc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();

    osc.type = "sine";
    // Pitch sweep
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);

    // Dynamic Volume Envelope - HIGH POWER LOUD
    kickGain.gain.setValueAtTime(1.45, time);
    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(kickGain);
    kickGain.connect(this.rhythmGain);

    osc.start(time);
    osc.stop(time + 0.28);
  }

  /**
   * Heartbeat style kick for Dawn/Morning (soft, low-end)
   */
  private playHeartbeatKick(time: number) {
    if (!this.ctx || !this.rhythmGain) return;

    const osc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(75, time);
    osc.frequency.setValueAtTime(40, time + 0.12);

    kickGain.gain.setValueAtTime(0.55, time);
    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(kickGain);
    kickGain.connect(this.rhythmGain);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  /**
   * Pure noise-driven glitchy snare with a filter sweeps
   */
  private playGlitchSnare(time: number) {
    if (!this.ctx || !this.rhythmGain) return;

    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms length
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Fill with random noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const snareGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1000, time);
    // Sunset/Night adds metallic resonant pitch
    filter.Q.setValueAtTime(5, time);

    // Volume envelope
    snareGain.gain.setValueAtTime(0.85, time);
    snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noiseNode.connect(filter);
    filter.connect(snareGain);
    snareGain.connect(this.rhythmGain);

    noiseNode.start(time);
    noiseNode.stop(time + 0.15);
  }

  /**
   * Metallic electronic hi-hat
   */
  private playGlitchHihat(time: number) {
    if (!this.ctx || !this.rhythmGain) return;

    const osc = this.ctx.createOscillator();
    const hatGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(11000, time);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, time);

    hatGain.gain.setValueAtTime(0.38, time);
    hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(filter);
    filter.connect(hatGain);
    hatGain.connect(this.rhythmGain);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  /**
   * Celestial crystal sweep (For Dawn/Morning relaxation)
   */
  private playCrystalSweep(time: number) {
    if (!this.ctx || !this.arpeggioGain) return;

    const osc = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, time);
    osc.frequency.exponentialRampToValueAtTime(1760, time + 0.9);

    sweepGain.gain.setValueAtTime(0.0, time);
    sweepGain.gain.linearRampToValueAtTime(0.04, time + 0.3);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);

    osc.connect(sweepGain);
    sweepGain.connect(this.arpeggioGain);

    osc.start(time);
    osc.stop(time + 0.95);
  }

  /**
   * Dynamic Tempo and Scale updating based on current game phase
   */
  private updateBpmAndGains() {
    if (!this.ctx || !this.droneGain || !this.arpeggioGain || !this.rhythmGain) return;

    const now = this.ctx.currentTime;

    switch (this.currentPhase) {
      case "dawn":
        this.tempo = 68;
        // Calm Major 9
        this.chordNotes = [48, 55, 60, 64, 67, 71, 74]; // C-G-C-E-G-B-D
        this.droneGain.gain.linearRampToValueAtTime(0.85, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.55, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(0.55, now + 0.1);
        break;

      case "morning":
        this.tempo = 75;
        // F Major 7 / 9
        this.chordNotes = [53, 57, 60, 64, 67, 72, 76]; // F-A-C-E-G-C-E
        this.droneGain.gain.linearRampToValueAtTime(0.78, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.62, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(0.65, now + 0.1);
        break;

      case "noon":
        this.tempo = 82;
        // G Mixolydian (Suspended)
        this.chordNotes = [55, 60, 62, 67, 69, 74, 79]; // G-C-D-G-A-D-G
        this.droneGain.gain.linearRampToValueAtTime(0.72, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.68, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(0.72, now + 0.1);
        break;

      case "afternoon":
        this.tempo = 95;
        // A Minor 9
        this.chordNotes = [45, 52, 57, 60, 64, 67, 71]; // A-E-A-C-E-G-B
        this.droneGain.gain.linearRampToValueAtTime(0.75, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.75, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(0.85, now + 0.1);
        break;

      case "sunset":
        this.tempo = 112;
        // D Phrygian (Dark Tension)
        this.chordNotes = [50, 51, 55, 58, 62, 63, 67]; // D-Eb-G-Bb-D-Eb-G
        this.droneGain.gain.linearRampToValueAtTime(0.82, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.82, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(0.95, now + 0.1);
        break;

      case "night":
        this.tempo = 126;
        // C# Locrian / Chromatic Cyberpunk
        this.chordNotes = [49, 50, 53, 56, 59, 62, 65]; // C#-D-F-G#-B-D-F (Intense cyber tension)
        this.droneGain.gain.linearRampToValueAtTime(0.98, now + 0.1);
        this.arpeggioGain.gain.linearRampToValueAtTime(0.95, now + 0.1);
        this.rhythmGain.gain.linearRampToValueAtTime(1.25, now + 0.1); // Dynamic & Loud Rhythms
        break;
    }
  }

  /**
   * API: Start the music soundscape
   */
  public start() {
    this.startScheduler();
  }

  /**
   * API: Stop scheduler and clean up nodes
   */
  public stop() {
    this.isPlaying = false;
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * API: Update volume slider (0.0 to 1.0)
   */
  public setVolume(vol: number) {
    this.userVolume = Math.max(0, Math.min(1.0, vol));
    if (this.ctx && this.masterGain && this.soundEnabled) {
      this.masterGain.gain.setValueAtTime(this.userVolume, this.ctx.currentTime);
    }
  }

  /**
   * API: Toggle sound enable state
   */
  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (this.ctx && this.masterGain) {
      const vol = enabled ? this.userVolume : 0;
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  /**
   * API: Update phase dynamically from game loop
   */
  public setPhase(phase: SolsticePhase) {
    if (this.currentPhase !== phase) {
      this.currentPhase = phase;
      this.updateBpmAndGains();
    }
  }

  private midiToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }
}

export const soundscape = new SolsticeSoundscape();
