
import React from 'react';
import type { Card } from '../types';
import { CloseIcon, SparklesIcon } from './Icons';

interface ActionCardProps {
  card: Card;
  onDelete: (id: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400"></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

export const ActionCard: React.FC<ActionCardProps> = ({ card, onDelete }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg overflow-hidden animate-fade-in-up">
      <div className="p-3 border-b border-gray-700 flex justify-between items-start">
        <div>
            <p className="text-sm font-medium text-blue-300 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                <span>{card.prompt}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1 italic truncate max-w-xs">"{card.context}"</p>
        </div>
        <button onClick={() => onDelete(card.id)} className="text-gray-500 hover:text-white transition-colors p-1 -mt-1 -mr-1">
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 text-sm text-gray-200 min-h-[60px]">
        {card.status === 'loading' && !card.result ? (
            <LoadingSpinner />
        ) : card.status === 'error' ? (
            <p className="text-red-400 whitespace-pre-wrap">{card.result}</p>
        ) : (
            <p className="whitespace-pre-wrap">
                {card.result}
                {card.status === 'loading' && <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-bottom" />}
            </p>
        )}
      </div>
    </div>
  );
};
