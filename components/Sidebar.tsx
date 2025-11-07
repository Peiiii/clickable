
import React from 'react';
import type { Card } from '../types';
import { ActionCard } from './ActionCard';
import { SidebarIcon, CloseIcon } from './Icons';

interface SidebarProps {
  cards: Card[];
  onDeleteCard: (id: string) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ cards, onDeleteCard, isVisible, onToggle }) => {
  return (
    <>
      <button 
        onClick={onToggle} 
        className={`fixed top-4 z-50 p-2 rounded-full bg-gray-800/80 backdrop-blur-sm border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all duration-300 ${isVisible ? 'right-[380px]' : 'right-4'}`}
        aria-label={isVisible ? 'Close Sidebar' : 'Open Sidebar'}
      >
        {isVisible ? <CloseIcon className="w-6 h-6" /> : <SidebarIcon className="w-6 h-6" />}
      </button>

      <div className={`fixed top-0 right-0 h-full w-[360px] bg-black/30 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <header className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-gray-100">Clickable AI</h2>
            <p className="text-sm text-gray-400">Your AI-powered actions</p>
          </header>
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {cards.length > 0 ? (
              cards.map(card => (
                <ActionCard key={card.id} card={card} onDelete={onDeleteCard} />
              ))
            ) : (
              <div className="text-center text-gray-500 pt-10">
                <p>No actions yet.</p>
                <p className="text-sm mt-1">Select text on the page to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
