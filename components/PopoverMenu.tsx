import React, { useState, useEffect, useRef } from 'react';
import type { SelectionInfo } from '../types';
import { TranslateIcon, SummarizeIcon, SendIcon } from './Icons';

interface PopoverMenuProps {
  selection: SelectionInfo;
  onAction: (prompt: string, context: string) => void;
  onClose: () => void;
}

const preDefinedActions = [
  { label: 'Translate (EN)', icon: <TranslateIcon className="w-4 h-4" />, prompt: 'Translate the following text to English' },
  { label: 'Summarize', icon: <SummarizeIcon className="w-4 h-4" />, prompt: 'Summarize the following text concisely' },
];

export const PopoverMenu: React.FC<PopoverMenuProps> = ({ selection, onAction, onClose }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Pass context explicitly to prevent potential stale closures
  const handleCustomSubmit = (e: React.FormEvent, context: string) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onAction(customPrompt, context);
      setCustomPrompt('');
    }
  };

  // Pass context explicitly to prevent potential stale closures
  const handlePredefinedAction = (basePrompt: string, context: string) => {
    const finalPrompt = customPrompt.trim()
      ? `${basePrompt}. Additional instructions: ${customPrompt}`
      : basePrompt;

    onAction(finalPrompt, context);
    setCustomPrompt(''); // Clear input after action
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
        className="z-50 w-80 bg-gray-900/70 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl p-2 flex flex-col gap-2 animate-fade-in-down"
    >
      <p className="text-xs text-gray-400 italic truncate px-1 pt-1">
        On: "{selection.text}"
      </p>

      <div className="flex gap-2">
        {preDefinedActions.map(action => (
          <button 
            key={action.label} 
            onClick={() => handlePredefinedAction(action.prompt, selection.text)} 
            className="flex-1 flex items-center justify-center gap-2 text-sm bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white px-3 py-2 rounded-md transition-colors"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
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
    </div>
  );
};
