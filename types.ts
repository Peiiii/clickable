export type CardStatus = 'loading' | 'success' | 'error';

export interface Card {
  id: string;
  prompt: string;
  status: CardStatus;
  result: string;
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
