// FIX: Import React to provide types like React.ReactNode
import React from 'react';

export type CardStatus = 'loading' | 'success' | 'error';
export type CardType = 'ai' | 'code' | 'ai-code' | 'agent';
export type ActionType = 'ai' | 'code' | 'dom-code';

// New types for Grounding
export interface WebGrounding {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: WebGrounding;
}

export interface ConversationPart {
  type: 'ai' | 'user' | 'error' | 'system' | 'tool_code' | 'tool_response';
  text: string;
  toolCall?: PendingToolCall; // For displaying tool code
}

export interface PendingToolCall {
  id: string;
  name: string;
  args: any;
}

export interface Card {
  id: string;
  prompt: string;
  type: CardType;
  status: CardStatus;
  conversation: ConversationPart[];
  context: string;
  icon?: React.ReactNode;
  grounding?: GroundingChunk[];
  executionResult?: string;
  selectionRange?: Range;
  pendingToolCall?: PendingToolCall | null;
  // FIX: Add generatedCode property to the Card type
  generatedCode?: string;
}

export interface SelectionInfo {
  text: string;
  x: number;
  y: number;
}

export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PredefinedAction {
  id: string;
  label: string;
  type: ActionType;
  prompt?: string;
  code?: string; // For DOM manipulation scripts
  handler?: (context: string) => string | number; // For simple, non-DOM code
  icon?: React.ReactNode;
  isCustom?: boolean;
  useTools?: boolean;
}
