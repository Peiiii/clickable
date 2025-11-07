export type CardStatus = 'loading' | 'success' | 'error';

export interface ConversationPart {
  type: 'ai' | 'user' | 'error';
  text: string;
}

export interface Card {
  id: string;
  prompt: string;
  status: CardStatus;
  conversation: ConversationPart[];
  context: string;
}

export interface SelectionInfo {
  text: string;
  x: number;
  y: number;
}

export interface PredefinedAction {
  id: string;
  label: string;
  prompt: string;
  icon?: React.ReactNode;
  isCustom?: boolean;
}