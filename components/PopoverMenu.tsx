import React, { useState, useEffect, useRef } from 'react';
import type { PredefinedAction } from '../types';
import { TranslateIcon, SummarizeIcon, SendIcon, PlusIcon, TrashIcon, HashtagIcon, SearchIcon, CodeIcon, SparklesIcon } from './Icons';
import { usePresenter } from '../context/PresenterContext';
import { useClickableStore } from '../stores/clickableStore';

interface PopoverMenuProps {
  // No props needed, will get state from store and actions from presenter
}

const defaultActions: PredefinedAction[] = [
  { id: 'translate-en', type: 'ai', label: 'Translate (EN)', icon: <TranslateIcon className="w-4 h-4" />, prompt: 'Translate the following text to English', isCustom: false },
  { id: 'summarize', type: 'ai', label: 'Summarize', icon: <SummarizeIcon className="w-4 h-4" />, prompt: 'Summarize the following text concisely', isCustom: false },
  {
    id: 'smart-search',
    type: 'ai',
    label: 'Smart Search',
    icon: <SearchIcon className="w-4 h-4" />,
    prompt: 'Using information from Google Search, provide a comprehensive answer for the following query',
    isCustom: false,
    useTools: true,
  },
  { 
    id: 'word-count', 
    type: 'code', 
    label: 'Word Count', 
    icon: <HashtagIcon className="w-4 h-4" />, 
    handler: (text) => `${text.split(/\s+/).filter(Boolean).length} words`,
    isCustom: false 
  },
];

const CUSTOM_ACTIONS_STORAGE_KEY = 'clickable-custom-actions';
const ACTION_METADATA_STORAGE_KEY = 'clickable-action-metadata';

