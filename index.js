#!/usr/bin/env node
// color-palette — Terminal color tool
// Zero external dependencies. Built-in modules only.

import { argv, stdout } from 'process';

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const ESC = '\x1b';
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;

function bg24(r, g, b) { return `${ESC}[48;2;${r};${g};${b}m`; }
function fg24(r, g, b) { return `${ESC}[38;2;${r};${g};${b}m`; }
function fgAnsi(n)     { return n < 8 ? `${ESC}[${30+n}m` : `${ESC}[${82+n}m`; }
function bgAnsi(n)     { return n < 8 ? `${ESC}[${40+n}m` : `${ESC}[${92+n}m`; }

// ─── Color Conversion ────────────────────────────────────────────────────────

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToRgb({ h, s, v }) {
  h /= 360; s /= 100; v /= 100;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}

// rgb → ansi256: 6x6x6 cube + grayscale ramp
function rgbToAnsi256({ r, g, b }) {
  // Grayscale check
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

// ansi256 → rgb approximation
function ansi256ToRgb(n) {
  if (n < 16) {
    // Standard 16 colors
    const base = [
      [0,0,0],[128,0,0],[0,128,0],[128,128,0],
      [0,0,128],[128,0,128],[0,128,128],[192,192,192],
      [128,128,128],[255,0,0],[0,255,0],[255,255,0],
      [0,0,255],[255,0,255],[0,255,255],[255,255,255]
    ];
    const c = base[n];
    return { r: c[0], g: c[1], b: c[2] };
  }
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return { r: v, g: v, b: v };
  }
  n -= 16;
  const cubeValues = [0, 95, 135, 175, 215, 255];
  const ri = Math.floor(n / 36);
  const gi = Math.floor((n % 36) / 6);
  const bi = n % 6;
  return { r: cubeValues[ri], g: cubeValues[gi], b: cubeValues[bi] };
}

// nearest ANSI16
function rgbToAnsi16({ r, g, b }) {
  const brightness = Math.round(0.299*r + 0.587*g + 0.114*b) / 255;
  const dr = r > 128 ? 1 : 0, dg = g > 128 ? 1 : 0, db = b > 128 ? 1 : 0;
  const code = dr | (dg << 1) | (db << 2);
  const remap = [0, 4, 2, 6, 1, 5, 3, 7];
  return remap[code] + (brightness > 0.5 ? 8 : 0);
}

// ─── Input Parsing ───────────────────────────────────────────────────────────

function parseColor(input) {
  if (!input) return null;
  input = input.trim();

  // HEX
  if (/^#?[0-9a-fA-F]{3,6}$/.test(input)) {
    const rgb = hexToRgb(input.startsWith('#') ? input : '#' + input);
    if (rgb) return rgb;
  }

  // rgb(R,G,B) or rgb(R, G, B)
  const rgbMatch = input.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  }

  // hsl(H,S%,L%) or hsl(H, S%, L%)
  const hslMatch = input.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)$/i);
  if (hslMatch) {
    return hslToRgb({ h: +hslMatch[1], s: +hslMatch[2], l: +hslMatch[3] });
  }

  // ANSI 256 bare number handled separately via --ansi flag
  return null;
}

// ─── Display Helpers ─────────────────────────────────────────────────────────

function colorBlock(rgb, width = 16) {
  return `${bg24(rgb.r, rgb.g, rgb.b)}${' '.repeat(width)}${RESET}`;
}

