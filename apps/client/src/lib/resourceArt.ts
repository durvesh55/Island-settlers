import type { HarborType, Resource } from '@island/engine';

/**
 * Original hand-built SVG illustrations for each resource. They are plain strings so
 * the same art can be shown in the HTML UI (as <img>) and drawn onto 3D canvas textures.
 */
export const RESOURCE_SVG: Record<Resource, string> = {
  wood: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g stroke="#3d220d" stroke-width="1.6" stroke-linejoin="round">
    <path d="M10 40 h34 a7 7 0 0 1 0 14 h-34 a7 7 0 0 1 0 -14z" fill="#8a5528"/>
    <ellipse cx="44" cy="47" rx="6" ry="7" fill="#e7bd7f"/>
    <path d="M18 27 h34 a7 7 0 0 1 0 14 h-34 a7 7 0 0 1 0 -14z" fill="#9b6230"/>
    <ellipse cx="52" cy="34" rx="6" ry="7" fill="#efc88c"/>
    <path d="M6 22 h30 a7 7 0 0 1 0 14 h-30 a7 7 0 0 1 0 -14z" fill="#7d4a22"/>
    <ellipse cx="36" cy="29" rx="6" ry="7" fill="#e2b574"/>
  </g>
  <g fill="none" stroke="#a87336" stroke-width="1.1">
    <ellipse cx="44" cy="47" rx="3" ry="3.6"/><ellipse cx="52" cy="34" rx="3" ry="3.6"/><ellipse cx="36" cy="29" rx="3" ry="3.6"/>
  </g>
  <g stroke="#5c3415" stroke-width="1" opacity=".6"><path d="M12 46 h22M22 33 h24M9 28 h18"/></g>
</svg>`,
  brick: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g stroke="#4a1a0a" stroke-width="1.5" stroke-linejoin="round">
    <path d="M6 40 l14 -7 l22 0 l-14 7z" fill="#e0805a"/><path d="M6 40 h22 v10 h-22z" fill="#b9472a"/><path d="M28 40 l14 -7 v10 l-14 7z" fill="#8f3218"/>
    <path d="M30 40 l14 -7 l14 0 l-14 7z" fill="#e0805a"/><path d="M30 40 h14 v10 h-14z" fill="#c4502f"/><path d="M44 40 l14 -7 v10 l-14 7z" fill="#93361b"/>
    <path d="M14 28 l14 -7 l22 0 l-14 7z" fill="#e88c64"/><path d="M14 28 h22 v10 h-22z" fill="#c24e2e"/><path d="M36 28 l14 -7 v10 l-14 7z" fill="#983a1d"/>
  </g>
</svg>`,
  wool: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g stroke="#2a2a2a" stroke-width="1.4">
    <rect x="18" y="42" width="4" height="12" rx="1.5" fill="#2b2b2b"/><rect x="26" y="43" width="4" height="12" rx="1.5" fill="#2b2b2b"/>
    <rect x="36" y="43" width="4" height="12" rx="1.5" fill="#2b2b2b"/><rect x="43" y="42" width="4" height="12" rx="1.5" fill="#2b2b2b"/>
  </g>
  <g fill="#fbfaf4" stroke="#b9b5a6" stroke-width="1.3">
    <circle cx="20" cy="34" r="8"/><circle cx="28" cy="28" r="9"/><circle cx="38" cy="28" r="9"/><circle cx="45" cy="35" r="8"/>
    <circle cx="36" cy="40" r="8"/><circle cx="25" cy="40" r="8"/><circle cx="31" cy="34" r="9" stroke="none"/>
  </g>
  <ellipse cx="51" cy="27" rx="6" ry="8" fill="#2b2b2b" transform="rotate(25 51 27)"/>
  <ellipse cx="47" cy="22" rx="3" ry="1.6" fill="#2b2b2b" transform="rotate(-30 47 22)"/>
  <circle cx="53" cy="25" r="1.2" fill="#fff"/>
</svg>`,
  grain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g stroke="#8a5a0c" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M32 58 C32 44 31 30 30 12"/><path d="M32 58 C30 46 24 34 18 18"/><path d="M32 58 C34 46 40 34 46 18"/>
  </g>
  <g fill="#f2c443" stroke="#9a6510" stroke-width="1">
    <g id="k"><ellipse cx="30" cy="14" rx="3" ry="5"/><ellipse cx="27" cy="20" rx="2.8" ry="4.6" transform="rotate(-25 27 20)"/><ellipse cx="33" cy="20" rx="2.8" ry="4.6" transform="rotate(25 33 20)"/><ellipse cx="27" cy="27" rx="2.8" ry="4.6" transform="rotate(-25 27 27)"/><ellipse cx="33" cy="27" rx="2.8" ry="4.6" transform="rotate(25 33 27)"/></g>
    <ellipse cx="18" cy="19" rx="3" ry="5" transform="rotate(-20 18 19)"/><ellipse cx="17" cy="26" rx="2.6" ry="4.4" transform="rotate(-45 17 26)"/><ellipse cx="23" cy="25" rx="2.6" ry="4.4" transform="rotate(5 23 25)"/><ellipse cx="21" cy="32" rx="2.6" ry="4.4" transform="rotate(-40 21 32)"/>
    <ellipse cx="46" cy="19" rx="3" ry="5" transform="rotate(20 46 19)"/><ellipse cx="47" cy="26" rx="2.6" ry="4.4" transform="rotate(45 47 26)"/><ellipse cx="41" cy="25" rx="2.6" ry="4.4" transform="rotate(-5 41 25)"/><ellipse cx="43" cy="32" rx="2.6" ry="4.4" transform="rotate(40 43 32)"/>
  </g>
</svg>`,
  ore: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g stroke="#262a33" stroke-width="1.5" stroke-linejoin="round">
    <path d="M6 50 l6 -14 l12 -4 l8 10 l-4 10z" fill="#6f7685"/><path d="M12 36 l12 -4 l-2 8z" fill="#a3aab8"/>
    <path d="M26 52 l4 -16 l14 -8 l12 8 l2 16z" fill="#7c8494"/><path d="M30 36 l14 -8 l2 10 l-14 4z" fill="#b8bfcc"/><path d="M44 28 l12 8 l-10 2z" fill="#959dad"/>
    <path d="M18 34 l6 -12 l10 -2 l6 8 l-8 6z" fill="#8a92a2"/><path d="M24 22 l10 -2 l-4 8z" fill="#c9cfda"/>
  </g>
  <g fill="#e8eef8"><circle cx="40" cy="44" r="1.2"/><circle cx="14" cy="44" r="1"/><circle cx="28" cy="28" r="1"/></g>
</svg>`,
};

export const HARBOR_ANY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#4a2f1b" stroke-width="4" stroke-linecap="round">
    <circle cx="32" cy="14" r="5"/><path d="M32 19 V54"/><path d="M22 28 H42"/><path d="M12 40 C14 52 24 56 32 56 C40 56 50 52 52 40"/><path d="M12 40 l-3 5 M12 40 l5 3 M52 40 l3 5 M52 40 l-5 3"/>
  </g>
</svg>`;

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const RESOURCE_IMG: Record<Resource, string> = {
  wood: svgDataUrl(RESOURCE_SVG.wood),
  brick: svgDataUrl(RESOURCE_SVG.brick),
  wool: svgDataUrl(RESOURCE_SVG.wool),
  grain: svgDataUrl(RESOURCE_SVG.grain),
  ore: svgDataUrl(RESOURCE_SVG.ore),
};

export function harborImg(type: HarborType): string {
  return type === 'any' ? svgDataUrl(HARBOR_ANY_SVG) : RESOURCE_IMG[type];
}
