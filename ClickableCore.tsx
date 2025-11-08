import React, { useState, useEffect, useCallback } from 'react';
import { PopoverMenu } from './components/PopoverMenu';
import { Sidebar } from './components/Sidebar';
import { processChatStream, generateWithTools, generateCode, processAgentStream } from './services/agentService';
import type { Card, SelectionInfo, GroundingChunk, PredefinedAction, ConversationPart } from './types';
import { CodeIcon, SparklesIcon } from './components/Icons';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CUSTOM_ACTIONS_STORAGE_KEY = 'clickable-custom-actions';

export const ClickableCore: React.FC = () => {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [lastSelectionRange, setLastSelectionRange] = useState<Range | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);

  const clearHighlight = useCallback(() => {
    setHighlightRects([]);
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    const currentSelection = window.getSelection();
    const targetElement = event.target as Element;
    if (targetElement.closest('[data-no-select="true"]')) {
      return;
    }

    if (currentSelection && currentSelection.toString().trim().length > 0) {
      const range = currentSelection.getRangeAt(0);
      setLastSelectionRange(range.cloneRange()); // Store the range
      clearHighlight();
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

  const handleAction = async (prompt: string, context: string, icon?: React.ReactNode, useTools?: boolean) => {
    handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'ai',
      status: 'loading',
      conversation: [],
      icon,
    };
    setCards(prevCards => [newCard, ...prevCards]);
    setIsSidebarVisible(true);
    
    if (useTools) {
      try {
        const response = await generateWithTools(prompt, context);
        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        
        setCards(prev => prev.map(c => c.id === newCard.id ? { 
            ...c, 
            status: 'success' as const, 
            conversation: [{ type: 'ai' as const, text }],
            grounding: groundingChunks,
        } : c));

      } catch (error) {
        console.error("Tool-based generation error:", error);
        const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
        setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'error' as const, conversation: [{ type: 'error' as const, text: errorMessage }] } : c));
      }
    } else {
      try {
        const stream = processChatStream(prompt, context, []);
        let firstChunk = true;
        for await (const chunk of stream) {
          if (firstChunk) {
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
        setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'success' as const } : c));
      } catch (error) {
        console.error("Streaming error:", error);
        const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
        setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'error' as const, conversation: [{ type: 'error' as const, text: errorMessage }] } : c));
      }
    }
  };
  
  const handleAiCodeAction = async (prompt: string, context: string) => {
    handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'ai-code',
      status: 'loading',
      conversation: [],
      icon: <CodeIcon />,
    };
    setCards(prev => [newCard, ...prev]);
    setIsSidebarVisible(true);

    try {
      const generatedCode = await generateCode(prompt, context);
      try {
        const func = new Function('context', generatedCode);
        const result = func(context);
        const resultString = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'success', generatedCode, executionResult: resultString } : c));
      } catch (executionError) {
        const errorMessage = executionError instanceof Error ? executionError.message : "An unknown execution error occurred.";
        setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'error', generatedCode, executionResult: errorMessage } : c));
      }
    } catch (generationError) {
      const errorMessage = generationError instanceof Error ? `Failed to generate code: ${generationError.message}` : "An unknown generation error occurred.";
      setCards(prev => prev.map(c => c.id === newCard.id ? { ...c, status: 'error', generatedCode: "// Code generation failed", executionResult: errorMessage } : c));
    }
  };

  const handleCodeAction = (label: string, context: string, result: string | number, icon?: React.ReactNode) => {
    handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt: label,
      context,
      type: 'code',
      status: 'success',
      conversation: [{ type: 'system', text: String(result) }],
      icon: icon,
    };
    setCards(prevCards => [newCard, ...prevCards]);
    setIsSidebarVisible(true);
  };

  // Agent Tool Implementations
  const readPageContent = (selector: string): string => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        return `Error: No elements found for selector "${selector}".`;
      }
      let content = '';
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          content += el.innerText + '\n';
        }
      });
      const maxLength = 15000;
      if (content.length > maxLength) {
        return content.substring(0, maxLength) + '... [Content Truncated]';
      }
      return content.trim() || `Selector "${selector}" found elements, but they contained no visible text.`;
    } catch (e) {
      return `Error executing querySelector with "${selector}": ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  
  const executeCode = (code: string, range?: Range): string => {
    try {
      // Only manipulate the browser's selection if a range object is actually provided.
      // This allows scripts to run on the whole page without needing a selection.
      if (range) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // We wrap the user's code in a try-catch to report errors back.
      // The code can optionally use the 'range' variable if it's available.
      const func = new Function('range', `try { ${code} } catch (e) { console.error('Executed script failed:', e); throw e; }`);
      func(range);
      return "Successfully executed.";
    } catch (e) {
      return `Execution Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  
  const handleDomCodeAction = (action: PredefinedAction) => {
    handleClosePopover();
    if (!action.code) return;
    executeCode(action.code, lastSelectionRange ?? undefined);
  };

  const saveDomCodeAction = (label: string, code: string): string => {
    const newAction: PredefinedAction = {
      id: crypto.randomUUID(),
      label,
      code,
      type: 'dom-code',
      isCustom: true,
    };

    try {
      const stored = localStorage.getItem(CUSTOM_ACTIONS_STORAGE_KEY);
      const customActions: PredefinedAction[] = stored ? JSON.parse(stored) : [];
      customActions.push(newAction);
      localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(customActions));
      return `Action "${label}" saved successfully.`;
    } catch (e) {
      console.error("Failed to save custom action:", e);
      return `Failed to save action: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const runAgentTurn = async (card: Card) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 'loading' } : c));
    
    const history = [{ type: 'system' as const, text: card.context }, ...card.conversation];
    const stream = processAgentStream(history);

    let finalAiText = '';
    
    for await (const result of stream) {
        if (result.type === 'text') {
            finalAiText += result.payload;
            setCards(prev => prev.map(c => {
                if (c.id !== card.id) return c;
                const newConversation = [...c.conversation];
                const lastPart = newConversation[newConversation.length - 1];
                if (lastPart?.type === 'ai') {
                    lastPart.text = finalAiText;
                } else {
                    newConversation.push({ type: 'ai', text: finalAiText });
                }
                return { ...c, conversation: newConversation };
            }));
        } else if (result.type === 'tool_call') {
            const toolCall = result.payload;

            if (toolCall.name === 'executeDomModification' || toolCall.name === 'createOrUpdateAction') {
                setCards(prev => prev.map(c => c.id === card.id ? { ...c, pendingToolCall: toolCall, status: 'success' } : c));
                return; 
            }

            if (toolCall.name === 'readPageContent') {
                const resultText = readPageContent(toolCall.args.selector);
                const toolResponsePart: ConversationPart = { type: 'tool_response', text: resultText, toolCall };
                
                const nextCardState: Card = {
                    ...card,
                    conversation: [...card.conversation, toolResponsePart]
                };

                setCards(prev => prev.map(c => c.id === card.id ? nextCardState : c));
                
                runAgentTurn(nextCardState);
                return;
            }
        }
    }
    
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 'success' } : c));
  };


  const handleAgentAction = (prompt: string, context: string) => {
    handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'agent',
      status: 'loading',
      conversation: [{ type: 'user', text: prompt }],
      icon: <SparklesIcon />,
      selectionRange: lastSelectionRange?.cloneRange(),
    };
    setCards(prev => [newCard, ...prev]);
    setIsSidebarVisible(true);
    runAgentTurn(newCard);
  };
  
  const handleNewAgentCard = () => {
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt: 'New Agent Chat',
      context: '', // No context
      type: 'agent',
      status: 'success', // It's ready for input
      conversation: [],
      icon: <SparklesIcon />,
    };
    setCards(prev => [newCard, ...prev]);
    setIsSidebarVisible(true);
  };

  const handleFollowUp = async (cardId: string, message: string) => {
    let updatedCardForAgent: Card | undefined;
  
    setCards(prev => {
      const updatedCards = prev.map(c => {
        if (c.id === cardId) {
          const updatedCard = {
            ...c,
            status: 'loading' as const,
            conversation: [...c.conversation, { type: 'user' as const, text: message }]
          };
          if (updatedCard.type === 'agent') {
            updatedCardForAgent = updatedCard;
          }
          return updatedCard;
        }
        return c;
      });
      return updatedCards;
    });
  
    if (updatedCardForAgent) {
      runAgentTurn(updatedCardForAgent);
      return;
    }

    // Handle standard AI follow-up for non-agent cards
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    try {
        const stream = processChatStream(message, card.context, card.conversation);
        let firstChunk = true;
        for await (const chunk of stream) {
            if (firstChunk) {
                setCards(prev => prev.map(c => {
                    if (c.id !== cardId) return c;
                    return { ...c, conversation: [...c.conversation, { type: 'ai' as const, text: chunk }] };
                }));
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
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'success' } : c));
    } catch (error) {
        console.error("Follow-up error:", error);
        const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
        setCards(prev => prev.map(c => {
            if (c.id !== cardId) return c;
            return { ...c, status: 'error' as const, conversation: [...c.conversation, { type: 'error' as const, text: errorMessage }] };
        }));
    }
  };

  const handleApproveToolCall = async (cardId: string) => {
    let nextCardForAgent: Card | undefined;

    setCards(prev => {
        const cardIndex = prev.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return prev;
        const card = prev[cardIndex];
        if (!card?.pendingToolCall) return prev;

        const { name, args } = card.pendingToolCall;
        let result = '';

        if (name === 'executeDomModification') {
            result = executeCode(args.code, card.selectionRange?.cloneRange());
        } else if (name === 'createOrUpdateAction') {
            result = saveDomCodeAction(args.name, args.code);
        }

        const toolResponsePart: ConversationPart = { type: 'tool_response', text: result, toolCall: card.pendingToolCall };
        
        nextCardForAgent = { ...card, pendingToolCall: null, conversation: [...card.conversation, toolResponsePart] };
        
        const newCards = [...prev];
        newCards[cardIndex] = nextCardForAgent;
        return newCards;
    });
    
    if (nextCardForAgent) {
        runAgentTurn(nextCardForAgent);
    }
  };
  
  const handleDenyToolCall = async (cardId: string) => {
    let nextCardForAgent: Card | undefined;

    setCards(prev => {
        const cardIndex = prev.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return prev;
        const card = prev[cardIndex];
        if (!card?.pendingToolCall) return prev;
        
        const result = 'User denied the action.';
        const toolResponsePart: ConversationPart = { type: 'tool_response', text: result, toolCall: card.pendingToolCall };

        nextCardForAgent = { ...card, pendingToolCall: null, conversation: [...card.conversation, toolResponsePart] };

        const newCards = [...prev];
        newCards[cardIndex] = nextCardForAgent;
        return newCards;
    });
    
    if (nextCardForAgent) {
        runAgentTurn(nextCardForAgent);
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
            backgroundColor: 'rgba(96, 165, 250, 0.4)',
            borderRadius: '3px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      ))}
      
      {selection && <PopoverMenu 
          selection={selection} 
          onAction={handleAction} 
          onCodeAction={handleCodeAction}
          onDomCodeAction={handleDomCodeAction}
          onAiCodeAction={handleAiCodeAction}
          onAgentAction={handleAgentAction}
          onClose={handleClosePopover} 
      />}
      
      <div data-no-select="true">
        <Sidebar 
          cards={cards} 
          onDeleteCard={handleDeleteCard} 
          onFollowUp={handleFollowUp} 
          isVisible={isSidebarVisible} 
          onToggle={handleToggleSidebar}
          onApproveToolCall={handleApproveToolCall}
          onDenyToolCall={handleDenyToolCall}
          onNewAgentCard={handleNewAgentCard}
        />
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
          
          @keyframes fade-in-down-fast {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-down-fast { animation: fade-in-down-fast 0.2s ease-out forwards; }
       `}</style>
    </>
  );
};