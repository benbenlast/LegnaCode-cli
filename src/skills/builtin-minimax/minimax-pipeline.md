---
name: minimax-pipeline
description: Orchestrate multi-step multimodal workflows combining MiniMax image, video, speech, music, vision, and search tools.
---

# MiniMax Multimodal Pipeline Skill

When the user requests complex multimodal content (e.g. "make a promo video with narration"), orchestrate multiple MiniMax tools in sequence.

## Available MiniMax Tools

| Tool | Purpose |
|------|---------|
| `MiniMaxImageGenerate` | Text → Image |
| `MiniMaxVideoGenerate` | Text/Image → Video |
| `MiniMaxSpeechSynthesize` | Text → Speech audio |
| `MiniMaxMusicGenerate` | Text → Music audio |
| `MiniMaxVisionDescribe` | Image → Text description |
| `MiniMaxWebSearch` | Query → Search results |

## Pipeline Patterns

### Promo Video Pipeline
1. Analyze project (read README, key files)
2. `MiniMaxImageGenerate` — generate key visual
3. `MiniMaxVideoGenerate` with `first_frame_image` — animate the visual
4. `MiniMaxSpeechSynthesize` — generate narration script
5. Return all URLs to user

### Content Creation Pipeline
1. `MiniMaxWebSearch` — research the topic
2. Write content based on research
3. `MiniMaxImageGenerate` — create illustrations
4. `MiniMaxSpeechSynthesize` — create audio version

### Image Analysis Pipeline
1. `MiniMaxVisionDescribe` — analyze existing image
2. Use description to generate variations with `MiniMaxImageGenerate`

### Music + Narration Pipeline
1. Write script
2. `MiniMaxSpeechSynthesize` — narrate the script
3. `MiniMaxMusicGenerate` — create background music

## Tips

- Always inform the user that generation may take time (especially video: 1-5 min)
- Chain outputs: use image URLs from ImageGenerate as input to VideoGenerate
- For long content, split into segments and process each
- Return all generated URLs clearly labeled at the end
