import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DICE_ROLL_MS, useGameStore } from '../store/useGameStore';
import { seeded } from './shared';

const SIZE = 0.46;
const UP = new THREE.Vector3(0, 1, 0);

/** Face normals in die-local space for each value (opposite faces sum to 7). */
const FACE_NORMAL: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(1, 0, 0),
  5: new THREE.Vector3(-1, 0, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
};
/** BoxGeometry material order: +x, -x, +y, -y, +z, -z. */
const FACE_ORDER = [2, 5, 1, 6, 3, 4];

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

function faceTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 90);
  g.addColorStop(0, '#fffdf7');
  g.addColorStop(1, '#e6dccb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(120,100,70,.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);
  for (const [x, y] of PIP_LAYOUT[n]) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, 11, 0, Math.PI * 2);
    ctx.fillStyle = n === 1 ? '#a61c16' : '#231710';
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let materials: THREE.MeshStandardMaterial[] | null = null;
function dieMaterials() {
  if (!materials) materials = FACE_ORDER.map((n) => new THREE.MeshStandardMaterial({ map: faceTexture(n), roughness: 0.35 }));
  return materials;
}
const dieGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);

function restingQuaternion(value: number, yaw: number): THREE.Quaternion {
  const align = new THREE.Quaternion().setFromUnitVectors(FACE_NORMAL[value], UP);
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(align);
}

interface Anim {
  start: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  final: THREE.Quaternion;
  axis: THREE.Vector3;
  spins: number;
}

function Die({ index, value, seq, rest }: { index: number; value: number; seq: number; rest: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const anim = useRef<Anim | null>(null);
  const lastSeq = useRef(seq);
  const mats = useMemo(dieMaterials, []);
  const staticQuat = useMemo(() => restingQuaternion(value, index * 0.7 + 0.3), [value, index]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (seq !== lastSeq.current) {
      lastSeq.current = seq;
      const rand = seeded(seq * 31 + index * 7 + 1);
      const to = rest.clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5));
      anim.current = {
        start: clock.elapsedTime,
        from: new THREE.Vector3(to.x + 2.6 + index * 0.3, 1.8, to.z - 2.2),
        to,
        final: restingQuaternion(value, rand() * Math.PI * 2),
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spins: 2 + rand() * 2,
      };
    }
    const a = anim.current;
    if (!a) {
      mesh.position.set(rest.x, SIZE / 2, rest.z);
      mesh.quaternion.copy(staticQuat);
      return;
    }
    const dur = (DICE_ROLL_MS / 1000) * 0.92;
    const t = Math.min(1, (clock.elapsedTime - a.start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    mesh.position.lerpVectors(a.from, a.to, e);
    // falling arc then decaying bounces
    const fall = Math.max(0, 1 - t * 3) * 1.6;
    const bounce = Math.abs(Math.sin(t * Math.PI * 3.5)) * Math.pow(1 - t, 2) * 0.9;
    mesh.position.y = SIZE / 2 + Math.max(fall, bounce);
    const spin = new THREE.Quaternion().setFromAxisAngle(a.axis, (1 - e) * a.spins * Math.PI * 2);
    mesh.quaternion.copy(a.final).multiply(spin);
  });

  return <mesh ref={ref} geometry={dieGeo} material={mats} castShadow receiveShadow />;
}

/** Two ivory dice resting on the table; they tumble whenever the store starts a throw. */
export function Dice3D({ lastDice }: { lastDice: [number, number] | null }) {
  const diceThrow = useGameStore((s) => s.diceThrow);
  const rolling = useGameStore((s) => s.rolling);
  // While tumbling show the thrown values; afterwards always trust the game state.
  const values = (rolling ? diceThrow?.dice : lastDice) ?? lastDice ?? [6, 3];
  const seq = diceThrow?.seq ?? 0;
  const rests = useMemo(() => [new THREE.Vector3(-6.55, 0, 4.75), new THREE.Vector3(-5.85, 0, 5.35)], []);
  return (
    <>
      <Die index={0} value={values[0]} seq={seq} rest={rests[0]} />
      <Die index={1} value={values[1]} seq={seq} rest={rests[1]} />
    </>
  );
}
