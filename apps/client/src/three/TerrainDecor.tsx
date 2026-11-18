import { useMemo } from 'react';
import * as THREE from 'three';
import type { Terrain } from '@island/engine';
import { Instances, insideHex, scatterInHex, seeded, stdMat, type InstanceItem } from './shared';

/* Shared geometries — created once, reused by every tile. */
const G = {
  trunk: new THREE.CylinderGeometry(0.022, 0.032, 0.09, 6).translate(0, 0.045, 0),
  canopyLow: new THREE.ConeGeometry(0.12, 0.22, 7).translate(0, 0.19, 0),
  canopyHigh: new THREE.ConeGeometry(0.088, 0.17, 7).translate(0, 0.3, 0),
  peak: new THREE.ConeGeometry(0.34, 0.52, 6, 2).translate(0, 0.26, 0),
  snow: new THREE.ConeGeometry(0.13, 0.19, 6).translate(0, 0.52 - 0.095 + 0.004, 0),
  rock: new THREE.DodecahedronGeometry(0.05, 0),
  mound: new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  brick: new THREE.BoxGeometry(0.075, 0.032, 0.036),
  stalk: new THREE.ConeGeometry(0.017, 0.13, 4).translate(0, 0.065, 0),
  hay: new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10).rotateZ(Math.PI / 2),
  sheepBody: new THREE.SphereGeometry(0.055, 10, 8),
  sheepHead: new THREE.SphereGeometry(0.028, 8, 6),
  leg: new THREE.CylinderGeometry(0.008, 0.008, 0.05, 4).translate(0, 0.025, 0),
  bush: new THREE.IcosahedronGeometry(0.05, 0),
  post: new THREE.BoxGeometry(0.018, 0.07, 0.018).translate(0, 0.035, 0),
  rail: new THREE.BoxGeometry(0.2, 0.012, 0.01),
  dune: new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cactus: new THREE.CylinderGeometry(0.022, 0.025, 0.16, 7).translate(0, 0.08, 0),
  arm: new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6).translate(0, 0.03, 0),
  mine: new THREE.BoxGeometry(0.1, 0.08, 0.04).translate(0, 0.04, 0),
};

const M = {
  trunk: stdMat('#5b3a1e'),
  canopy: stdMat('#ffffff', { roughness: 0.9, flat: true }),
  peak: stdMat('#ffffff', { roughness: 0.95, flat: true }),
  snow: stdMat('#f4f6fb', { roughness: 0.6, flat: true }),
  rock: stdMat('#ffffff', { roughness: 0.9, flat: true }),
  mound: stdMat('#a64d27', { roughness: 0.95 }),
  brick: stdMat('#ffffff', { roughness: 0.85 }),
  stalk: stdMat('#ffffff', { roughness: 0.9, flat: true }),
  hay: stdMat('#e2b647', { roughness: 1 }),
  wool: stdMat('#f7f5ee', { roughness: 1 }),
  dark: stdMat('#2a2522', { roughness: 0.8 }),
  bush: stdMat('#ffffff', { roughness: 0.9, flat: true }),
  fence: stdMat('#8a6236', { roughness: 0.9 }),
  dune: stdMat('#e3c48a', { roughness: 1 }),
  cactus: stdMat('#5c8a3c', { roughness: 0.8 }),
  mine: stdMat('#1d1712', { roughness: 1 }),
};

const pick = <T,>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length];

function Forest({ seed }: { seed: number }) {
  const { trunks, low, high } = useMemo(() => {
    const rand = seeded(seed + 3);
    const pts = scatterInHex(seed, 17, { minDist: 0.15 });
    const greens = ['#2d5a22', '#24491b', '#3a6b2a', '#1f4418', '#336326'];
    const trunks: InstanceItem[] = [];
    const low: InstanceItem[] = [];
    const high: InstanceItem[] = [];
    for (const p of pts) {
      const s = p.s * 0.95;
      const color = pick(greens, rand());
      trunks.push({ x: p.x, y: 0, z: p.z, s });
      low.push({ x: p.x, y: 0, z: p.z, s, ry: p.r, color });
      high.push({ x: p.x, y: 0, z: p.z, s, ry: p.r, color: new THREE.Color(color).offsetHSL(0, 0, 0.05).getStyle() });
    }
    return { trunks, low, high };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.trunk} material={M.trunk} items={trunks} />
      <Instances geometry={G.canopyLow} material={M.canopy} items={low} />
      <Instances geometry={G.canopyHigh} material={M.canopy} items={high} />
    </>
  );
}

