# CompressCompare (React)

A high-performance React web application that visualizes **where and how** social media sites (Instagram, Discord, Facebook, X / Twitter, TikTok, YouTube, Reddit, Threads, Bluesky, and more) alter and compress your images and videos.

Rewritten from the desktop C++ edition into a modern React + TypeScript + Tailwind CSS application for AI Studio, preserving core metrics, algorithms, forensics, and Lightroom-style comparison workflows.

## Features

- **Lightroom-Style Comparison Views**:
  - **Loupe**: Single-image inspect view with Before, After, Heat Map, and Overlay blending (hold `Space` to peek Before, `\` to flip).
  - **Before / After Left-Right**: Side-by-side view with synchronized pan and zoom.
  - **Before / After Top-Bottom**: Stacked comparison.
  - **Split Left-Right & Top-Bottom**: Interactive draggable divider line with center rotation handle, swap button, and double-click to center.
  - **Survey Grid**: Side-by-side multi-slot survey of every site upload.
- **Perceptual Metrics & Difference Heat Maps**:
  - **CIEDE2000 (ΔE2000)**: Standard perceptual color difference (Sharma, Wu & Dalal 2005 implementation).
  - **SSIM (1 − SSIM)**: Structural Similarity Index (Wang et al. 2004 with 11×11 Gaussian window).
  - **Absolute Difference**: Channel-max difference in levels (0–255).
  - **Luma Difference**: Rec. 601 luma difference.
  - **ΔE76**: Euclidean distance in CIELAB space.
  - **Squared Error**: Mean squared difference for PSNR calculation.
- **6 Piecewise-Linear Color Maps**:
  - Inferno, Viridis, Heat, Ice, Red Alert, and Grayscale.
  - Intensity slider with `[` and `]` shortcuts, proportional opacity ("opacity follows error"), gamma curve, and cut-off threshold.
  - 8×8 JPEG block view (`B` key) to average error over macroblocks.
  - 99th percentile auto-scaling or manual scale ceiling.
- **JPEG Forensics & Quantization Analysis**:
  - Direct binary parsing of JPEG marker segments (SOI, APP1 EXIF, APP2 ICC, DQT, SOF0/SOF2 baseline vs progressive).
  - DQT quantization table extraction and brute-force IJG quality estimation (q1–q100) with fit error percentage.
  - Chroma subsampling detection (`4:4:4`, `4:2:2`, `4:2:0`, `4:4:0`, `4:1:1`, `gray`).
  - Metadata survival check (EXIF, ICC color profiles).
- **Video Comparison**:
  - Scrubbing timeline with frame-step controls (`<< 1s`, `< frame`, `frame >`, `1s >>`).
  - "Sample quality over time" feature: compares evenly spaced frames across clips and plots interactive PSNR and SSIM graphs.
- **Site Database & Fuzzy Matcher**:
  - 24+ pre-configured platforms with aliases, host detection from pasted URLs, and detailed compression pipeline documentation.
- **Interactive Tools**:
  - Corner Loupe with 2× to 32× magnification and pixel grid at high zooms.
  - Cursor pixel inspector: live coordinates, original RGB, site RGB, Lab color, and metric difference.
  - PNG export of heat maps.
  - Built-in synthetic tutorial samples (Original, Instagram, Discord, Facebook, TikTok).

## Tech Stack

- **Framework**: React 18, Vite 6, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Engine**: Pure client-side Canvas and typed arrays for real-time pixel math

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
