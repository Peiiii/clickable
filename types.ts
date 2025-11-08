
// FIX: Import React to provide types like React.ReactNode
import React from 'react';

export type CardStatus = 'loading' | 'success' | 'error';
export type CardType = 'ai' | 'code';
export type ActionType = 'ai' | 'code';


export interface ConversationPart {
  type: 'ai' | 'user' | 'error' | 'system';
  text: string;
}

export interface Card {
  id: string;
  prompt: string;
  type: CardType;
  status: CardStatus;
  conversation: ConversationPart[];
  context: string;
  icon?: React.ReactNode;
}

export interface SelectionInfo {
  text: string;
  x: number;
  y: number;
}

export interface PredefinedAction {
  id: string;
  label: string;
  type: ActionType;
  prompt?: string;
  handler?: (context: string) => string | number;
  icon?: React.ReactNode;
  isCustom?: boolean;
}