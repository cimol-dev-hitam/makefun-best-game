// Every number that shapes the feel of the ride, and the palette, in one place.

export const PALETTE = {
  void: '#04050a',
  wallDeep: '#0a0714',
  wallNear: '#120a20',
  floor: '#070910',
  floorTint: '#0b1520',
  cyan: '#41f0ff',
  cyanSoft: '#8ff8ff',
  cyanDeep: '#0d5c69',
  magenta: '#ff2f92',
  magentaSoft: '#ff8fc4',
  white: '#f4f8ff',
  dim: '#5c6675',
  dimmer: '#2a303c',
};

export const TUNING = {
  // forward motion (world pixels per second)
  startSpeed: 400,
  maxSpeed: 1720,
  acceleration: 26,
  brakeDrag: 620,
  brakeFloor: 235,

  // lateral motion of the hoverbike
  steerAcceleration: 6200,
  steerDamping: 6.6,
  maxLateralSpeed: 1010,
  lateralSpeedPerForward: 0.2,

  // collision shape
  bikeHalfWidth: 15,
  wallPadding: 4,
  grazeBand: 40,

  // risk and reward
  grazeSpeedBonus: 0.14,
  grazeCharge: 3.2,
  grazeDecay: 0.9,
  ringMultiplier: 0.1,
  gateMultiplier: 0.3,
  multiplierDecayPerPixel: 0.00028,
  multiplierMax: 9.99,

  // score
  scorePerPixel: 0.055,
  ringScore: 220,
  gateScore: 480,
  grazeScore: 90,

  // camera and presentation
  cameraFollowRate: 7.5,
  cameraPullBack: 26,
  perspective: 0.00172,
  focusLine: 0.775,
  maxParticles: 560,
};

export const STORAGE_KEY = 'neon-slipstream.best';
