---
name: minimax-image
description: Generate images using MiniMax AI. Use when the user wants to create images, illustrations, photos, or visual content.
---

# MiniMax Image Generation Skill

Use the `MiniMaxImageGenerate` tool to create images from text prompts.

## Usage

When the user asks to generate, create, or make an image/picture/illustration:

1. Call `MiniMaxImageGenerate` with a detailed prompt
2. Optionally specify `n` (number of images, 1-9) and `aspect_ratio` ("1:1", "16:9", "9:16")
3. Return the image URLs to the user

## Tips

- Be descriptive in prompts: include style, lighting, composition, colors
- Default aspect ratio is 1:1, use 16:9 for landscapes, 9:16 for portraits
- Generate multiple variants with `n: 3` for the user to choose from

## Examples

- "Generate a logo for my app" → prompt: "Modern minimalist app logo, clean lines, gradient colors, centered composition"
- "Make a banner image" → prompt with aspect_ratio: "16:9"