// Helper to get usage metadata
const getActionMetadata = (): Record<string, { lastUsed: number }> => {
    try {
        const stored = localStorage.getItem(ACTION_METADATA_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error("Failed to load action metadata:", e);
        return {};
    }
};

// Helper to sort actions based on metadata
const sortActions = (actions: PredefinedAction[], metadata: Record<string, { lastUsed: number }>): PredefinedAction[] => {
    return [...actions].sort((a, b) => {
        const lastUsedA = metadata[a.id]?.lastUsed ?? 0;
        const lastUsedB = metadata[b.id]?.lastUsed ?? 0;
        return lastUsedB - lastUsedA;
    });
};

export const PopoverMenu: React.FC<PopoverMenuProps> = () => {
  const { clickableManager } = usePresenter();
  const selection = useClickableStore((state) => state.selection);

  const [customPrompt, setCustomPrompt] = useState('');
  const [actions, setActions] = useState<PredefinedAction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionPrompt, setNewActionPrompt] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load custom actions
    let customActions: PredefinedAction[] = [];
    try {
      const storedActionsJSON = localStorage.getItem(CUSTOM_ACTIONS_STORAGE_KEY);
      if (storedActionsJSON) {
        customActions = JSON.parse(storedActionsJSON);
      }
    } catch (e) {
      console.error("Failed to load custom actions:", e);
    }
    
    // Load usage metadata
    const metadata = getActionMetadata();
    
    // Combine, assign default icons to custom actions, sort, and set state
    const allActions = [
      ...defaultActions, 
      ...customActions.map(a => {
        if (a.isCustom && !a.icon) {
          if (a.type === 'dom-code' || a.type === 'code') {
            return { ...a, icon: <CodeIcon className="w-4 h-4"/> };
          }
          return { ...a, icon: <SparklesIcon className="w-4 h-4"/> };
        }
        return a;
      })
    ];
    const sorted = sortActions(allActions, metadata);
    setActions(sorted);
  }, [isAdding]); // Re-run when a new action is added

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        clickableManager.handleClosePopover();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [clickableManager]);

  const handleCustomSubmit = (e: React.FormEvent, context: string) => {
    e.preventDefault();
    const trimmedPrompt = customPrompt.trim();
    if (trimmedPrompt) {
      if (trimmedPrompt.startsWith('/agent ')) {
        const agentPrompt = trimmedPrompt.substring(7); // remove '/agent '
        clickableManager.handleAgentAction(agentPrompt, context);
      } else {
        clickableManager.handleAction(trimmedPrompt, context);
      }
      setCustomPrompt('');
    }
  };

  const handlePredefinedAction = (action: PredefinedAction, context: string) => {
    if (action.type === 'code' && action.handler) {
        const result = action.handler(context);
        clickableManager.handleCodeAction(action.label, context, result, action.icon);
    } else if (action.type === 'dom-code') {
        clickableManager.handleDomCodeAction(action);
    } else if (action.type === 'ai' && action.prompt) {
        const finalPrompt = customPrompt.trim()
          ? `${action.prompt}. Additional instructions: ${customPrompt}`
          : action.prompt;
        clickableManager.handleAction(finalPrompt, context, action.icon, action.useTools);
    } else if (action.prompt) { // Fallback for old custom actions without a type
        const finalPrompt = customPrompt.trim()
            ? `${action.prompt}. Additional instructions: ${customPrompt}`
            : action.prompt;
        clickableManager.handleAction(finalPrompt, context, action.icon, action.useTools);
    }
    
    setCustomPrompt('');

    // Update usage timestamp and re-sort
    const metadata = getActionMetadata();
    metadata[action.id] = { lastUsed: Date.now() };
    localStorage.setItem(ACTION_METADATA_STORAGE_KEY, JSON.stringify(metadata));
    setActions(prevActions => sortActions(prevActions, metadata));
  };

  const handleSaveAction = () => {
    if (!newActionLabel.trim() || !newActionPrompt.trim()) return;
    
    const newAction: PredefinedAction = {
      id: crypto.randomUUID(),
      label: newActionLabel.trim(),
      prompt: newActionPrompt.trim(),
      type: 'ai',
      isCustom: true,
    };
    
    let customActions: PredefinedAction[] = [];
    try {
        const stored = localStorage.getItem(CUSTOM_ACTIONS_STORAGE_KEY);
        if (stored) customActions = JSON.parse(stored);
    } catch(e) { console.error(e); }

    customActions.push(newAction);
    localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(customActions));

    const metadata = getActionMetadata();
    metadata[newAction.id] = { lastUsed: Date.now() };
    localStorage.setItem(ACTION_METADATA_STORAGE_KEY, JSON.stringify(metadata));

    setNewActionLabel('');
    setNewActionPrompt('');
    setIsAdding(false);
  };

  const handleDeleteAction = (idToDelete: string) => {
    const updatedActions = actions.filter(a => a.id !== idToDelete);
    setActions(updatedActions);
    
    const customActions = updatedActions.filter(a => a.isCustom);
    localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(customActions));

    const metadata = getActionMetadata();
    delete metadata[idToDelete];
    localStorage.setItem(ACTION_METADATA_STORAGE_KEY, JSON.stringify(metadata));
  };

  if (!selection) return null;

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${selection.y}px`,
    left: `${selection.x}px`,
    transform: 'translateX(-50%)',
    marginTop: '10px'
  };

  return (
    <div 
        ref={popoverRef} 
        style={popoverStyle} 
        className="z-50 w-96 bg-gray-900/70 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl p-2 flex flex-col gap-2 animate-fade-in-down"
        data-no-select="true"
    >
      <p className="text-xs text-gray-400 italic truncate px-1 pt-1">
        On: "{selection.text}"
      </p>

      {isAdding ? (
        <div className="p-2 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-200">Create New Action</h3>
            <input
                type="text"
                value={newActionLabel}
                onChange={(e) => setNewActionLabel(e.target.value)}
                placeholder="Action Label (e.g. Explain Simply)"
                className="bg-gray-800 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
                value={newActionPrompt}
                onChange={(e) => setNewActionPrompt(e.target.value)}
                placeholder="AI Prompt (e.g. Explain this to a 5 year old)"
                className="bg-gray-800 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
            />
            <div className="flex justify-end gap-2 mt-1">
                <button onClick={() => setIsAdding(false)} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-md transition-colors">Cancel</button>
                <button onClick={handleSaveAction} className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md transition-colors">Save</button>
            </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex gap-2 overflow-x-auto pb-2 -mb-2" style={{scrollbarWidth: 'thin'}}>
              {actions.map(action => (
                <div key={action.id} className="relative group flex-shrink-0">
                  <button 
                    onClick={() => handlePredefinedAction(action, selection.text)} 
                    className="flex items-center justify-center gap-2 text-sm bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white px-3 py-2 rounded-md transition-colors"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                  {action.isCustom && (
                    <button onClick={() => handleDeleteAction(action.id)} className="absolute -top-1 -right-1 bg-red-600/80 hover:bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <TrashIcon className="w-3 h-3 text-white"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setIsAdding(true)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded-full transition-colors">
              <PlusIcon className="w-5 h-5"/>
            </button>
          </div>
          <form onSubmit={(e) => handleCustomSubmit(e, selection.text)} className="flex gap-2 items-center">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask AI, or start with /agent ..."
              className="flex-1 bg-gray-800 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!customPrompt.trim()} title="Send to AI">
                <SendIcon className="w-5 h-5"/>
            </button>
          </form>
        </>
      )}
    </div>
  );
};