function Mountains({ seed }: { seed: number }) {
  const { peaks, snows, rocks } = useMemo(() => {
    const rand = seeded(seed + 11);
    const base = rand() * Math.PI * 2;
    const greys = ['#80838b', '#6d7078', '#8d9098', '#757880'];
    const peaks: InstanceItem[] = [];
    const snows: InstanceItem[] = [];
    for (let k = 0; k < 3; k++) {
      const a = base + (k * Math.PI * 2) / 3 + (rand() - 0.5) * 0.5;
      const d = 0.46 + rand() * 0.08;
      const s = 0.85 + rand() * 0.35;
      const ry = rand() * Math.PI;
      const item = { x: Math.cos(a) * d, y: 0, z: Math.sin(a) * d, s, ry };
      peaks.push({ ...item, color: pick(greys, rand()) });
      snows.push(item);
    }
    const rocks = scatterInHex(seed + 5, 8, { minDist: 0.1, inner: 0.32 }).map((p) => ({
      x: p.x,
      y: 0.015,
      z: p.z,
      s: p.s * 0.8,
      ry: p.r,
      rx: p.r,
      color: pick(greys, rand()),
    }));
    return { peaks, snows, rocks };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.peak} material={M.peak} items={peaks} />
      <Instances geometry={G.snow} material={M.snow} items={snows} />
      <Instances geometry={G.rock} material={M.rock} items={rocks} />
      <mesh geometry={G.mine} material={M.mine} position={[peaks[0].x * 0.55, 0, peaks[0].z * 0.55]} rotation-y={-Math.atan2(peaks[0].z, peaks[0].x) + Math.PI / 2} />
    </>
  );
}

function Hills({ seed }: { seed: number }) {
  const { mounds, bricks } = useMemo(() => {
    const rand = seeded(seed + 21);
    const mounds = scatterInHex(seed, 4, { minDist: 0.32, inner: 0.42 }).map((p) => ({
      x: p.x,
      y: 0,
      z: p.z,
      sx: p.s * 0.9,
      sy: 0.45 * p.s,
      sz: p.s * 0.75,
      ry: p.r,
    }));
    const tones = ['#b5492a', '#a43f22', '#c45935', '#9c3b1f'];
    const bricks: InstanceItem[] = [];
    const piles = scatterInHex(seed + 9, 3, { minDist: 0.3, inner: 0.38 });
    for (const pile of piles) {
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 3 - layer; i++) {
          for (let j = 0; j < 2; j++) {
            const lx = (i - (2 - layer) / 2) * 0.08;
            const lz = (j - 0.5) * 0.04;
            const c = Math.cos(pile.r);
            const s = Math.sin(pile.r);
            bricks.push({
              x: pile.x + lx * c - lz * s,
              y: 0.016 + layer * 0.033,
              z: pile.z + lx * s + lz * c,
              ry: -pile.r,
              color: pick(tones, rand()),
            });
          }
        }
      }
    }
    return { mounds, bricks };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.mound} material={M.mound} items={mounds} />
      <Instances geometry={G.brick} material={M.brick} items={bricks} />
    </>
  );
}

function Fields({ seed }: { seed: number }) {
  const { stalks, hay } = useMemo(() => {
    const rand = seeded(seed + 31);
    const golds = ['#e9b83a', '#d9a42a', '#f2c94e', '#cf9a22', '#f5d064'];
    const stalks: InstanceItem[] = [];
    const rot = (Math.floor(rand() * 3) * Math.PI) / 3;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let u = -0.8; u <= 0.8; u += 0.075) {
      for (let v = -0.8; v <= 0.8; v += 0.045) {
        const x = u * c - v * s + (rand() - 0.5) * 0.015;
        const z = u * s + v * c + (rand() - 0.5) * 0.015;
        if (Math.hypot(x, z) < 0.38 || !insideHex(x, z, 0.75)) continue;
        stalks.push({ x, y: 0, z, s: 0.8 + rand() * 0.45, ry: rand() * 3, rz: (rand() - 0.5) * 0.25, color: pick(golds, rand()) });
      }
    }
    const hay = scatterInHex(seed + 2, 2, { inner: 0.4, minDist: 0.3 }).map((p) => ({ x: p.x, y: 0.05, z: p.z, ry: p.r }));
    return { stalks, hay };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.stalk} material={M.stalk} items={stalks} castShadow={false} />
      <Instances geometry={G.hay} material={M.hay} items={hay} />
    </>
  );
}

