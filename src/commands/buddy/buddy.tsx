import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getCompanion, roll, companionUserId } from '../../buddy/companion.js'
import { renderSprite } from '../../buddy/sprites.js'
import { RARITY_COLORS, RARITY_STARS, type StoredCompanion } from '../../buddy/types.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'

function CompanionCard({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  const companion = getCompanion()
  if (!companion) {
    onDone('No companion hatched yet. Run /buddy hatch')
    return null
  }
  const color = RARITY_COLORS[companion.rarity]
  const stars = RARITY_STARS[companion.rarity]
  const sprite = renderSprite(companion)
  const muted = getGlobalConfig().companionMuted

  onDone()
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          {sprite.map((line, i) => (
            <Text key={i} color={color}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column">
          <Text bold color={color}>{companion.name}</Text>
          <Text dimColor>{companion.species} · {companion.rarity} {stars}</Text>
          <Text dimColor>{companion.personality}</Text>
          {companion.shiny && <Text color="warning">✨ Shiny!</Text>}
          {muted && <Text dimColor>(muted)</Text>}
        </Box>
      </Box>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode | null> {
  const arg = args?.trim().toLowerCase()

  if (arg === 'hatch') {
    const existing = getCompanion()
    if (existing) {
      onDone(`${existing.name} is already here!`)
      return null
    }
    const userId = companionUserId()
    const { bones, inspirationSeed } = roll(userId)
    const soul: StoredCompanion = {
      name: `Buddy-${inspirationSeed.toString(36).slice(0, 4)}`,
      personality: `A ${bones.rarity} ${bones.species} who loves debugging.`,
      hatchedAt: Date.now(),
    }
    saveGlobalConfig(config => ({ ...config, companion: soul }))
    const companion = getCompanion()!
    const color = RARITY_COLORS[companion.rarity]
    const stars = RARITY_STARS[companion.rarity]
    onDone(`🥚 Hatched ${companion.name}! (${companion.species} · ${companion.rarity} ${stars})`)
    return null
  }

  if (arg === 'pet') {
    const companion = getCompanion()
    if (!companion) {
      onDone('No companion to pet. Run /buddy hatch first.')
      return null
    }
    context.setAppState(prev => ({ ...prev, companionPetAt: Date.now() }))
    onDone(`♥ ${companion.name} purrs happily.`)
    return null
  }

  if (arg === 'mute') {
    saveGlobalConfig(config => ({ ...config, companionMuted: true }))
    onDone('Companion muted.')
    return null
  }

  if (arg === 'unmute') {
    saveGlobalConfig(config => ({ ...config, companionMuted: false }))
    onDone('Companion unmuted.')
    return null
  }

  if (arg === 'stats') {
    const companion = getCompanion()
    if (!companion) {
      onDone('No companion. Run /buddy hatch first.')
      return null
    }
    const lines = Object.entries(companion.stats)
      .map(([k, v]) => `${k}: ${'█'.repeat(Math.floor(v / 10))}${'░'.repeat(10 - Math.floor(v / 10))} ${v}`)
      .join('\n')
    onDone(`${companion.name}'s stats:\n${lines}`)
    return null
  }

  // Default: show companion card
  return <CompanionCard onDone={onDone} />
}
