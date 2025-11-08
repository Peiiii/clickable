import React, { useState, useEffect, useRef } from 'react';
import type { SelectionInfo, PredefinedAction } from '../types';
import { TranslateIcon, SummarizeIcon, SendIcon, PlusIcon, TrashIcon, HashtagIcon } from './Icons';

interface PopoverMenuProps {
  selection: SelectionInfo;
  onAction: (prompt: string, context: string, icon?: React.ReactNode) => void;
  onCodeAction: (label: string, context: string, result: string | number, icon?: React.ReactNode) => void;
  onClose: () => void;
}

const defaultActions: PredefinedAction[] = [
  { id: 'translate-en', type: 'ai', label: 'Translate (EN)', icon: <TranslateIcon className="w-4 h-4" />, prompt: 'Translate the following text to English', isCustom: false },
  { id: 'summarize', type: 'ai', label: 'Summarize', icon: <SummarizeIcon className="w-4 h-4" />, prompt: 'Summarize the following text concisely', isCustom: false },
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

export const PopoverMenu: React.FC<PopoverMenuProps> = ({ selection, onAction, onCodeAction, onClose }) => {
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
    
    // Combine, sort, and set initial state
    const allActions = [...defaultActions, ...customActions];
    const sorted = sortActions(allActions, metadata);
    setActions(sorted);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleCustomSubmit = (e: React.FormEvent, context: string) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onAction(customPrompt, context);
      setCustomPrompt('');
    }
  };

  const handlePredefinedAction = (action: PredefinedAction, context: string) => {
    if (action.type === 'code' && action.handler) {
        const result = action.handler(context);
        onCodeAction(action.label, context, result, action.icon);
    } else if (action.type === 'ai' && action.prompt) {
        const finalPrompt = customPrompt.trim()
          ? `${action.prompt}. Additional instructions: ${customPrompt}`
          : action.prompt;
        onAction(finalPrompt, context, action.icon);
    } else if (action.prompt) { // Fallback for old custom actions without a type
        const finalPrompt = customPrompt.trim()
            ? `${action.prompt}. Additional instructions: ${customPrompt}`
            : action.prompt;
        onAction(finalPrompt, context, action.icon);
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
    
    // Update custom actions in storage
    const updatedCustomActions = [...actions.filter(a => a.isCustom), newAction];
    localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(updatedCustomActions));

    // Update metadata to put new action first
    const metadata = getActionMetadata();
    metadata[newAction.id] = { lastUsed: Date.now() };
    localStorage.setItem(ACTION_METADATA_STORAGE_KEY, JSON.stringify(metadata));

    // Update state with new action and re-sort
    setActions(prevActions => sortActions([...prevActions, newAction], metadata));

    setNewActionLabel('');
    setNewActionPrompt('');
    setIsAdding(false);
  };

  const handleDeleteAction = (idToDelete: string) => {
    const updatedActions = actions.filter(a => a.id !== idToDelete);
    setActions(updatedActions);
    
    // Update custom actions in storage
    const customActions = updatedActions.filter(a => a.isCustom);
    localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(customActions));

    // Update metadata in storage
    const metadata = getActionMetadata();
    delete metadata[idToDelete];
    localStorage.setItem(ACTION_METADATA_STORAGE_KEY, JSON.stringify(metadata));
  };

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
              placeholder="Add details or a custom action..."
              className="flex-1 bg-gray-800 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!customPrompt.trim()}>
                <SendIcon className="w-5 h-5"/>
            </button>
          </form>
        </>
      )}
    </div>
  );
};