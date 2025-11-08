import React from 'react';
import { ActionCard } from './ActionCard';
import { SidebarIcon, CloseIcon, PlusIcon } from './Icons';
import { useClickableStore } from '../stores/clickableStore';
import { usePresenter } from '../context/PresenterContext';

export const Sidebar: React.FC = () => {
  const { clickableManager } = usePresenter();
  const cards = useClickableStore((state) => state.cards);
  const isVisible = useClickableStore((state) => state.isSidebarVisible);

  return (
    <>
      <button 
        onClick={clickableManager.handleToggleSidebar} 
        className={`fixed top-4 z-50 p-2 rounded-full bg-gray-800/80 backdrop-blur-sm border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all duration-300 ${isVisible ? 'right-[380px]' : 'right-4'}`}
        aria-label={isVisible ? 'Close Sidebar' : 'Open Sidebar'}
      >
        {isVisible ? <CloseIcon className="w-6 h-6" /> : <SidebarIcon className="w-6 h-6" />}
      </button>

      <div className={`fixed top-0 right-0 h-full w-[360px] bg-black/30 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <header className="p-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Clickable AI</h2>
              <p className="text-sm text-gray-400">Your AI-powered actions</p>
            </div>
            <button
              onClick={clickableManager.handleNewAgentCard}
              className="p-2 rounded-full bg-blue-600/50 hover:bg-blue-500 text-white transition-colors"
              title="New Agent Chat"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </header>
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {cards.length > 0 ? (
              cards.map(card => (
                <ActionCard 
                  key={card.id} 
                  card={card}
                />
              ))
            ) : (
              <div className="text-center text-gray-500 pt-10">
                <p>No actions yet.</p>
                <p className="text-sm mt-1">Select text on the page or start a new chat.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