function Pasture({ seed }: { seed: number }) {
  const { bodies, heads, legs, bushes, posts, rails } = useMemo(() => {
    const rand = seeded(seed + 41);
    const sheep = scatterInHex(seed, 5, { minDist: 0.2, inner: 0.36 });
    const bodies: InstanceItem[] = [];
    const heads: InstanceItem[] = [];
    const legs: InstanceItem[] = [];
    for (const sh of sheep) {
      const dx = Math.cos(sh.r);
      const dz = Math.sin(sh.r);
      bodies.push({ x: sh.x, y: 0.07, z: sh.z, sx: 1.35, sy: 1, sz: 1, ry: -sh.r });
      heads.push({ x: sh.x + dx * 0.075, y: 0.085, z: sh.z + dz * 0.075 });
      for (const [a, b] of [[0.04, 0.025], [0.04, -0.025], [-0.04, 0.025], [-0.04, -0.025]]) {
        legs.push({ x: sh.x + dx * a - dz * b, y: 0, z: sh.z + dz * a + dx * b });
      }
    }
    const greens = ['#3f7d2a', '#4b8c32', '#356b24'];
    const bushes = scatterInHex(seed + 7, 6, { minDist: 0.14, inner: 0.36 }).map((p) => ({
      x: p.x,
      y: 0.03,
      z: p.z,
      s: p.s,
      ry: p.r,
      color: pick(greens, rand()),
    }));
    // a short fence along one side of the meadow
    const fa = Math.floor(rand() * 6) * (Math.PI / 3);
    const posts: InstanceItem[] = [];
    const rails: InstanceItem[] = [];
    const cx = Math.cos(fa) * 0.6;
    const cz = Math.sin(fa) * 0.6;
    const tx = -Math.sin(fa);
    const tz = Math.cos(fa);
    for (let i = -2; i <= 2; i++) posts.push({ x: cx + tx * i * 0.1, y: 0, z: cz + tz * i * 0.1 });
    for (const h of [0.03, 0.055]) {
      for (const off of [-0.1, 0.1]) {
        rails.push({ x: cx + tx * off, y: h, z: cz + tz * off, ry: -Math.atan2(tz, tx) });
      }
    }
    return { bodies, heads, legs, bushes, posts, rails };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.sheepBody} material={M.wool} items={bodies} />
      <Instances geometry={G.sheepHead} material={M.dark} items={heads} />
      <Instances geometry={G.leg} material={M.dark} items={legs} castShadow={false} />
      <Instances geometry={G.bush} material={M.bush} items={bushes} />
      <Instances geometry={G.post} material={M.fence} items={posts} />
      <Instances geometry={G.rail} material={M.fence} items={rails} />
    </>
  );
}

function Desert({ seed }: { seed: number }) {
  const { dunes, rocks, cacti, arms } = useMemo(() => {
    const dunes = scatterInHex(seed, 4, { minDist: 0.3, inner: 0.3 }).map((p) => ({
      x: p.x,
      y: 0,
      z: p.z,
      sx: p.s * 1.1,
      sy: 0.28,
      sz: p.s * 0.6,
      ry: p.r,
    }));
    const rocks = scatterInHex(seed + 3, 5, { minDist: 0.12, inner: 0.35 }).map((p) => ({
      x: p.x,
      y: 0.01,
      z: p.z,
      s: p.s * 0.7,
      rx: p.r,
      ry: p.r,
      color: '#a08560',
    }));
    const cactiPts = scatterInHex(seed + 13, 2, { minDist: 0.3, inner: 0.42 });
    const cacti = cactiPts.map((p) => ({ x: p.x, y: 0, z: p.z, s: p.s }));
    const arms = cactiPts.flatMap((p) => [
      { x: p.x + 0.03 * p.s, y: 0.07 * p.s, z: p.z, rz: -0.9, s: p.s },
      { x: p.x - 0.03 * p.s, y: 0.05 * p.s, z: p.z, rz: 0.9, s: p.s },
    ]);
    return { dunes, rocks, cacti, arms };
  }, [seed]);
  return (
    <>
      <Instances geometry={G.dune} material={M.dune} items={dunes} />
      <Instances geometry={G.rock} material={M.rock} items={rocks} />
      <Instances geometry={G.cactus} material={M.cactus} items={cacti} />
      <Instances geometry={G.arm} material={M.cactus} items={arms} />
    </>
  );
}

export function TerrainDecor({ terrain, seed }: { terrain: Terrain; seed: number }) {
  switch (terrain) {
    case 'forest':
      return <Forest seed={seed} />;
    case 'mountains':
      return <Mountains seed={seed} />;
    case 'hills':
      return <Hills seed={seed} />;
    case 'fields':
      return <Fields seed={seed} />;
    case 'pasture':
      return <Pasture seed={seed} />;
    case 'desert':
      return <Desert seed={seed} />;
  }
}
