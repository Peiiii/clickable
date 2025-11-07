
import React, { useState, useEffect, useCallback } from 'react';
import { PopoverMenu } from './components/PopoverMenu';
import { Sidebar } from './components/Sidebar';
import { processTextWithGeminiStream } from './services/geminiService';
import type { Card, SelectionInfo } from './types';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const App: React.FC = () => {
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
        result: '',
    };

    setCards(prevCards => [newCard, ...prevCards]);
    setIsSidebarVisible(true);
    setSelection(null);

    try {
      const stream = processTextWithGeminiStream(prompt, context);
      for await (const chunk of stream) {
        setCards(prevCards =>
          prevCards.map(card =>
            card.id === newCard.id
              ? { ...card, result: card.result + chunk }
              : card
          )
        );
      }
      // Mark as success when stream is complete
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === newCard.id ? { ...card, status: 'success' } : card
        )
      );
    } catch (error) {
      console.error("Streaming error:", error);
      const errorMessage = error instanceof Error ? `An error occurred with the AI model: ${error.message}` : "An unknown error occurred.";
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === newCard.id
            ? { ...card, status: 'error', result: errorMessage }
            : card
        )
      );
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
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-8 relative">
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
      
      <div className="max-w-4xl mx-auto prose prose-invert prose-lg">
        <h1 className="text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Welcome to Clickable</h1>
        <p className="text-gray-400">
          This is a demonstration of the "Clickable" AI browser extension concept. The core functionality is implemented within this single page.
          To use it, simply <strong className="text-blue-300">select any text on this page</strong>.
          A popover menu will appear, allowing you to perform AI actions on the selected content.
        </p>

        <h2 className="mt-12">The Philosophy of "Clickable"</h2>
        <p>
          The modern web is a rich tapestry of information, but interacting with it can often be cumbersome. Copying text, switching tabs to a translator or a summarizer, and then pasting it back breaks the user's flow. "Clickable" aims to eliminate this friction. By bringing powerful AI tools directly to your selection, we keep you in context, making you more efficient and focused. You don't type, you click.
        </p>
        
        <blockquote className="border-l-4 border-purple-500 pl-4 italic">
            "The future of user interfaces is not about adding more features, but about removing steps. We envision a web where every piece of content is an interactive starting point for discovery and creation."
        </blockquote>

        <h2>Example Use Cases</h2>
        <p>
          Imagine reading a complex scientific paper. You can select a dense paragraph and click "Summarize" to get the key takeaways instantly. Or, if you're browsing a foreign news site, a simple highlight and click on "Translate" gives you the information you need, right where you are. The possibilities are endless with custom actions—check grammar, change tone, explain like I'm five, or even convert to a JSON object.
        </p>
      </div>

      {selection && <PopoverMenu selection={selection} onAction={handleAction} onClose={handleClosePopover} />}
      
      <div data-no-select="true">
        <Sidebar cards={cards} onDeleteCard={handleDeleteCard} isVisible={isSidebarVisible} onToggle={handleToggleSidebar}/>
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
    </div>
  );
};

export default App;
