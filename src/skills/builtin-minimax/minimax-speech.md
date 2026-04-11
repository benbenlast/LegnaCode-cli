---
name: minimax-speech
description: Convert text to speech using MiniMax AI. Use when the user wants to create audio narration, voiceovers, or spoken content.
---

# MiniMax Speech Synthesis Skill

Use the `MiniMaxSpeechSynthesize` tool to convert text to natural speech.

## Usage

When the user asks to create speech, narration, voiceover, or audio from text:

1. Call `MiniMaxSpeechSynthesize` with the text to speak
2. Optionally specify `voice` ID and `speed` (0.5-2.0)
3. Return the audio URL to the user

## Available Voices

- `English_expressive_narrator` (default) — expressive narration
- `English_magnetic_voiced_man` — deep male voice
- Other voices available via MiniMax platform

## Tips

- Keep text segments under 5000 characters for best quality
- Use speed 0.8-0.9 for formal narration, 1.1-1.2 for casual
- For long content, split into paragraphs and synthesize separately
