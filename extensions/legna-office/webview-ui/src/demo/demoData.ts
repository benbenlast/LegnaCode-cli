/**
 * LegnaCode Office — Standalone Demo Data
 *
 * When no CLI is connected, provides mock agent activity and conversation
 * messages for demonstration and testing purposes.
 */

import type { ConversationMessage } from '../hooks/useConversation.js';

interface DemoAgent {
  id: string;
  name: string;
  state: string;
  detail: string;
}

const DEMO_AGENTS: DemoAgent[] = [
  { id: 'demo-1', name: 'Legna', state: 'writing', detail: 'src/utils/hooks.ts' },
  { id: 'demo-2', name: 'Researcher', state: 'researching', detail: 'Searching codebase...' },
];

const DEMO_MESSAGES: ConversationMessage[] = [
  { id: 'demo-m1', role: 'user', content: '帮我重构 hooks.ts 中的事件系统', timestamp: Date.now() - 60000 },
  { id: 'demo-m2', role: 'assistant', content: '好的，我来分析当前的 hook 架构，找出可以简化的部分。', timestamp: Date.now() - 55000 },
  { id: 'demo-m3', role: 'tool', content: 'Read src/utils/hooks.ts (4937 lines)', timestamp: Date.now() - 50000, toolName: 'Read' },
  { id: 'demo-m4', role: 'assistant', content: '文件很大，核心是 executeHooks 函数。我建议将事件分发逻辑抽取为独立模块。', timestamp: Date.now() - 40000 },
  { id: 'demo-m5', role: 'tool', content: 'Created src/utils/hooks/eventDispatcher.ts', timestamp: Date.now() - 30000, toolName: 'Write' },
];

const STATE_CYCLE: string[] = ['idle', 'writing', 'researching', 'executing', 'syncing', 'idle'];

export interface DemoController {
  agents: DemoAgent[];
  messages: ConversationMessage[];
  stop: () => void;
}

/**
 * Start a demo simulation that cycles agent states and appends messages.
 * Returns a controller to access current state and stop the simulation.
 */
export function startDemo(
  onAgentUpdate: (agent: DemoAgent) => void,
  onMessage: (msg: ConversationMessage) => void,
): DemoController {
  const agents = [...DEMO_AGENTS];
  const messages = [...DEMO_MESSAGES];
  let msgCounter = messages.length;
  let tick = 0;

  // Emit initial state
  for (const a of agents) onAgentUpdate(a);
  for (const m of messages) onMessage(m);

  const interval = setInterval(() => {
    tick++;
    // Cycle agent states every 3 ticks
    if (tick % 3 === 0) {
      const agent = agents[tick % agents.length];
      const stateIdx = Math.floor(tick / 3) % STATE_CYCLE.length;
      agent.state = STATE_CYCLE[stateIdx];
      agent.detail = agent.state === 'idle' ? '—' : `Working on task ${tick}...`;
      onAgentUpdate({ ...agent });
    }
    // Add a conversation message every 5 ticks
    if (tick % 5 === 0) {
      const roles: Array<'user' | 'assistant' | 'tool'> = ['user', 'assistant', 'tool'];
      const role = roles[tick % 3];
      const msg: ConversationMessage = {
        id: `demo-m${++msgCounter}`,
        role,
        content: role === 'user' ? `Demo user message #${msgCounter}`
          : role === 'assistant' ? `Demo assistant response #${msgCounter}`
          : `Tool output #${msgCounter}`,
        timestamp: Date.now(),
        toolName: role === 'tool' ? 'DemoTool' : undefined,
      };
      messages.push(msg);
      onMessage(msg);
    }
  }, 2000);

  return {
    agents,
    messages,
    stop: () => clearInterval(interval),
  };
}
