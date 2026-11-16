// Audio: a procedural synth, no files. Two detuned oscillators through a moving
// low-pass are the hoverbike engine; filtered noise is the wind and the impacts.
// Nothing is created until the first input, as browsers require.

export class Synth {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.wind = null;
    this.muted = false;
    this.ready = false;
  }

  start() {
    if (this.ready) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    this.context = context;

    this.master = context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(context.destination);

    // Engine: saw plus a fifth above, through a low-pass that opens with speed.
    const engineGain = context.createGain();
    engineGain.gain.value = 0.0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 6;

    const saw = context.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 68;
    const square = context.createOscillator();
    square.type = 'square';
    square.frequency.value = 101;
    const sub = context.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 34;

    saw.connect(filter);
    square.connect(filter);
    sub.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(this.master);
    saw.start();
    square.start();
    sub.start();

    this.engine = { gain: engineGain, filter, saw, square, sub };

    // Wind: looping noise through a band-pass.
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.7;
    const windGain = context.createGain();
    windGain.gain.value = 0.0;
    noise.connect(band);
    band.connect(windGain);
    windGain.connect(this.master);
    noise.start();
    this.wind = { gain: windGain, band };

    this.ready = true;
  }

  resume() {
    if (this.context && this.context.state === 'suspended') this.context.resume();
  }

  // speedRatio 0..1, plus a lean value for a little stereo-ish wobble.
  setEngine(speedRatio, lean) {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime;
    const t = Math.max(0, Math.min(1, speedRatio));
    this.engine.saw.frequency.setTargetAtTime(62 + t * 132, now, 0.12);
    this.engine.square.frequency.setTargetAtTime(94 + t * 196 + lean * 4, now, 0.12);
    this.engine.sub.frequency.setTargetAtTime(32 + t * 46, now, 0.12);
    this.engine.filter.frequency.setTargetAtTime(560 + t * 3400, now, 0.1);
    this.engine.gain.gain.setTargetAtTime(0.11 + t * 0.1, now, 0.15);
    this.wind.gain.gain.setTargetAtTime(0.02 + t * 0.1, now, 0.2);
    this.wind.band.frequency.setTargetAtTime(700 + t * 2200, now, 0.2);
  }

  silenceEngine() {
    if (!this.ready) return;
    const now = this.context.currentTime;
    this.engine.gain.gain.setTargetAtTime(0, now, 0.08);
    this.wind.gain.gain.setTargetAtTime(0, now, 0.08);
  }

  tone(frequency, duration, type = 'sine', volume = 0.2, slideTo = null) {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  noise(duration, volume, frequency, type = 'bandpass') {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const band = this.context.createBiquadFilter();
    band.type = type;
    band.frequency.value = frequency;
    band.Q.value = 1.1;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(band);
    band.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  ring() {
    this.tone(760, 0.1, 'triangle', 0.16, 1180);
    this.tone(1520, 0.08, 'sine', 0.07, 2200);
  }

  gate() {
    this.tone(320, 0.22, 'sawtooth', 0.1, 640);
    this.noise(0.24, 0.1, 1800, 'bandpass');
  }

  graze() {
    this.noise(0.1, 0.06, 3200, 'highpass');
  }

  crash() {
    this.noise(0.6, 0.35, 320, 'lowpass');
    this.tone(180, 0.7, 'sawtooth', 0.22, 42);
    this.tone(90, 0.9, 'sine', 0.18, 30);
  }

  ui() {
    this.tone(520, 0.07, 'square', 0.06, 700);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.05);
  }
}