function luminance({ r, g, b }) {
  const lin = v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(rgb1, rgb2) {
  const l1 = luminance(rgb1), l2 = luminance(rgb2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function printColorInfo(rgb, label = null) {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const a256 = rgbToAnsi256(rgb);
  const a16  = rgbToAnsi16(rgb);

  const preview = colorBlock(rgb, 20);
  const fg = luminance(rgb) > 0.4 ? `${ESC}[30m` : `${ESC}[97m`;

  if (label) console.log(`\n${BOLD}${label}${RESET}`);
  console.log(`  ${preview}`);
  console.log(`  ${BOLD}HEX  ${RESET}  ${hex}`);
  console.log(`  ${BOLD}RGB  ${RESET}  rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
  console.log(`  ${BOLD}HSL  ${RESET}  hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
  console.log(`  ${BOLD}HSV  ${RESET}  hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`);
  console.log(`  ${BOLD}ANSI256${RESET}  ${a256}  ${bgAnsi(a256)}  ${a256}  ${RESET}`);
  console.log(`  ${BOLD}ANSI16 ${RESET}  ${a16}   ${bgAnsi(a16)}  ${a16}  ${RESET}`);
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdSingle(input, ansiFlag) {
  let rgb;
  if (ansiFlag !== null) {
    const n = parseInt(ansiFlag, 10);
    if (isNaN(n) || n < 0 || n > 255) { console.error('ANSI code must be 0-255'); process.exit(1); }
    rgb = ansi256ToRgb(n);
    console.log(`\n${BOLD}ANSI 256 Color ${n}${RESET}`);
  } else {
    rgb = parseColor(input);
    if (!rgb) { console.error(`Cannot parse color: ${input}`); process.exit(1); }
  }
  printColorInfo(rgb);
  console.log();
}

function cmdMix(c1, c2, steps) {
  const rgb1 = parseColor(c1), rgb2 = parseColor(c2);
  if (!rgb1) { console.error(`Cannot parse: ${c1}`); process.exit(1); }
  if (!rgb2) { console.error(`Cannot parse: ${c2}`); process.exit(1); }
  steps = Math.max(2, Math.min(20, steps));

  console.log(`\n${BOLD}Gradient: ${rgbToHex(rgb1)} → ${rgbToHex(rgb2)} (${steps} steps)${RESET}\n`);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const rgb = {
      r: Math.round(rgb1.r + (rgb2.r - rgb1.r) * t),
      g: Math.round(rgb1.g + (rgb2.g - rgb1.g) * t),
      b: Math.round(rgb1.b + (rgb2.b - rgb1.b) * t),
    };
    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);
    const block = colorBlock(rgb, 12);
    console.log(`  ${block}  ${hex}  rgb(${rgb.r},${rgb.g},${rgb.b})  hsl(${hsl.h},${hsl.s}%,${hsl.l}%)`);
  }
  console.log();
}

function cmdPalette(input, scheme, count) {
  const rgb = parseColor(input);
  if (!rgb) { console.error(`Cannot parse: ${input}`); process.exit(1); }
  count = Math.max(2, Math.min(12, count));

  const hsl = rgbToHsl(rgb);
  let angles = [];

  switch (scheme) {
    case 'analogous':
      angles = Array.from({length: count}, (_, i) => (i - Math.floor(count/2)) * 30);
      break;
    case 'complementary':
      angles = [0, 180];
      break;
    case 'triadic':
      angles = [0, 120, 240];
      break;
    case 'tetradic':
      angles = [0, 90, 180, 270];
      break;
    case 'monochromatic':
      angles = new Array(count).fill(0);
      break;
    default:
      console.error(`Unknown scheme: ${scheme}. Use analogous|complementary|triadic|tetradic|monochromatic`);
      process.exit(1);
  }

  // For monochromatic, vary lightness
  const colors = scheme === 'monochromatic'
    ? Array.from({length: count}, (_, i) => {
        const l = Math.round(20 + (i / (count - 1)) * 60);
        return hslToRgb({ h: hsl.h, s: hsl.s, l });
      })
    : angles.map(a => hslToRgb({ h: (hsl.h + a + 360) % 360, s: hsl.s, l: hsl.l }));

  console.log(`\n${BOLD}${scheme.charAt(0).toUpperCase()+scheme.slice(1)} palette from ${rgbToHex(rgb)}${RESET}\n`);
  colors.forEach((c, i) => {
    const hex = rgbToHex(c);
    const chsl = rgbToHsl(c);
    const block = colorBlock(c, 12);
    console.log(`  ${block}  ${hex}  hsl(${chsl.h},${chsl.s}%,${chsl.l}%)`);
  });
  console.log();
}

function adjustHsl(input, prop, amount) {
  const rgb = parseColor(input);
  if (!rgb) { console.error(`Cannot parse: ${input}`); process.exit(1); }
  const hsl = rgbToHsl(rgb);

  if (prop === 'l') hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
  if (prop === 's') hsl.s = Math.max(0, Math.min(100, hsl.s + amount));

  const newRgb = hslToRgb(hsl);
  console.log(`\n${BOLD}${rgbToHex(rgb)} → ${rgbToHex(newRgb)}${RESET}`);
  printColorInfo(newRgb);
  console.log();
}

function cmdContrast(c1, c2) {
  const rgb1 = parseColor(c1), rgb2 = parseColor(c2);
  if (!rgb1) { console.error(`Cannot parse: ${c1}`); process.exit(1); }
  if (!rgb2) { console.error(`Cannot parse: ${c2}`); process.exit(1); }

  const ratio = contrastRatio(rgb1, rgb2);
  const ratioStr = ratio.toFixed(2);
  const aaLarge = ratio >= 3.0, aaSmall = ratio >= 4.5, aaaLarge = ratio >= 4.5, aaaSmall = ratio >= 7.0;

  const pass = `${ESC}[32m✓ PASS${RESET}`;
  const fail = `${ESC}[31m✗ FAIL${RESET}`;

  console.log(`\n${BOLD}WCAG Contrast: ${rgbToHex(rgb1)} vs ${rgbToHex(rgb2)}${RESET}\n`);
  console.log(`  ${colorBlock(rgb1, 8)}  ${colorBlock(rgb2, 8)}`);
  console.log(`\n  ${BOLD}Ratio:${RESET} ${BOLD}${ratioStr}:1${RESET}\n`);
  console.log(`  ${BOLD}AA  Normal text ${RESET}  (4.5:1)   ${aaSmall  ? pass : fail}`);
  console.log(`  ${BOLD}AA  Large text  ${RESET}  (3.0:1)   ${aaLarge  ? pass : fail}`);
  console.log(`  ${BOLD}AAA Normal text${RESET}  (7.0:1)   ${aaaSmall ? pass : fail}`);
  console.log(`  ${BOLD}AAA Large text ${RESET}  (4.5:1)   ${aaaLarge ? pass : fail}`);
  console.log();
}

function cmdRandom() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  console.log(`\n${BOLD}Random Color${RESET}`);
  printColorInfo({ r, g, b });
  console.log();
}

function cmdAnsiChart() {
  console.log(`\n${BOLD}ANSI 256-Color Chart${RESET}\n`);

  // Standard 16
  console.log(`${BOLD}Standard 16 Colors:${RESET}`);
  let row = '  ';
  for (let i = 0; i < 16; i++) {
    const rgb = ansi256ToRgb(i);
    row += `${bg24(rgb.r,rgb.g,rgb.b)} ${String(i).padStart(3)} ${RESET} `;
    if ((i+1) % 8 === 0) { console.log(row); row = '  '; }
  }

  // 6x6x6 cube
  console.log(`\n${BOLD}6x6x6 Color Cube (16–231):${RESET}`);
  for (let ri = 0; ri < 6; ri++) {
    let line = '  ';
    for (let gi = 0; gi < 6; gi++) {
      for (let bi = 0; bi < 6; bi++) {
        const n = 16 + 36*ri + 6*gi + bi;
        const rgb = ansi256ToRgb(n);
        line += `${bg24(rgb.r,rgb.g,rgb.b)} ${String(n).padStart(3)} ${RESET}`;
      }
      line += '  ';
    }
    console.log(line);
  }

  // Grayscale
  console.log(`\n${BOLD}Grayscale Ramp (232–255):${RESET}`);
  let gRow = '  ';
  for (let i = 232; i <= 255; i++) {
    const rgb = ansi256ToRgb(i);
    gRow += `${bg24(rgb.r,rgb.g,rgb.b)} ${String(i).padStart(3)} ${RESET} `;
    if ((i-232+1) % 8 === 0) { console.log(gRow); gRow = '  '; }
  }
  console.log();
}

function cmdAnsi16() {
  const names = ['Black','Red','Green','Yellow','Blue','Magenta','Cyan','White',
                 'Bright Black','Bright Red','Bright Green','Bright Yellow',
                 'Bright Blue','Bright Magenta','Bright Cyan','Bright White'];
  console.log(`\n${BOLD}Standard ANSI 16 Colors${RESET}\n`);
  for (let i = 0; i < 16; i++) {
    const rgb = ansi256ToRgb(i);
    const fg = luminance(rgb) > 0.3 ? '\x1b[30m' : '\x1b[97m';
    const block = `${bg24(rgb.r,rgb.g,rgb.b)}${fg} ${String(i).padStart(2)} ${RESET}`;
    const hex = rgbToHex(rgb);
    console.log(`  ${block}  ${String(i).padStart(2)}  ${names[i].padEnd(14)}  ${hex}`);
  }
  console.log();
}

function cmdNearest(input) {
  const rgb = parseColor(input);
  if (!rgb) { console.error(`Cannot parse: ${input}`); process.exit(1); }

  // brute-force find nearest ansi256
  let bestN = 0, bestDist = Infinity;
  for (let n = 0; n <= 255; n++) {
    const c = ansi256ToRgb(n);
    const dist = Math.pow(c.r-rgb.r,2) + Math.pow(c.g-rgb.g,2) + Math.pow(c.b-rgb.b,2);
    if (dist < bestDist) { bestDist = dist; bestN = n; }
  }
  const nearest = ansi256ToRgb(bestN);

  console.log(`\n${BOLD}Nearest ANSI 256 color to ${rgbToHex(rgb)}${RESET}\n`);
  console.log(`  Input:   ${colorBlock(rgb, 10)}  ${rgbToHex(rgb)}`);
  console.log(`  Nearest: ${colorBlock(nearest, 10)}  ${rgbToHex(nearest)}  (ANSI ${bestN})`);
  console.log(`  Distance: ${Math.sqrt(bestDist).toFixed(1)}`);
  console.log();
}

function printHelp() {
  console.log(`
${BOLD}color-palette${RESET} — Terminal color tool. Zero dependencies.

${BOLD}USAGE${RESET}
  color-palette <color>                    Show all formats + preview
  color-palette --ansi <0-255>             Show ANSI 256 color info

${BOLD}INPUT FORMATS${RESET}
  #FF6B6B  |  FF6B6B                       HEX
  rgb(255,107,107)                         RGB
  hsl(0,100%,71%)                          HSL

${BOLD}COMMANDS${RESET}
  mix <color1> <color2> [--steps N]        Gradient between two colors (default 5)
  palette <color> --scheme <name>          Generate color scheme
    schemes: analogous|complementary|triadic|tetradic|monochromatic
    [--count N]                            Number of colors (default 5)
  lighten <color> --amount N               Lighten by N% (default 10)
  darken <color> --amount N                Darken by N% (default 10)
  saturate <color> --amount N              Saturate by N% (default 10)
  desaturate <color> --amount N            Desaturate by N% (default 10)
  contrast <color1> <color2>               WCAG contrast ratio + AA/AAA
  random                                   Generate random color
  ansi-chart                               Full 256-color ANSI chart
  ansi-16                                  Standard 16 ANSI colors
  nearest <color>                          Find nearest ANSI 256 color

${BOLD}EXAMPLES${RESET}
  color-palette "#FF6B6B"
  color-palette "rgb(255,107,107)"
  color-palette --ansi 196
  color-palette mix "#FF6B6B" "#4ECDC4" --steps 7
  color-palette palette "#FF6B6B" --scheme triadic --count 3
  color-palette contrast "#FF6B6B" "#FFFFFF"
  color-palette lighten "#FF6B6B" --amount 20
  color-palette darken "#FF6B6B" --amount 20
  color-palette random
  color-palette ansi-chart
  color-palette nearest "#FF6B6B"
`);
}

// ─── Arg Parsing ─────────────────────────────────────────────────────────────

function getFlag(args, flag, defaultVal = null) {
  const i = args.indexOf(flag);
  if (i === -1) return defaultVal;
  return args[i + 1] ?? defaultVal;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function main() {
  const args = argv.slice(2);

  if (args.length === 0 || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printHelp();
    return;
  }

  const cmd = args[0];

  // --ansi flag at top level
  if (hasFlag(args, '--ansi')) {
    const code = getFlag(args, '--ansi');
    cmdSingle(null, code);
    return;
  }

  switch (cmd) {
    case 'mix': {
      const c1 = args[1], c2 = args[2];
      if (!c1 || !c2) { console.error('Usage: mix <color1> <color2> [--steps N]'); process.exit(1); }
      const steps = parseInt(getFlag(args, '--steps', '5'), 10);
      cmdMix(c1, c2, steps);
      break;
    }
    case 'palette': {
      const color = args[1];
      if (!color) { console.error('Usage: palette <color> --scheme <name>'); process.exit(1); }
      const scheme = getFlag(args, '--scheme', 'analogous');
      const count  = parseInt(getFlag(args, '--count', '5'), 10);
      cmdPalette(color, scheme, count);
      break;
    }
    case 'lighten': {
      const color = args[1];
      if (!color) { console.error('Usage: lighten <color> [--amount N]'); process.exit(1); }
      const amount = parseInt(getFlag(args, '--amount', '10'), 10);
      adjustHsl(color, 'l', +amount);
      break;
    }
    case 'darken': {
      const color = args[1];
      if (!color) { console.error('Usage: darken <color> [--amount N]'); process.exit(1); }
      const amount = parseInt(getFlag(args, '--amount', '10'), 10);
      adjustHsl(color, 'l', -amount);
      break;
    }
    case 'saturate': {
      const color = args[1];
      if (!color) { console.error('Usage: saturate <color> [--amount N]'); process.exit(1); }
      const amount = parseInt(getFlag(args, '--amount', '10'), 10);
      adjustHsl(color, 's', +amount);
      break;
    }
    case 'desaturate': {
      const color = args[1];
      if (!color) { console.error('Usage: desaturate <color> [--amount N]'); process.exit(1); }
      const amount = parseInt(getFlag(args, '--amount', '10'), 10);
      adjustHsl(color, 's', -amount);
      break;
    }
    case 'contrast': {
      const c1 = args[1], c2 = args[2];
      if (!c1 || !c2) { console.error('Usage: contrast <color1> <color2>'); process.exit(1); }
      cmdContrast(c1, c2);
      break;
    }
    case 'random':
      cmdRandom();
      break;
    case 'ansi-chart':
      cmdAnsiChart();
      break;
    case 'ansi-16':
      cmdAnsi16();
      break;
    case 'nearest': {
      const color = args[1];
      if (!color) { console.error('Usage: nearest <color>'); process.exit(1); }
      cmdNearest(color);
      break;
    }
    default:
      // Treat as color input
      cmdSingle(cmd, null);
      break;
  }
}

main();
