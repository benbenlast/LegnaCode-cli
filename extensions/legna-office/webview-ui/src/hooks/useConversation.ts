/**
 * LegnaCode Office — Conversation Hook
 *
 * Manages conversation message state from WebSocket or postMessage sources.
 * Provides a unified interface for ConversationSidebar.
 */

import { useCallback, useState } from 'react';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolName?: string;
  agentId?: number;
}

const MAX_MESSAGES = 200;

export function useConversation() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  const loadSnapshot = useCallback((msgs: ConversationMessage[]) => {
    setMessages(msgs.slice(-MAX_MESSAGES));
  }, []);

  return { messages, addMessage, clear, loadSnapshot };
}
