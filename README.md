<div align="center">

# color-palette

**Convert HEX, RGB, HSL, and ANSI colors in your terminal — with palette generation and WCAG contrast checking.**

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen?labelColor=0B0A09)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/color-palette "#FF6B6B"
```

Or install globally for the `color-palette` / `cpal` commands:

```bash
npm install -g github:NickCirv/color-palette
```

## Usage

```bash
# Convert a color — shows HEX, RGB, HSL, HSV, ANSI 256, ANSI 16 + terminal preview
color-palette "#FF6B6B"
color-palette "rgb(255,107,107)"
color-palette "hsl(0,100%,71%)"
color-palette --ansi 196

# Generate a color palette
color-palette palette "#FF6B6B" --scheme triadic --count 3

# Blend two colors
color-palette mix "#FF6B6B" "#4ECDC4" --steps 7

# WCAG contrast check
color-palette contrast "#FF6B6B" "#FFFFFF"

# Adjust lightness / saturation
color-palette lighten "#FF6B6B" --amount 20
color-palette darken  "#FF6B6B" --amount 20

# Random color, ANSI charts, nearest ANSI match
color-palette random
color-palette ansi-chart
color-palette nearest "#FF6B6B"
```

| Command | Description |
|---------|-------------|
| `<color>` | Show all formats + terminal preview |
| `--ansi <n>` | Look up ANSI 256 color (0–255) |
| `mix <c1> <c2> [--steps N]` | Gradient between two colors |
| `palette <color> --scheme <name> [--count N]` | Generate a color scheme |
| `lighten/darken <color> [--amount N]` | Adjust lightness by N% (default 10) |
| `saturate/desaturate <color> [--amount N]` | Adjust saturation by N% |
| `contrast <c1> <c2>` | WCAG contrast ratio + AA/AAA result |
| `random` | Generate a random color |
| `ansi-chart` | Full 256-color ANSI chart |
| `ansi-16` | Standard 16 ANSI colors |
| `nearest <color>` | Find nearest ANSI 256 match |

**Palette schemes:** `analogous` · `complementary` · `triadic` · `tetradic` · `monochromatic`

**Input formats:** `#FF6B6B` · `FF6B6B` · `rgb(255,107,107)` · `hsl(0,100%,71%)` · `--ansi 196`

## What it does

`color-palette` is a zero-dependency CLI for working with colors in the terminal. It converts between HEX, RGB, HSL, HSV, ANSI 256, and ANSI 16 formats with a live 24-bit true-color preview block. The WCAG contrast checker reports AA and AAA pass/fail for both normal and large text. All color math is implemented in pure JavaScript — no chalk, no tinycolor2, no external packages.

---
<sub>Zero dependencies · Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
