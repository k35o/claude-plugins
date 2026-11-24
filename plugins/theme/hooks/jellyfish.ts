type Dot = readonly [cx: number, cy: number, r: number]
type Legs = { paths: readonly string[]; dots: readonly Dot[] }

const BASE = '#0f1214'
const GLOW = '#06a995'
const LEGS = '#69d2da'
const LEGS_OPACITY = 0.38
const SIDE = 1000
const ART_SIDE = 240
const TOP_RIGHT_SIZE = 280
const BOTTOM_RIGHT_SIZE = 230

// k8o.me では左上から流すが、アプリの左上はサイドバーに隠れるので、左右を反転して右上に置く。
const TOP_RIGHT: Legs = {
  paths: [
    'M 6 -16 C 36 36, 18 86, 70 116 C 104 135, 92 182, 138 196',
    'M -16 26 C 40 44, 72 78, 72 124 C 72 158, 104 176, 116 208',
    'M -8 72 C 28 80, 44 104, 40 140 C 38 162, 52 176, 70 186',
  ],
  dots: [
    [58, 104, 2],
    [84, 142, 2],
    [112, 180, 2],
    [72, 126, 1.8],
    [104, 176, 1.8],
    [42, 140, 1.8],
    [60, 182, 1.6],
  ],
}

const BOTTOM_RIGHT: Legs = {
  paths: [
    'M -10 12 C 52 32, 30 92, 80 126 C 112 148, 98 198, 134 216',
    'M -6 52 C 32 72, 50 112, 46 152 C 43 186, 62 202, 82 216',
  ],
  dots: [
    [62, 108, 1.8],
    [96, 160, 1.8],
    [50, 150, 1.6],
  ],
}

const legs = ({ paths, dots }: Legs) =>
  `<g fill="none" stroke="${LEGS}" stroke-opacity="${LEGS_OPACITY}" stroke-width="1.4" stroke-linecap="round">` +
  paths.map(d => `<path d="${d}"/>`).join('') +
  '</g>' +
  `<g fill="${LEGS}" fill-opacity="${LEGS_OPACITY}">` +
  dots.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('') +
  '</g>'

const corner = (align: string, transform: string, art: Legs) =>
  `<svg width="100%" height="100%" viewBox="0 0 ${SIDE} ${SIDE}" preserveAspectRatio="${align} meet">` +
  `<g transform="${transform}">${legs(art)}</g>` +
  '</svg>'

// 外側の svg に viewBox を持たせると、窓の縦横比に合わせて端が切り落とされ、隅に置いた足が欠ける。
// 外側は窓の寸法をそのまま座標にして、足は入れ子の svg で隅に留める。
export const JELLYFISH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">' +
  '<defs>' +
  '<radialGradient id="glow" cx="0.5" cy="-0.08" r="1" gradientTransform="translate(0.5 -0.08) scale(1.1 0.5) translate(-0.5 0.08)">' +
  `<stop offset="0" stop-color="${GLOW}" stop-opacity="0.1"/>` +
  `<stop offset="0.6" stop-color="${GLOW}" stop-opacity="0"/>` +
  '</radialGradient>' +
  '</defs>' +
  `<rect width="100%" height="100%" fill="${BASE}"/>` +
  '<rect width="100%" height="100%" fill="url(#glow)"/>' +
  corner(
    'xMaxYMin',
    `translate(${SIDE} 0) scale(${-TOP_RIGHT_SIZE / ART_SIDE} ${TOP_RIGHT_SIZE / ART_SIDE})`,
    TOP_RIGHT,
  ) +
  corner(
    'xMaxYMax',
    `translate(${SIDE} ${SIDE}) rotate(180) scale(${BOTTOM_RIGHT_SIZE / ART_SIDE})`,
    BOTTOM_RIGHT,
  ) +
  '</svg>'
