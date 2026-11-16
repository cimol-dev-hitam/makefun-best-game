// Input: keyboard steering with a little analogue feel from key ramping, mouse
// steering while the button is held, and a queue of discrete actions (pause,
// restart, confirm, mute) for the state machine to consume.

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const BRAKE_KEYS = ['ArrowDown', 'KeyS', 'Space'];
const CONFIRM_KEYS = ['Space', 'Enter'];
const PAUSE_KEYS = ['Escape', 'KeyP'];
const RESTART_KEYS = ['KeyR'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.actions = [];
    this.pointerDown = false;
    this.pointerX = 0;
    this.pointerY = 0;
    this.axis = 0;
    this.brake = false;
    this.anyInput = false;

    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });
    window.addEventListener('pointermove', (event) => {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
    });
  }

  onKeyDown(event) {
    const code = event.code;
    if (PAUSE_KEYS.includes(code) || RESTART_KEYS.includes(code) || BRAKE_KEYS.includes(code)) {
      event.preventDefault();
    }
    if (this.held.has(code)) return;
    this.held.add(code);
    this.anyInput = true;

    if (PAUSE_KEYS.includes(code)) this.actions.push('pause');
    if (RESTART_KEYS.includes(code)) this.actions.push('restart');
    if (CONFIRM_KEYS.includes(code)) this.actions.push('confirm');
    if (code === 'KeyM') this.actions.push('mute');
  }

  onKeyUp(event) {
    this.held.delete(event.code);
  }

  onPointerDown(event) {
    this.pointerDown = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.anyInput = true;
    this.actions.push('confirm');
  }

  anyHeld(codes) {
    for (const code of codes) if (this.held.has(code)) return true;
    return false;
  }

  // Called once per rendered frame, before the fixed-step simulation.
  update(viewWidth) {
    let target = 0;
    if (this.anyHeld(LEFT_KEYS)) target -= 1;
    if (this.anyHeld(RIGHT_KEYS)) target += 1;

    if (target === 0 && this.pointerDown) {
      const offset = this.pointerX - viewWidth * 0.5;
      if (Math.abs(offset) > 40) target = Math.max(-1, Math.min(1, offset / 200));
    }

    // Key presses ramp in over ~0.09 s so the bike leans rather than teleports.
    this.axis += (target - this.axis) * 0.32;
    if (Math.abs(this.axis) < 0.01) this.axis = 0;
    this.brake = this.anyHeld(BRAKE_KEYS);
  }

  takeActions() {
    if (this.actions.length === 0) return [];
    const taken = this.actions;
    this.actions = [];
    return taken;
  }

  clear() {
    this.actions.length = 0;
    this.axis = 0;
  }
}
