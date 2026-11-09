/** Paints a banyan on a grass disc above a cut block of soil. No image files are involved. */

export const SCENE_WIDTH = 580;
export const SCENE_HEIGHT = 640;
const H = SCENE_HEIGHT;
/** Width of the scene being painted; widened to match the shape of the panel. */
let W = SCENE_WIDTH;
const MIN_SCENE_WIDTH = 500;

/** Scene height is fixed, so the width follows the panel's aspect ratio. */
export function sceneWidth(aspect: number) {
  return Math.max(MIN_SCENE_WIDTH, H * aspect);
}
const GROUND = 459;
const DISC = { cx: 290, rx: 205, ry: 14 };

type Ctx = CanvasRenderingContext2D;
type Point = [number, number];

/* Tree positions are authored on a 1296-wide layout grid, then mapped into the scene. */
const sx = (x: number) => 290 + (x - 730) * 0.64;
const sy = (y: number) => 30 + (y - 75) * 0.64;
const sr = (r: number) => r * 0.64;

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function valueNoise(seed: number) {
  const size = 256;
  const rng = seeded(seed);
  const grid = Float32Array.from({ length: size * size }, () => rng());
  const at = (x: number, y: number) => grid[((y & 255) << 8) | (x & 255)];
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sxx = fx * fx * (3 - 2 * fx);
    const syy = fy * fy * (3 - 2 * fy);
    return mix(mix(at(ix, iy), at(ix + 1, iy), sxx), mix(at(ix, iy + 1), at(ix + 1, iy + 1), sxx), syy);
  };
}

