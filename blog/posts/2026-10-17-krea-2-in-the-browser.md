---
title: A 12B image model, running in your browser
description: Krea 2 Turbo (12B) now runs fully in Chrome or Edge with WebGPU, straight from your ComfyUI models folder. No install, no server, no re-download.
date: 2026-10-17
---

Until now, running a big image model meant installing something: ComfyUI, Python, a launcher. We wanted to know how far the browser can go.

Today, **Krea 2 Turbo**, a 12-billion-parameter image model, runs fully inside a browser tab. The text encoder, the image model and the decoder all run on your own GPU, with WebGPU. Nothing to install, and no server makes the image.

[Try it in your browser →](https://dotstories.github.io/web-engine/pages/generate/)

## How it works

1. Open the page in Chrome or Edge.
2. Pick your ComfyUI `models` folder.
3. Write a prompt and press **Generate**.

The page reads the model files you already have, the same `fp8` files ComfyUI uses. Nothing is downloaded again, and nothing leaves your computer.

## How fast

On an RTX 4080 in Edge, one image takes:

- **about 41 seconds** at 512×512
- **about 136 seconds** at 1024×1024

That includes loading 13 GB of weights onto the GPU. It is slower than native ComfyUI for now, and we are working on speed.

## Why this was hard

Most ways to run models in the browser go through WebAssembly memory, which stops at 4 GB. Krea 2 needs about 18 GB of files. So we wrote a small WebGPU runtime of our own:

- **Weights go straight from the file to the GPU**, one layer at a time, never through WebAssembly memory.
- **fp8 weights are unpacked inside the GPU shaders**, because WebGPU has no fp8 type.
- **Every kernel is tested against a reference.** The text encoder, each transformer step and the decoder match ComfyUI's own code with a cosine similarity of 0.999999999 or better.

As far as we know, this is the first public 12B image model that runs end to end in a browser. If you know of an earlier one, tell us: we'd love to see it.

## What you need

- Chrome or Edge 113+ on a desktop
- A GPU with `shader-f16` support and about 16 GB of memory
- Krea 2's files in a ComfyUI `models` folder:
  - `diffusion_models/krea2_turbo_fp8_scaled.safetensors`
  - `text_encoders/qwen3vl_4b_fp8_scaled.safetensors`
  - `vae/qwen_image_vae.safetensors`

Not sure your computer can handle it? [Run the probe](https://dotstories.github.io/web-engine/pages/probe/) first.

Krea 2 has its own license. Read and follow it before you use the model.

## What's next

- Faster attention and half-precision activations
- Testing on Macs with unified memory
- **Run in the browser** for Krea 2 dots on [dotstories.com](https://dotstories.com)

## It's open source

The engine is Apache-2.0-licensed: [github.com/dotstories/web-engine](https://github.com/dotstories/web-engine). Issues, ideas and pull requests are welcome, and so are your test results on other GPUs. Come say hi on [Discord](https://discord.gg/TJWKQkkuHN).
