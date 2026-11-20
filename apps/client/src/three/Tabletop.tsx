import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Board } from '@island/engine';
import { woodTableTexture } from '../lib/textures';
import { insideConvex, offsetConvex, SEA_RADIUS, seaShape, seeded, stdMat, type SeaShape } from './shared';

const seaVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPos = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const seaFragment = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  varying vec2 vPos;
  void main() {
    float d = length(vPos) / uScale;
    float shallow = smoothstep(5.6, 3.8, d);
    vec3 deep = vec3(0.04, 0.22, 0.42);
    vec3 mid = vec3(0.08, 0.40, 0.62);
    vec3 col = mix(deep, mid, shallow);
    float w = sin(vPos.x * 3.1 + uTime * 0.7) * sin(vPos.y * 2.7 - uTime * 0.55)
            + 0.5 * sin((vPos.x + vPos.y) * 5.3 + uTime * 1.2);
    col += w * 0.025;
    float caustic = pow(abs(sin(vPos.x * 6.0 + sin(vPos.y * 4.0 + uTime * 0.8) * 1.6 + uTime * 0.4)), 14.0)
                  * pow(abs(sin(vPos.y * 5.0 + sin(vPos.x * 3.0 - uTime * 0.6) * 1.4)), 6.0);
    col += caustic * 0.22;
    float edge = smoothstep(${SEA_RADIUS.toFixed(2)} - 0.5, ${SEA_RADIUS.toFixed(2)}, d * 1.04);
    col *= 1.0 - edge * 0.45;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const toShape = (pts: { x: number; z: number }[]) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));

function Sea({ shape }: { shape: SeaShape }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uScale: { value: shape.scale } },
        vertexShader: seaVertex,
        fragmentShader: seaFragment,
      }),
    [shape.scale],
  );
  const geo = useMemo(() => new THREE.ShapeGeometry(toShape(shape.sea)), [shape]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} material={mat} geometry={geo} />;
}

function Frame({ shape }: { shape: SeaShape }) {
  const geo = useMemo(() => {
    const outer = toShape(shape.frame);
    outer.holes.push(new THREE.Path(shape.sea.map((p) => new THREE.Vector2(p.x, -p.z))));
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [shape]);
  const mat = useMemo(() => {
    const tex = woodTableTexture().clone();
    tex.repeat.set(0.35, 0.35);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, color: '#b07a4a', roughness: 0.6 });
  }, []);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

function Table() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTableTexture(), roughness: 0.7, color: '#d9b08a' }), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} material={mat} receiveShadow>
      <planeGeometry args={[70, 70]} />
    </mesh>
  );
}

const isletRock = new THREE.DodecahedronGeometry(0.22, 0);
const isletGrass = new THREE.CylinderGeometry(0.16, 0.2, 0.06, 7);
const isletSand = new THREE.CylinderGeometry(0.32, 0.36, 0.03, 9);

/** Small decorative islets dotted around the sea, kept clear of the harbors. */
function Islets({ board, shape }: { board: Board; shape: SeaShape }) {
  const islets = useMemo(() => {
    const rand = seeded(board.seed % 100000);
    const harborAngles = board.harbors.map((h) => Math.atan2(h.y, h.x));
    const large = board.size === 'large';
    // the large island's islets sit in the band between the harbors and the frame
    const inner = large ? offsetConvex(shape.hull, 1.55) : [];
    const outer = large ? offsetConvex(shape.hull, 1.95) : [];
    const out: { x: number; z: number; s: number; r: number }[] = [];
    let tries = 0;
    while (out.length < (large ? 9 : 6) && tries++ < 600) {
      let x: number;
      let z: number;
      if (large) {
        const span = shape.scale * 7.5;
        x = (rand() * 2 - 1) * span;
        z = (rand() * 2 - 1) * span;
        if (insideConvex(inner, { x, z }) || !insideConvex(outer, { x, z })) continue;
      } else {
        const a = rand() * Math.PI * 2;
        const d = 4.95 + rand() * 0.35;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      }
      const ang = Math.atan2(z, x);
      const clear = large
        ? board.harbors.every((h) => Math.hypot(h.x + h.nx * 0.5 - x, h.y + h.ny * 0.5 - z) > 1.3)
        : harborAngles.every((h) => Math.abs(Math.atan2(Math.sin(ang - h), Math.cos(ang - h))) > 0.32);
      const spaced = out.every((o) => Math.hypot(o.x - x, o.z - z) > 1.6);
      if (clear && spaced) out.push({ x, z, s: 0.55 + rand() * 0.5, r: rand() * 6 });
    }
    return out;
  }, [board, shape]);
  return (
    <>
      {islets.map((i, k) => (
        <group key={k} position={[i.x, 0.02, i.z]} scale={i.s} rotation-y={i.r}>
          <mesh geometry={isletSand} material={stdMat('#e0c78e', { roughness: 1 })} receiveShadow />
          <mesh geometry={isletRock} material={stdMat('#7b7d84', { flat: true })} position={[0.05, 0.06, 0]} scale={[1, 0.65, 0.9]} castShadow />
          <mesh geometry={isletGrass} material={stdMat('#5a9a3a', { flat: true })} position={[-0.08, 0.06, 0.05]} castShadow />
        </group>
      ))}
    </>
  );
}

export function Tabletop({ board }: { board: Board }) {
  const lantern = useRef<THREE.PointLight>(null);
  const shape = useMemo(() => seaShape(board), [board]);
  useFrame(({ clock }) => {
    if (lantern.current) lantern.current.intensity = 26 + Math.sin(clock.elapsedTime * 7) * 1.5 + Math.sin(clock.elapsedTime * 13) * 1;
  });
  return (
    <>
      <Table />
      <Sea shape={shape} />
      <Frame shape={shape} />
      <Islets board={board} shape={shape} />
      <pointLight ref={lantern} position={[9, 3.5, -7]} distance={22} color="#ffb35c" />
    </>
  );
}
