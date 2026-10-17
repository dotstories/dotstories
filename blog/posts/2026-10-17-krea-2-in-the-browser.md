---
title: A 12B image model now runs fully in your browser
description: Krea 2 Turbo runs in Chrome or Edge with WebGPU, straight from your ComfyUI models folder. No install, no server, no re-download. Open source.
date: 2026-10-17
---

Running a big image model usually means installing something first: ComfyUI, Python, the right drivers, a launcher. That's an afternoon gone before you see a single image.

Now you can skip all of it. **Krea 2 Turbo**, a 12-billion-parameter image model, runs fully in your browser.

## No install, no server, no re-download

- **No install.** Open a page in Chrome or Edge. That's it.
- **No server.** The image is made on your own GPU, with WebGPU. Your prompt and your images never leave your computer.
- **No re-download.** Point the page at your ComfyUI `models` folder and it uses the files you already have.

## Try it

1. Open the [Krea 2 page](https://dotstories.github.io/web-engine/pages/generate/) in Chrome or Edge.
2. Pick your ComfyUI `models` folder.
3. Write a prompt and press **Generate**.

You need these three files in that folder, the same ones ComfyUI uses:

- `diffusion_models/krea2_turbo_fp8_scaled.safetensors`
- `text_encoders/qwen3vl_4b_fp8_scaled.safetensors`
- `vae/qwen_image_vae.safetensors`

Have the Dark Fantasy Kit's `loras/krea2_darkbrush.safetensors` too? Pick it in the LoRA menu and get the same brush style as the [Dark Fantasy Thumbnail](https://dotstories.com/dots/dark-fantasy-thumbnail) dot.

## How fast is it?

On an RTX 4080, one image takes about **41 seconds** at 512×512 and about **136 seconds** at 1024×1024, including loading the model onto the GPU. That's slower than ComfyUI for now. We're working on it.

You'll need a desktop GPU with about 16 GB of memory. Not sure yours can do it? [Run the probe](https://dotstories.github.io/web-engine/pages/probe/) first: it checks your browser and GPU in a few seconds.

## Same result as ComfyUI

Browser AI usually stops at 4 GB, and Krea 2 needs about 18. So we wrote our own small engine: it moves the model from your disk to your GPU one layer at a time, and unpacks the `fp8` weights right on the GPU.

Every step is checked against ComfyUI's own code, so you get the image ComfyUI would make, not a rough copy.

## What's next

- Faster images
- Testing on Macs
- A **Run in the browser** button for Krea 2 dots on [dotstories.com](https://dotstories.com)

Krea 2 has its own license. Read it and follow it before you use the model.

## Open source

The engine is Apache-2.0-licensed and open to everyone: [github.com/dotstories/web-engine](https://github.com/dotstories/web-engine). Tried it on your GPU? Share your time on [Discord](https://discord.gg/TJWKQkkuHN).

[Make an image with Krea 2 in your browser →](https://dotstories.github.io/web-engine/pages/generate/)
