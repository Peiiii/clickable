import React, { useState, useEffect, useCallback } from 'react';
import { PopoverMenu } from './components/PopoverMenu';
import { Sidebar } from './components/Sidebar';
import { processChatStream } from './services/geminiService';
import type { Card, SelectionInfo, ConversationPart } from './types';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const ClickableCore: React.FC = () => {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);

  const clearHighlight = useCallback(() => {
    setHighlightRects([]);
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    const currentSelection = window.getSelection();
    // Check if the event target is inside an element that should not trigger selection
    const targetElement = event.target as Element;
    if (targetElement.closest('[data-no-select="true"]')) {
      return;
    }

    if (currentSelection && currentSelection.toString().trim().length > 0) {
      const range = currentSelection.getRangeAt(0);
      
      // Clean up previous highlight before creating a new one.
      clearHighlight();

      // Create highlight rects for the new selection. This is robust for multi-line.
      const rects = range.getClientRects();
      const newHighlightRects = Array.from(rects).map(rect => ({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
      }));
      setHighlightRects(newHighlightRects);

      const rect = range.getBoundingClientRect();
      setSelection({
        text: currentSelection.toString(),
        x: rect.left + rect.width / 2,
        y: rect.bottom + window.scrollY,
      });
    }
  }, [clearHighlight]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);
  
  const handleAction = async (prompt: string, context: string) => {
    clearHighlight(); // Remove highlight when an action is taken
    
    const newCard: Card = {
        id: crypto.randomUUID(),
        prompt,
        context,
        status: 'loading',
        conversation: [],
    };

    setCards(prevCards => [newCard, ...prevCards]);
    setIsSidebarVisible(true);
    setSelection(null);

    try {
      const stream = processChatStream(prompt, context, []);
      let firstChunk = true;
      for await (const chunk of stream) {
        if (firstChunk) {
            // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
            setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, conversation: [{ type: 'ai' as const, text: chunk }] } : c));
            firstChunk = false;
        } else {
            setCards(prev => prev.map(c => {
                if (c.id !== newCard.id) return c;
                const newConversation = [...c.conversation];
                newConversation[newConversation.length - 1].text += chunk;
                return { ...c, conversation: newConversation };
            }));
        }
      }
      // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
      setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'success' as const } : c));
    } catch (error) {
      console.error("Streaming error:", error);
      const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
      // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
      setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'error' as const, conversation: [{ type: 'error' as const, text: errorMessage }] } : c));
    }
  };

  const handleFollowUp = async (cardId: string, message: string) => {
    let cardBeforeFollowUp: Card | undefined;
    setCards(prev => {
        const newCards = prev.map(c => {
            if (c.id === cardId) {
                cardBeforeFollowUp = c; // Capture state before adding user message
                // FIX: Use 'as const' to prevent TypeScript from widening types to 'string'.
                return { 
                    ...c, 
                    status: 'loading' as const, 
                    conversation: [...c.conversation, { type: 'user' as const, text: message }]
                };
            }
            return c;
        });
        return newCards;
    });

    if (!cardBeforeFollowUp) {
        console.error("Could not find card for follow-up.");
        return;
    }
    
    try {
        const stream = processChatStream(message, cardBeforeFollowUp.context, cardBeforeFollowUp.conversation);
        let firstChunk = true;
        for await (const chunk of stream) {
            if (firstChunk) {
                // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
                setCards(prev => prev.map(c => c.id === cardId ? { ...c, conversation: [...c.conversation, { type: 'ai' as const, text: chunk }] } : c));
                firstChunk = false;
            } else {
                setCards(prev => prev.map(c => {
                    if (c.id !== cardId) return c;
                    const newConversation = [...c.conversation];
                    newConversation[newConversation.length - 1].text += chunk;
                    return { ...c, conversation: newConversation };
                }));
            }
        }
        // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'success' as const } : c));
    } catch (error) {
        console.error("Follow-up error:", error);
        const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
        // FIX: Use 'as const' to prevent TypeScript from widening the type to 'string'.
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'error' as const, conversation: [...c.conversation, { type: 'error' as const, text: errorMessage }] } : c));
    }
  };

  const handleDeleteCard = (id: string) => {
    setCards(prevCards => prevCards.filter(card => card.id !== id));
  };
  
  const handleToggleSidebar = () => {
    setIsSidebarVisible(prev => !prev);
  };

  const handleClosePopover = () => {
    setSelection(null);
    clearHighlight();
  };

  return (
    <>
      {highlightRects.map((rect, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(96, 165, 250, 0.4)', // Tailwind's blue-400 with 40% opacity
            borderRadius: '3px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      ))}
      
      {selection && <PopoverMenu selection={selection} onAction={handleAction} onClose={handleClosePopover} />}
      
      <div data-no-select="true">
        <Sidebar cards={cards} onDeleteCard={handleDeleteCard} onFollowUp={handleFollowUp} isVisible={isSidebarVisible} onToggle={handleToggleSidebar}/>
      </div>

       <style>{`
          @keyframes fade-in-down {
            from { opacity: 0; transform: translate(-50%, -10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }

          @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
       `}</style>
    </>
  );
};
