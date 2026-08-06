export const BACKGROUND_PALETTES = {
  latte: {
    name: 'latte',
    base: ['#e6e9ef', '#eff1f5'],
    auroras: [
      { color: '#8839ef', opacity: 0.08 },
      { color: '#ea76cb', opacity: 0.06 },
      { color: '#1e66f5', opacity: 0.05 },
    ],
    particles: { color: '#8839ef', opacity: 0.06 },
    ripples: { color: '#8839ef', opacity: 0.15 },
  },
  mocha: {
    name: 'mocha',
    base: ['#1e1e2e', '#313244'],
    auroras: [
      { color: '#cba6f7', opacity: 0.12 },
      { color: '#f5c2e7', opacity: 0.08 },
      { color: '#89b4fa', opacity: 0.07 },
    ],
    particles: { color: '#cba6f7', opacity: 0.1 },
    ripples: { color: '#cba6f7', opacity: 0.2 },
  },
  'tokyo-night': {
    name: 'tokyo-night',
    base: ['#1a1b26', '#24283b'],
    auroras: [
      { color: '#7aa2f7', opacity: 0.1 },
      { color: '#bb9af7', opacity: 0.08 },
      { color: '#7dcfff', opacity: 0.07 },
    ],
    particles: { color: '#7aa2f7', opacity: 0.08 },
    ripples: { color: '#7aa2f7', opacity: 0.18 },
  },
  everforest: {
    name: 'everforest',
    base: ['#1e2326', '#2d353b'],
    auroras: [
      { color: '#a7c080', opacity: 0.1 },
      { color: '#83c092', opacity: 0.08 },
      { color: '#7fbbb3', opacity: 0.07 },
    ],
    particles: { color: '#a7c080', opacity: 0.08 },
    ripples: { color: '#a7c080', opacity: 0.18 },
  },
  'rose-pine': {
    name: 'rose-pine',
    base: ['#191724', '#1f1d2e'],
    auroras: [
      { color: '#c4a7e7', opacity: 0.1 },
      { color: '#eb6f92', opacity: 0.08 },
      { color: '#9ccfd8', opacity: 0.07 },
    ],
    particles: { color: '#c4a7e7', opacity: 0.08 },
    ripples: { color: '#c4a7e7', opacity: 0.18 },
  },
  gruvbox: {
    name: 'gruvbox',
    base: ['#282828', '#3c3836'],
    auroras: [
      { color: '#fe8019', opacity: 0.1 },
      { color: '#fabd2f', opacity: 0.08 },
      { color: '#8ec07c', opacity: 0.07 },
    ],
    particles: { color: '#fe8019', opacity: 0.06 },
    ripples: { color: '#fe8019', opacity: 0.2 },
  },
  'frosted-glass': {
    name: 'frosted-glass',
    base: ['#eef2f6', '#f7fafc'],
    auroras: [
      { color: '#60a5fa', opacity: 0.08 },
      { color: '#93c5fd', opacity: 0.06 },
      { color: '#f472b6', opacity: 0.05 },
    ],
    particles: { color: '#60a5fa', opacity: 0.06 },
    ripples: { color: '#60a5fa', opacity: 0.15 },
  },
};

export function getPalette(theme) {
  return BACKGROUND_PALETTES[theme] || BACKGROUND_PALETTES.mocha;
}

export function lerpColor(c1, c2, t) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  };
  const a = parse(c1);
  const b = parse(c2);
  const r = Math.round((a.r + (b.r - a.r) * t) * 255);
  const g = Math.round((a.g + (b.g - a.g) * t) * 255);
  const bl = Math.round((a.b + (b.b - a.b) * t) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}