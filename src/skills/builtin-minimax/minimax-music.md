---
name: minimax-music
description: Generate music using MiniMax AI. Use when the user wants to create music, songs, melodies, or audio compositions.
---

# MiniMax Music Generation Skill

Use the `MiniMaxMusicGenerate` tool to create music from text descriptions.

## Usage

When the user asks to generate, create, or compose music/songs/melodies:

1. Call `MiniMaxMusicGenerate` with a prompt describing style, mood, instruments
2. Optionally provide `lyrics` for vocal music
3. Optionally specify `duration` in seconds (default 30)
4. Return the audio URL to the user

## Tips

- Be specific about genre, tempo, mood, and instruments
- For vocal music, provide lyrics in the `lyrics` parameter
- Default duration is 30 seconds — specify longer for full tracks
- Combine with MiniMaxSpeechSynthesize for narration + background music
