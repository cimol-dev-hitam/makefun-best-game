// Screen-space light layers: the background wash, the haze at the vanishing
// point, the sheen on the road, the vignette and the scan lines. They are all
// static for a given window size, so each is painted once into an offscreen
// canvas and blitted per frame instead of re-evaluating hundreds of thousands
// of gradient pixels every 16 ms.

const cache = new Map();

function surface(kind, width, height, paint) {
  const key = `${kind}:${width}x${height}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  paint(context, canvas.width, canvas.height);
  if (cache.size > 24) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

export function drawBackdropLayer(ctx, width, height) {
  const layer = surface('backdrop', width, height, (c, w, h) => {
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#080512');
    gradient.addColorStop(0.36, '#05060e');
    gradient.addColorStop(1, '#03040a');
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
  });
  ctx.drawImage(layer, 0, 0, width, height);
}

export function drawHorizonHaze(ctx, width, height) {
  const layer = surface('haze', width, height, (c, w, h) => {
    const haze = c.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h * 0.1, w * 0.62);
    haze.addColorStop(0, 'rgba(255, 47, 146, 0.2)');
    haze.addColorStop(0.42, 'rgba(120, 22, 78, 0.09)');
    haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = haze;
    c.fillRect(0, 0, w, h * 0.58);
  });
  ctx.drawImage(layer, 0, 0, width, height);
}

// Cyan pool of light under the rider, brighter the faster the bike goes.
export function drawRoadSheen(ctx, width, height, strength) {
  const layer = surface('sheen', width, height, (c, w, h) => {
    const sheen = c.createRadialGradient(w / 2, h * 0.72, 0, w / 2, h * 0.72, w * 0.52);
    sheen.addColorStop(0, 'rgba(65, 240, 255, 0.55)');
    sheen.addColorStop(0.55, 'rgba(45, 150, 200, 0.16)');
    sheen.addColorStop(1, 'rgba(65, 240, 255, 0)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, w, h);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.drawImage(layer, 0, 0, width, height);
  ctx.restore();
}

export function drawVignette(ctx, width, height) {
  const layer = surface('vignette', width, height, (c, w, h) => {
    const gradient = c.createRadialGradient(
      w / 2,
      h * 0.62,
      Math.min(w, h) * 0.26,
      w / 2,
      h * 0.62,
      Math.max(w, h) * 0.8,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.22)');
    gradient.addColorStop(1, 'rgba(2, 3, 8, 0.82)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
  });
  ctx.drawImage(layer, 0, 0, width, height);
}

export function drawScanlines(ctx, width, height, time) {
  const layer = surface('scanlines', 1, 3, (c) => {
    c.fillStyle = 'rgba(65, 240, 255, 0.5)';
    c.fillRect(0, 0, 1, 1);
  });
  const pattern = ctx.createPattern(layer, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = pattern;
  ctx.translate(0, Math.floor((time * 26) % 3));
  ctx.fillRect(0, -3, width, height + 6);
  ctx.restore();
}

export function drawScreenTexture(ctx, width, height, time) {
  drawVignette(ctx, width, height);
  drawScanlines(ctx, width, height, time);
}
