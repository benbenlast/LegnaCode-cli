---
name: minimax-video
description: Generate videos using MiniMax AI. Use when the user wants to create video clips, animations, or motion content.
---

# MiniMax Video Generation Skill

Use the `MiniMaxVideoGenerate` tool to create videos from text prompts.

## Usage

When the user asks to generate, create, or make a video/clip/animation:

1. Call `MiniMaxVideoGenerate` with a descriptive prompt
2. Optionally provide `first_frame_image` URL for image-to-video generation
3. The tool handles async polling automatically — it will wait for completion
4. Return the download URL to the user

## Tips

- Video generation takes 1-5 minutes — inform the user it may take a moment
- For image-to-video, first generate an image with MiniMaxImageGenerate, then use its URL
- Be specific about motion: "camera slowly panning right", "zoom into the subject"

## Pipeline Example

```
User: "Make a promo video for this project"
1. Analyze project README for key features
2. Generate key frame image with MiniMaxImageGenerate
3. Generate video from that image with MiniMaxVideoGenerate
4. Optionally generate narration with MiniMaxSpeechSynthesize
```