function layer(scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(W * scale);
  canvas.height = Math.ceil(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  return { canvas, ctx };
}

/* ---------- Soil ---------- */

function paintSoilBase(ctx: Ctx, scale: number) {
  const width = Math.ceil(W * scale);
  const top = Math.floor(GROUND * scale);
  const height = Math.ceil(H * scale) - top;
  const image = ctx.createImageData(width, height);
  const patches = valueNoise(3);
  const clumps = valueNoise(5);
  const rng = seeded(9);
  const upper = [44, 26, 14];
  const middle = [92, 58, 34];
  const lower = [72, 46, 28];

  for (let y = 0; y < height; y += 1) {
    const depth = y / height;
    const base = depth < 0.45
      ? upper.map((c, i) => mix(c, middle[i], depth / 0.45))
      : middle.map((c, i) => mix(c, lower[i], (depth - 0.45) / 0.55));
    const v = y / scale;
    for (let x = 0; x < width; x += 1) {
      const u = x / scale;
      const broad = patches(u * 0.03, v * 0.06) * 0.6 + patches(u * 0.09, v * 0.13) * 0.4;
      const crumb = clumps(u * 0.42, v * 0.42) * 0.65 + clumps(u * 1.1, v * 1.1) * 0.35;
      const light = 0.55 + (broad - 0.5) * 0.62 + (crumb - 0.5) * 0.95 + (rng() - 0.5) * 0.24;
      const offset = (y * width + x) * 4;
      image.data[offset] = clamp(base[0] * light * 1.28, 0, 255);
      image.data[offset + 1] = clamp(base[1] * light * 1.28, 0, 255);
      image.data[offset + 2] = clamp(base[2] * light * 1.28, 0, 255);
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, top);
}

const CRUMB_TONES = ["#2c1a0e", "#402715", "#56361f", "#6d472a", "#865a37", "#9d7047"];

function paintCrumbs(ctx: Ctx) {
  const rng = seeded(21);
  type Crumb = [number, number, number, number, number, number];
  const crumbs: Crumb[] = Array.from({ length: 8000 }, () => {
    const depth = rng() ** 0.75;
    const radius = 0.4 + rng() ** 3 * (1 + depth * 4.6);
    return [rng() * W, GROUND + 2 + depth * (H - GROUND), radius, 0.68 + rng() * 0.32, rng() * Math.PI, Math.floor(rng() * CRUMB_TONES.length)];
  });

  const chunk = 500;
  for (let start = 0; start < crumbs.length; start += chunk) {
    const part = crumbs.slice(start, start + chunk);
    ctx.fillStyle = "rgba(14,7,3,0.6)";
    ctx.beginPath();
    for (const [x, y, r, squash, turn] of part) {
      ctx.moveTo(x + 0.5 + r, y + 0.7);
      ctx.ellipse(x + 0.5, y + 0.7, r * 1.08, r * squash * 1.08, turn, 0, Math.PI * 2);
    }
    ctx.fill();
    CRUMB_TONES.forEach((tone, index) => {
      ctx.fillStyle = tone;
      ctx.beginPath();
      for (const [x, y, r, squash, turn, toneIndex] of part) {
        if (toneIndex !== index) continue;
        ctx.moveTo(x + r, y);
        ctx.ellipse(x, y, r, r * squash, turn, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }
}

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
}

function growRoots() {
  const rng = seeded(83);
  const segments: Segment[] = [];

  const grow = (startX: number, startY: number, startAngle: number, startWidth: number) => {
    let x = startX;
    let y = startY;
    let angle = startAngle;
    let width = startWidth;
    while (width > 0.3 && y < H + 8 && x > -12 && x < W + 12) {
      angle += (rng() - 0.5) * 0.62 + (Math.PI / 2 - angle) * 0.03;
      const nx = x + Math.cos(angle) * 3;
      const ny = y + Math.sin(angle) * 3;
      segments.push({ x0: x, y0: y, x1: nx, y1: ny, width });
      x = nx;
      y = ny;
      width *= 0.978;
      if (rng() < 0.09 && width > 0.5) {
        const side = rng() > 0.5 ? 1 : -1;
        grow(x, y, angle + side * (0.45 + rng() * 0.8), width * (0.42 + rng() * 0.26));
        width *= 0.92;
      }
    }
  };

  const count = 13;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    grow(W / 2 - 104 + t * 208, GROUND + 8, mix(2.45, 0.7, t) + (rng() - 0.5) * 0.2, 3 + rng() * 2);
  }
  return segments;
}

function paintRoots(ctx: Ctx) {
  const segments = growRoots();
  ctx.lineCap = "round";
  const stroke = (color: string, widen: number, dx: number, dy: number, factor: number) => {
    ctx.strokeStyle = color;
    for (const segment of segments) {
      ctx.lineWidth = segment.width * factor + widen;
      ctx.beginPath();
      ctx.moveTo(segment.x0 + dx, segment.y0 + dy);
      ctx.lineTo(segment.x1 + dx, segment.y1 + dy);
      ctx.stroke();
    }
  };
  stroke("rgba(12,6,3,0.42)", 1.3, 0.8, 0.9, 1);
  stroke("#86694b", 0, 0, 0, 1);
  stroke("#b79b74", 0, -0.12, -0.14, 0.55);
}

function paintSoilBlock(target: Ctx, scale: number) {
  const { canvas, ctx } = layer(scale);
  paintSoilBase(ctx, scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paintCrumbs(ctx);
  const depth = ctx.createLinearGradient(0, GROUND, 0, H);
  depth.addColorStop(0, "rgba(18,9,4,0.6)");
  depth.addColorStop(0.2, "rgba(18,9,4,0.12)");
  depth.addColorStop(1, "rgba(14,7,3,0.34)");
  ctx.fillStyle = depth;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  paintRoots(ctx);

  const left = 0;
  const right = W;
  const shape = new Path2D();
  shape.moveTo(left, GROUND);
  shape.lineTo(left, H);
  shape.lineTo(right, H);
  shape.lineTo(right, GROUND);
  shape.closePath();

  target.save();
  target.clip(shape);
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(canvas, 0, 0);
  target.setTransform(scale, 0, 0, scale, 0, 0);
  const round = target.createLinearGradient(left, 0, right, 0);
  round.addColorStop(0, "rgba(12,6,3,0.2)");
  round.addColorStop(0.2, "rgba(12,6,3,0)");
  round.addColorStop(0.8, "rgba(12,6,3,0)");
  round.addColorStop(1, "rgba(12,6,3,0.2)");
  target.fillStyle = round;
  target.fillRect(left, GROUND, W, H - GROUND);
  target.restore();
}

/* ---------- Grass disc ---------- */

const GRASS = ["#2f6a1f", "#40822a", "#5a9c2b", "#74b032", "#8fc53c", "#aad84a"];

function paintDisc(ctx: Ctx) {
  const rng = seeded(47);
  const { cx, ry } = DISC;
  const rx = W / 2 + 24;
  ctx.fillStyle = "#274d18";
  ctx.beginPath();
  ctx.ellipse(cx, GROUND + 3.5, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5c9a2a";
  ctx.beginPath();
  ctx.ellipse(cx, GROUND, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const paths = GRASS.map(() => new Path2D());
  const blades = Math.round((9000 * rx) / DISC.rx);
  for (let i = 0; i < blades; i += 1) {
    const angle = rng() * Math.PI * 2;
    const reach = Math.sqrt(rng());
    const x = cx + Math.cos(angle) * reach * rx;
    const y = GROUND + Math.sin(angle) * reach * ry;
    const height = 1.6 + rng() * 2.4;
    const tone = Math.floor(clamp(0.72 - (y - GROUND) / (ry * 3) + (rng() - 0.5) * 0.9) * (GRASS.length - 1) + 0.5);
    const path = paths[tone];
    const lean = (rng() - 0.5) * 2;
    path.moveTo(x - 0.5, y);
    path.lineTo(x + lean, y - height);
    path.lineTo(x + 0.5, y);
  }
  paths.forEach((path, tone) => {
    ctx.fillStyle = GRASS[tone];
    ctx.fill(path);
  });

  ctx.save();
  ctx.translate(cx, GROUND);
  ctx.scale(150, 11);
  const soft = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
  soft.addColorStop(0, "rgba(44,36,20,0.6)");
  soft.addColorStop(1, "rgba(44,36,20,0)");
  ctx.fillStyle = soft;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- Wood ---------- */

const BARK = ["#1f1a10", "#3a3322", "#5a5138", "#7f7455", "#a59a79", "#c6b997", "#ddd2b4"];

function bezier(a: Point, b: Point, c: Point, d: Point, t: number) {
  const u = 1 - t;
  const x = u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0];
  const y = u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1];
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
  const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, nx: -dy / length, ny: dx / length };
}

/** Draws a limb as many longitudinal fibres, lit like a cylinder. */
function paintLimb(
  ctx: Ctx,
  rng: () => number,
  bark: (x: number, y: number) => number,
  points: [Point, Point, Point, Point],
  startWidth: number,
  endWidth: number,
  occlude: number,
) {
  const [a, b, c, d] = points;
  const samples = 40;
  const centre = Array.from({ length: samples + 1 }, (_, i) => bezier(a, b, c, d, i / samples));
  const widthAt = (i: number) => mix(startWidth, endWidth, i / samples);

  ctx.lineCap = "round";
  ctx.strokeStyle = "#1a2012";
  ctx.lineWidth = (startWidth + endWidth) / 2 + 2;
  ctx.beginPath();
  centre.forEach((point, i) => (i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.stroke();

  const fibres = Math.max(4, Math.ceil(Math.max(startWidth, endWidth) * 1.1));
  for (let f = 0; f < fibres; f += 1) {
    const s = -0.96 + (1.92 * (f + 0.5)) / fibres;
    const lit = clamp(-0.32 * s + 0.82 * Math.sqrt(1 - s * s));
    const personal = (rng() - 0.5) * 0.2;
    const wobble = rng() * 40;
    for (let i = 0; i < samples; i += 2) {
      const end = Math.min(samples, i + 2);
      const t = i / samples;
      const shade = mix(1 - occlude, 1, clamp((t - 0.02) / 0.42));
      const knot = bark(i * 0.12 + wobble, f * 0.5);
      const value = clamp(lit * shade + personal + (knot - 0.5) * 0.3 + 0.03);
      ctx.strokeStyle = BARK[Math.floor(value * (BARK.length - 1) + 0.5)];
      ctx.lineWidth = (widthAt(i) / fibres) * 1.75;
      ctx.beginPath();
      for (let j = i; j <= end; j += 1) {
        const point = centre[j];
        const offset = (s * widthAt(j)) / 2 + (bark(j * 0.28 + wobble, f * 0.7) - 0.5) * 1.3;
        const px = point.x + point.nx * offset;
        const py = point.y + point.ny * offset;
        if (j === i) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
}

function paintUnderstorey(ctx: Ctx) {
  const rng = seeded(37);
  // The crown's solid mass: gaps between shelves read as deep shade, never as background.
  ctx.fillStyle = "#23331a";
  ctx.beginPath();
  ctx.ellipse(sx(730), sy(335), sr(268), sr(205), 0, 0, Math.PI * 2);
  ctx.fill();

  const cx = sx(730);
  const cy = sy(452);
  const rx = sr(262);
  const ry = sr(122);
  ctx.fillStyle = "#2a2e1c";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const paths = [new Path2D(), new Path2D(), new Path2D()];
  const colors = ["#1f2415", "#3b4426", "#4f5f2c"];
  for (let i = 0; i < 2600; i += 1) {
    const angle = rng() * Math.PI;
    const reach = 0.9 + rng() * 0.16;
    const x = cx + Math.cos(angle) * reach * rx;
    const y = cy + Math.sin(angle) * reach * ry;
    const path = paths[Math.floor(rng() * paths.length)];
    path.moveTo(x + 2.2, y);
    path.ellipse(x, y, 2.2, 1.1, rng() * Math.PI, 0, Math.PI * 2);
  }
  paths.forEach((path, index) => {
    ctx.fillStyle = colors[index];
    ctx.fill(path);
  });
}

function paintTree(ctx: Ctx) {
  const rng = seeded(31);
  const bark = valueNoise(14);

  const branches: [number, number, number, number, number, number, number][] = [
    [700, 490, 650, 430, 585, 408, 8],
    [690, 530, 620, 475, 548, 470, 9],
    [680, 560, 630, 530, 562, 520, 7],
    [770, 500, 800, 450, 880, 425, 8],
    [790, 545, 830, 490, 868, 462, 7],
    [800, 575, 860, 530, 932, 512, 8],
    [718, 470, 712, 420, 688, 400, 9],
    [742, 470, 746, 420, 762, 395, 8],
  ];
  for (const [x0, y0, x1, y1, x2, y2, width] of branches) {
    const a: Point = [sx(x0), sy(y0)];
    const b: Point = [sx(x1), sy(y1)];
    const d: Point = [sx(x2), sy(y2)];
    paintLimb(ctx, rng, bark, [a, b, [(b[0] + d[0]) / 2, (b[1] + d[1]) / 2], d], width * 0.7, 1.6, 0.25);
  }

  const surface: [number, number][] = [
    [-132, 2], [-112, 7], [-92, -3], [-76, 9], [78, 9], [96, -3], [116, 7], [136, 2], [-44, 11], [40, 11],
  ];
  for (const [offset, drop] of surface) {
    paintLimb(
      ctx,
      rng,
      bark,
      [[290 + offset * 0.34, GROUND - 16], [290 + offset * 0.56, GROUND - 7], [290 + offset * 0.8, GROUND + drop * 0.5], [290 + offset, GROUND + drop]],
      10,
      1.4,
      0,
    );
  }

  // Separate columns with dark gaps, as on a banyan built from fused aerial roots.
  const stems: [number, number, number][] = [
    [-92, -36, 11], [92, 36, 11], [-66, -27, 14], [66, 27, 13],
    [-36, -15, 15], [38, 15, 14], [-8, -3, 19],
  ];
  ctx.fillStyle = "#222a17";
  ctx.beginPath();
  ctx.moveTo(290 - 40, sy(440));
  ctx.lineTo(290 + 40, sy(440));
  ctx.quadraticCurveTo(290 + 38, 410, 290 + 74, GROUND - 2);
  ctx.lineTo(290 - 74, GROUND - 2);
  ctx.quadraticCurveTo(290 - 38, 410, 290 - 40, sy(440));
  ctx.fill();

  for (const [base, top, width] of stems) {
    paintLimb(
      ctx,
      rng,
      bark,
      [[290 + top, sy(440)], [290 + top * 0.92, 372], [290 + base * 0.34, 436], [290 + base, GROUND + 4]],
      width,
      2.5 + rng() * 2,
      0.5,
    );
  }
}

const HANGERS: [number, number, number][] = [
  [495, 566, 612], [505, 570, 615], [530, 566, 690], [541, 566, 625], [585, 560, 612],
  [656, 575, 640], [810, 585, 622], [874, 588, 650], [898, 585, 682], [920, 572, 620],
];

function paintAerialRoots(ctx: Ctx) {
  ctx.lineCap = "round";
  for (const [x, top, bottom] of HANGERS) {
    const px = sx(x);
    const y0 = sy(top);
    const y1 = sy(bottom);
    for (const [color, width, offset] of [["#4c5230", 2.2, 0.3], ["#b1a581", 1, -0.3]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(px + offset, y0);
      const steps = Math.max(2, Math.round((y1 - y0) / 5));
      for (let i = 1; i <= steps; i += 1) {
        ctx.lineTo(px + offset + Math.sin(x + i * 0.9) * 0.6, y0 + (i / steps) * (y1 - y0));
      }
      ctx.stroke();
    }
  }
}

/* ---------- Foliage ---------- */

const LEAF_TONES = ["#1d2a16", "#27401a", "#34601c", "#468020", "#5c9d24", "#78b62b", "#94cc36", "#b2dd4c", "#cdea6e"];
const FRINGE = "#a09f84";

/** Crown shelves, painted from the back and top toward the front and bottom. */
const LOBES: [number, number, number][] = [
  [640, 135, 62], [730, 130, 78], [835, 165, 72],
  [510, 245, 66], [590, 195, 72], [720, 185, 88], [880, 215, 78], [962, 262, 66],
  [612, 262, 76], [742, 255, 82], [862, 278, 62], [1020, 320, 52],
  [436, 362, 64], [1052, 402, 54], [984, 352, 76],
  [532, 372, 86], [642, 362, 96], [782, 372, 88], [884, 342, 82],
  [440, 470, 50], [1040, 482, 50], [980, 472, 70], [932, 442, 60],
  [522, 442, 60], [622, 428, 62], [694, 418, 60], [770, 424, 58], [846, 430, 52],
  [468, 524, 36], [530, 540, 34], [590, 556, 26], [650, 500, 22], [812, 498, 22],
  [872, 560, 28], [930, 556, 36], [1002, 550, 32],
];

const LIGHT = { x: -0.18, y: -0.88, z: 0.42 };

function paintCanopy(ctx: Ctx) {
  const rng = seeded(19);
  for (const [lx, ly, lr] of LOBES) {
    const lobeX = sx(lx);
    const lobeY = sy(ly);
    const lobeSize = sr(lr) * 1.16;
    const count = Math.max(12, Math.round(lobeSize / 1.25));

    const clumps = Array.from({ length: count }, () => {
      const angle = rng() * Math.PI * 2;
      const reach = Math.sqrt(rng()) * 0.94;
      const nx = Math.cos(angle) * reach;
      const ny = Math.sin(angle) * reach;
      const nz = Math.sqrt(Math.max(0, 1 - reach * reach));
      const form = clamp(nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
      return { nx, ny, form, size: lobeSize * (0.15 + rng() * 0.14) };
    }).sort((a, b) => a.form - b.form);

    for (const { nx, ny, form, size } of clumps) {
      const x = lobeX + nx * lobeSize;
      const y = lobeY + ny * lobeSize * 0.76;

      ctx.fillStyle = form > 0.45 ? "#27401a" : "#1d2a16";
      ctx.beginPath();
      ctx.arc(x, y, size * 0.84, 0, Math.PI * 2);
      ctx.fill();

      const buckets = LEAF_TONES.map(() => new Path2D());
      const fringe = new Path2D();
      const leaves = Math.round(size * size * 0.7) + 14;
      for (let i = 0; i < leaves; i += 1) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * 1.14;
        const px = x + Math.cos(a) * r * size;
        const py = y + Math.sin(a) * r * size;
        const lz = Math.sqrt(Math.max(0, 1 - Math.min(1, r * r)));
        const local = Math.cos(a) * r * LIGHT.x + Math.sin(a) * r * LIGHT.y + lz * LIGHT.z;
        const value = form * 0.92 + clamp(local) * 0.36 + (rng() - 0.5) * 0.24 - 0.04;
        const length = 1.2 + rng() * 1.5;
        const turn = rng() * Math.PI;
        const path = r > 1.02 && rng() < 0.16 ? fringe : buckets[Math.floor(clamp(value) * (LEAF_TONES.length - 1) + 0.5)];
        path.moveTo(px + Math.cos(turn) * length, py + Math.sin(turn) * length);
        path.ellipse(px, py, length, 0.6 + rng() * 0.7, turn, 0, Math.PI * 2);
      }
      buckets.forEach((path, tone) => {
        ctx.fillStyle = LEAF_TONES[tone];
        ctx.fill(path);
      });
      ctx.fillStyle = FRINGE;
      ctx.fill(fringe);
    }
  }
}

/* ---------- Finish ---------- */

const CELL_WIDTH = 3.9;
const CELL_HEIGHT = 6.2;
/* Compact, even glyphs from dense to light; wide ones would merge into streaks. */
const GLYPHS = "#*+:";
const INKS = [
  ["#06280f", "#0a3a15", "#0d4f1b", "#126522", "#197a28", "#26902e"],
  ["#1d1109", "#2c1b0e", "#3f2815", "#54371e", "#6b4827"],
  ["#1c0e06", "#2a160a", "#3b200f", "#4f2d16", "#65391c", "#7a4723"],
];
const LEAF_INDEX = 0;
const BARK_INDEX = 1;
const SOIL_INDEX = 2;
const TONE_LEVELS = 12;
const GROW_MS = 1300;
const APPEAR_MS = 320;
const INTRO_MS = GROW_MS + APPEAR_MS + 140;
const SETTLE_MS = 1600;
const HOVER_RADIUS = 66;
const HOVER_PUSH = 11;
const HOVER_INK = 0.6;
const HOVER_EASE = 0.12;
const HOVER_FOLLOW = 0.24;

interface Cell {
  x: number;
  y: number;
  sceneX: number;
  sceneY: number;
  tone: number;
  material: number;
  delay: number;
}

export interface SceneMotion {
  /** Sets the cursor position in scene units, or null when it leaves. */
  point: (position: { x: number; y: number } | null) => void;
  /** Draws the finished scene without movement. */
  still: () => void;
  /** Draws the scene at a time, in milliseconds since the animation started. */
  frame: (time: number) => void;
}

/** Redraws the painting as ASCII text, one coloured character per grid cell. */
function buildAscii(output: Ctx, source: Ctx, width: number, height: number, scale: number, font: string): SceneMotion {
  const { data } = source.getImageData(0, 0, width, height);
  const cellWidth = CELL_WIDTH * scale;
  const cellHeight = CELL_HEIGHT * scale;
  const cells: Cell[] = [];
  const jitter = seeded(71);

  const rows = Math.ceil(height / cellHeight);
  const columns = Math.ceil(width / cellWidth);
  const stride = Math.max(1, Math.floor(scale / 1.5));
  const tones = new Float32Array(rows * columns).fill(-1);
  const materials = new Uint8Array(rows * columns);

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor(row * cellHeight);
    const y1 = Math.min(height, Math.floor((row + 1) * cellHeight));
    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.floor(column * cellWidth);
      const x1 = Math.min(width, Math.floor((column + 1) * cellWidth));
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      let total = 0;
      for (let y = y0; y < y1; y += stride) {
        for (let x = x0; x < x1; x += stride) {
          const at = (y * width + x) * 4;
          total += 1;
          if (data[at + 3] < 128) continue;
          r += data[at];
          g += data[at + 1];
          b += data[at + 2];
          covered += 1;
        }
      }
      if (covered === 0 || covered / total < 0.42) continue;
      r /= covered;
      g /= covered;
      b /= covered;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Soil is much darker than foliage, so it gets its own tonal range.
      const inSoil = y0 > (GROUND + 8) * scale;
      const cell = row * columns + column;
      tones[cell] = inSoil ? clamp((luma - 0.04) / 0.26) : clamp((luma - 0.05) / 0.58);
      materials[cell] = inSoil ? SOIL_INDEX : g > r * 1.06 ? LEAF_INDEX : BARK_INDEX;
    }
  }

  // Averaging with matching neighbours turns speckle into smooth areas of shading.
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = row * columns + column;
      if (tones[cell] < 0) continue;
      let sum = tones[cell] * 2;
      let weight = 2;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nr = row + dy;
          const nc = column + dx;
          if ((!dx && !dy) || nr < 0 || nc < 0 || nr >= rows || nc >= columns) continue;
          const other = nr * columns + nc;
          if (tones[other] < 0 || materials[other] !== materials[cell]) continue;
          sum += tones[other];
          weight += 1;
        }
      }
      // The curve keeps lit foliage dense enough to stand out from the bright wash.
      const tone = (sum / weight) ** 1.8;
      const x = (column + 0.5) * CELL_WIDTH;
      const y = (row + 0.5) * CELL_HEIGHT;
      // The scene grows outward from the base of the trunk.
      const reach = Math.hypot(x - W / 2, y - GROUND) / Math.hypot(W / 2, GROUND);
      cells.push({
        x: x * scale,
        y: y * scale,
        sceneX: x,
        sceneY: y,
        tone,
        material: materials[cell],
        delay: reach * GROW_MS + jitter() * 140,
      });
    }
  }

  const atlas = buildAtlas(cellWidth, cellHeight, scale, font);
  const stamp = (target: Ctx, cell: Cell, tone: number, shift = 0, lift = 0) => {
    const level = Math.min(TONE_LEVELS - 1, Math.floor(clamp(tone) * TONE_LEVELS));
    target.drawImage(
      atlas.canvas,
      level * atlas.width,
      cell.material * atlas.height,
      atlas.width,
      atlas.height,
      cell.x + shift - atlas.width / 2,
      cell.y + lift - atlas.height / 2,
      atlas.width,
      atlas.height,
    );
  };

  // Soil and wood never move, so they are drawn once and reused on every frame.
  const fixed = layer(scale);
  const foliage = cells.filter((cell) => cell.material === LEAF_INDEX);
  for (const cell of cells) {
    if (cell.material !== LEAF_INDEX) stamp(fixed.ctx, cell, cell.tone);
  }

  let pointer: { x: number; y: number } | null = null;
  let hoverX = 0;
  let hoverY = 0;
  let hover = 0;

  const paintSettled = (time: number, strength: number) => {
    // The cursor position and effect both ease, so nothing jumps.
    hover += ((pointer ? 1 : 0) - hover) * HOVER_EASE;
    if (pointer) {
      hoverX += (pointer.x - hoverX) * HOVER_FOLLOW;
      hoverY += (pointer.y - hoverY) * HOVER_FOLLOW;
    }
    const hovering = hover > 0.004;

    output.clearRect(0, 0, width, height);
    output.drawImage(fixed.canvas, 0, 0);

    // Still characters are only redrawn inside a grid-aligned window around the cursor.
    const reach = HOVER_RADIUS + CELL_WIDTH * 2;
    const left = Math.floor((hoverX - reach) / CELL_WIDTH) * CELL_WIDTH;
    const right = Math.ceil((hoverX + reach) / CELL_WIDTH) * CELL_WIDTH;
    const top = Math.floor((hoverY - reach) / CELL_HEIGHT) * CELL_HEIGHT;
    const bottom = Math.ceil((hoverY + reach) / CELL_HEIGHT) * CELL_HEIGHT;
    if (hovering) output.clearRect(left * scale, top * scale, (right - left) * scale, (bottom - top) * scale);

    for (const cell of hovering ? cells : foliage) {
      if (
        cell.material !== LEAF_INDEX &&
        (cell.sceneX < left || cell.sceneX > right || cell.sceneY < top || cell.sceneY > bottom)
      ) {
        continue;
      }
      let tone = cell.tone;
      let shift = 0;
      let lift = 0;
      if (cell.material === LEAF_INDEX) {
        const height01 = clamp((GROUND - cell.sceneY) / (GROUND - 30));
        const sway =
          Math.sin(time * 0.0009 + cell.sceneX * 0.006) * 1.5 + Math.sin(time * 0.0021 + cell.sceneY * 0.02) * 0.55;
        tone += Math.sin(time * 0.0014 - cell.sceneX * 0.022 + cell.sceneY * 0.012) * 0.13 * strength;
        shift = sway * height01 * height01 * strength * scale;
      }
      if (hovering) {
        const dx = cell.sceneX - hoverX;
        const dy = cell.sceneY - hoverY;
        const distance = Math.hypot(dx, dy);
        if (distance < HOVER_RADIUS && distance > 0) {
          const force = (1 - distance / HOVER_RADIUS) ** 2 * hover;
          shift += (dx / distance) * force * HOVER_PUSH * scale;
          lift = (dy / distance) * force * HOVER_PUSH * scale;
          tone -= force * HOVER_INK;
        }
      }
      stamp(output, cell, tone, shift, lift);
    }
  };

  return {
    point: (next) => {
      if (next && !pointer && hover < 0.01) {
        hoverX = next.x;
        hoverY = next.y;
      }
      pointer = next;
    },
    still: () => paintSettled(0, 0),
    frame: (time) => {
      if (time >= INTRO_MS) {
        paintSettled(time, clamp((time - INTRO_MS) / SETTLE_MS));
        return;
      }
      output.clearRect(0, 0, width, height);
      for (const cell of cells) {
        const appear = clamp((time - cell.delay) / APPEAR_MS);
        if (appear <= 0) continue;
        output.globalAlpha = appear;
        stamp(output, cell, mix(1, cell.tone, appear));
      }
      output.globalAlpha = 1;
    },
  };
}

/** Pre-renders every character and colour once, which keeps animation frames cheap. */
function buildAtlas(cellWidth: number, cellHeight: number, scale: number, font: string) {
  const width = Math.ceil(cellWidth * 1.7);
  const height = Math.ceil(cellHeight * 1.4);
  const canvas = document.createElement("canvas");
  canvas.width = width * TONE_LEVELS;
  canvas.height = height * INKS.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.font = `600 ${(CELL_HEIGHT * scale).toFixed(2)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  INKS.forEach((palette, material) => {
    for (let level = 0; level < TONE_LEVELS; level += 1) {
      const tone = (level + 0.5) / TONE_LEVELS;
      ctx.fillStyle = palette[Math.floor(tone * palette.length)];
      ctx.fillText(GLYPHS[Math.floor(tone * GLYPHS.length)], (level + 0.5) * width, (material + 0.5) * height);
    }
  });
  return { canvas, width, height };
}

export function paintScene(target: HTMLCanvasElement, scale: number, font: string, sceneW: number): SceneMotion | null {
  W = sceneW;
  const { canvas, ctx } = layer(scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paintSoilBlock(ctx, scale);
  // The tree is authored on the base width, then centred in the scene.
  ctx.setTransform(scale, 0, 0, scale, ((W - SCENE_WIDTH) / 2) * scale, 0);
  paintDisc(ctx);
  paintUnderstorey(ctx);
  paintTree(ctx);
  paintCanopy(ctx);
  paintAerialRoots(ctx);

  target.width = canvas.width;
  target.height = canvas.height;
  const output = target.getContext("2d");
  if (!output) return null;
  return buildAscii(output, ctx, canvas.width, canvas.height, scale, font);
}
