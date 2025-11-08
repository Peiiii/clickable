
import React, { useState } from 'react';
import type { Card } from '../types';
import { CloseIcon, SparklesIcon, SendIcon } from './Icons';

interface ActionCardProps {
  card: Card;
  onDelete: (id: string) => void;
  onFollowUp: (id: string, message: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400"></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

const BlinkingCursor: React.FC = () => (
    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-bottom" />
);

export const ActionCard: React.FC<ActionCardProps> = ({ card, onDelete, onFollowUp }) => {
    const [followUpMessage, setFollowUpMessage] = useState('');

    const handleFollowUpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (followUpMessage.trim() && card.status !== 'loading') {
            onFollowUp(card.id, followUpMessage.trim());
            setFollowUpMessage('');
        }
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg flex flex-col animate-fade-in-up">
            {/* Header */}
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

            {/* Conversation Area */}
            <div className="p-3 text-sm text-gray-200 space-y-3">
                {card.conversation.length === 0 && card.status === 'loading' && <LoadingSpinner />}
                {card.conversation.map((part, index) => (
                    <div key={index}>
                        {part.type === 'user' && (
                            <div className="text-right">
                                <div className="inline-block p-2 rounded-lg bg-gray-700/50 text-left">
                                    <p className="whitespace-pre-wrap">{part.text}</p>
                                </div>
                            </div>
                        )}
                        {part.type === 'ai' && (
                            <div>
                                 <div className="inline-block p-2 rounded-lg bg-blue-900/30">
                                    <p className="whitespace-pre-wrap">
                                        {part.text}
                                        {card.status === 'loading' && index === card.conversation.length - 1 && <BlinkingCursor />}
                                    </p>
                                </div>
                            </div>
                        )}
                        {part.type === 'error' && (
                             <div className="inline-block p-2 rounded-lg bg-red-900/30">
                                <p className="whitespace-pre-wrap">{part.text}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Follow-up Form */}
            <div className="px-3 pt-3 pb-1 border-t border-gray-700 bg-gray-900/20">
                <form onSubmit={handleFollowUpSubmit} className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={followUpMessage}
                        onChange={(e) => setFollowUpMessage(e.target.value)}
                        placeholder="Ask a follow-up..."
                        className="flex-1 bg-gray-800/70 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={card.status === 'loading'}
                    />
                    <button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                        disabled={!followUpMessage.trim() || card.status === 'loading'}
                    >
                        <SendIcon className="w-5 h-5"/>
                    </button>
                </form>
            </div>
        </div>
    );
};
