import * as THREE from 'three';
import { pipCount, type HarborType, type Terrain } from '@island/engine';
import { TERRAIN_GROUND } from './colors';
import { harborImg } from './resourceArt';

/**
 * Procedurally painted canvas textures — the whole tabletop is generated at runtime,
 * so the game ships without any external image assets.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, tex: THREE.CanvasTexture) => void,
  opts: { repeat?: number; redrawOnFonts?: boolean } = {},
): THREE.CanvasTexture {
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat, opts.repeat);
  }
  draw(ctx, tex);
  if (opts.redrawOnFonts && document.fonts) {
    void document.fonts.ready.then(() => {
      ctx.clearRect(0, 0, w, h);
      draw(ctx, tex);
      tex.needsUpdate = true;
    });
  }
  cache.set(key, tex);
  return tex;
}

/** Tiny deterministic PRNG for texture noise. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function woodTableTexture(): THREE.CanvasTexture {
  return makeTexture(
    'table',
    1024,
    1024,
    (ctx) => {
      const rand = prng(11);
      const planks = 5;
      const pw = 1024 / planks;
      const tones = ['#5a3519', '#4e2d14', '#633b1d', '#55321a', '#4a2a12'];
      for (let i = 0; i < planks; i++) {
        const x = i * pw;
        const g = ctx.createLinearGradient(x, 0, x + pw, 0);
        g.addColorStop(0, tones[i]);
        g.addColorStop(0.5, shade(tones[i], 10));
        g.addColorStop(1, tones[i]);
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, pw, 1024);
        // grain
        for (let l = 0; l < 70; l++) {
          ctx.strokeStyle = `rgba(${rand() > 0.5 ? '30,15,5' : '120,75,40'},${0.08 + rand() * 0.14})`;
          ctx.lineWidth = 0.6 + rand() * 1.6;
          ctx.beginPath();
          const gx = x + rand() * pw;
          const amp = 2 + rand() * 6;
          const freq = 0.004 + rand() * 0.01;
          const phase = rand() * 10;
          for (let y = 0; y <= 1024; y += 16) {
            const xx = gx + Math.sin(y * freq + phase) * amp;
            if (y === 0) ctx.moveTo(xx, y);
            else ctx.lineTo(xx, y);
          }
          ctx.stroke();
        }
        // knots
        for (let k = 0; k < 2; k++) {
          const kx = x + pw * (0.25 + rand() * 0.5);
          const ky = rand() * 1024;
          for (let r = 14; r > 2; r -= 3) {
            ctx.strokeStyle = `rgba(35,18,6,${0.18 + (14 - r) * 0.02})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(kx, ky, r * 0.7, r * 1.8, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        // plank seam
        ctx.fillStyle = 'rgba(15,7,2,0.85)';
        ctx.fillRect(x, 0, 3, 1024);
      }
    },
    { repeat: 3 },
  );
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function groundTexture(terrain: Terrain): THREE.CanvasTexture {
  return makeTexture(`ground-${terrain}`, 256, 256, (ctx) => {
    const { base, speckle } = TERRAIN_GROUND[terrain];
    const rand = prng(terrain.length * 977 + terrain.charCodeAt(0));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    const count = terrain === 'desert' ? 900 : 1800;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = speckle[Math.floor(rand() * speckle.length)];
      ctx.globalAlpha = 0.35 + rand() * 0.5;
      const s = 1 + rand() * (terrain === 'mountains' ? 6 : 3.5);
      ctx.beginPath();
      ctx.ellipse(rand() * 256, rand() * 256, s, s * (0.5 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    if (terrain === 'desert') {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#c9a265';
      ctx.lineWidth = 2;
      for (let y = 10; y < 256; y += 18) {
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 4);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  });
}

const TOKEN_FONT = '"Alegreya SC", Georgia, serif';

export function tokenTexture(n: number): THREE.CanvasTexture {
  return makeTexture(
    `token-${n}`,
    256,
    256,
    (ctx) => {
      const g = ctx.createRadialGradient(110, 100, 20, 128, 128, 128);
      g.addColorStop(0, '#fbf0d6');
      g.addColorStop(0.8, '#ecd7ad');
      g.addColorStop(1, '#c9a76e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(120,85,40,.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.stroke();
      const hot = n === 6 || n === 8;
      ctx.fillStyle = hot ? '#b3201a' : '#2e1d0e';
      ctx.font = `700 ${n >= 10 ? 104 : 120}px ${TOKEN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 128, 112);
      const pips = pipCount(n);
      const spacing = 17;
      for (let i = 0; i < pips; i++) {
        ctx.beginPath();
        ctx.arc(128 + (i - (pips - 1) / 2) * spacing, 190, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { redrawOnFonts: true },
  );
}

export function harborSignTexture(type: HarborType, ratio: number): THREE.CanvasTexture {
  return makeTexture(
    `harbor-${type}`,
    256,
    320,
    (ctx, tex) => {
      const paint = (img?: HTMLImageElement) => {
        ctx.clearRect(0, 0, 256, 320);
        // parchment card with rounded corners
        const g = ctx.createLinearGradient(0, 0, 0, 320);
        g.addColorStop(0, '#f6e7c4');
        g.addColorStop(1, '#dcc08a');
        ctx.fillStyle = g;
        roundRect(ctx, 8, 8, 240, 304, 28);
        ctx.fill();
        ctx.strokeStyle = '#7a5428';
        ctx.lineWidth = 8;
        ctx.stroke();
        if (img) ctx.drawImage(img, 48, 26, 160, 160);
        ctx.fillStyle = '#3a2410';
        ctx.font = `800 96px ${TOKEN_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${ratio}:1`, 128, 248);
      };
      paint();
      const img = new Image();
      img.onload = () => {
        paint(img);
        tex.needsUpdate = true;
      };
      img.src = harborImg(type);
    },
    { redrawOnFonts: false },
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
