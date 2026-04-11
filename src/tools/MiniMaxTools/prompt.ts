// Tool names and descriptions for all MiniMax tools.

export const MINIMAX_IMAGE_TOOL_NAME = 'MiniMaxImageGenerate'
export const MINIMAX_IMAGE_DESCRIPTION = `Generate images using MiniMax AI platform.
- Supports text-to-image generation with customizable aspect ratios
- Returns image URLs that can be downloaded or displayed
- Requires MINIMAX_API_KEY environment variable`

export const MINIMAX_VIDEO_TOOL_NAME = 'MiniMaxVideoGenerate'
export const MINIMAX_VIDEO_DESCRIPTION = `Generate videos using MiniMax AI platform.
- Supports text-to-video and image-to-video generation
- Async processing with automatic polling until completion
- Returns download URL for the generated video
- Requires MINIMAX_API_KEY environment variable`

export const MINIMAX_SPEECH_TOOL_NAME = 'MiniMaxSpeechSynthesize'
export const MINIMAX_SPEECH_DESCRIPTION = `Convert text to speech using MiniMax AI platform.
- High-quality text-to-speech with multiple voice options
- Supports speed adjustment (0.5x to 2.0x)
- Returns audio URL (MP3 format)
- Requires MINIMAX_API_KEY environment variable`

export const MINIMAX_MUSIC_TOOL_NAME = 'MiniMaxMusicGenerate'
export const MINIMAX_MUSIC_DESCRIPTION = `Generate music using MiniMax AI platform.
- Text-to-music generation with style, mood, and instrument control
- Optional lyrics for vocal music
- Returns audio URL
- Requires MINIMAX_API_KEY environment variable`

export const MINIMAX_VISION_TOOL_NAME = 'MiniMaxVisionDescribe'
export const MINIMAX_VISION_DESCRIPTION = `Analyze and describe images using MiniMax Vision Language Model.
- Accepts image URL and optional prompt/question
- Returns detailed text description or analysis
- Requires MINIMAX_API_KEY environment variable`

export const MINIMAX_SEARCH_TOOL_NAME = 'MiniMaxWebSearch'
export const MINIMAX_SEARCH_DESCRIPTION = `Search the web using MiniMax AI platform.
- Returns organic search results with title, URL, snippet, and date
- Useful for finding current information
- Requires MINIMAX_API_KEY environment variable`
