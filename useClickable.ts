import React, { useState, useEffect, useCallback } from 'react';
import { processChatStream, generateWithTools, generateCode, processAgentStream } from './services/agentService';
import { readPageContent, executeDomModificationCode, saveDomCodeAction } from './services/toolService';
import type { Card, SelectionInfo, GroundingChunk, PredefinedAction, ConversationPart, HighlightRect } from './types';
import { CodeIcon, SparklesIcon } from './components/Icons';

export const useClickable = () => {
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
      setLastSelectionRange(range.cloneRange());
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

  const handleClosePopover = () => {
    setSelection(null);
    clearHighlight();
  };
  
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
      // FIX: Replace JSX with React.createElement in a .ts file as JSX is not supported.
      icon: React.createElement(CodeIcon),
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
  
  const handleDomCodeAction = (action: PredefinedAction) => {
    handleClosePopover();
    if (!action.code) return;
    executeDomModificationCode(action.code, lastSelectionRange ?? undefined);
  };

  const runAgentTurn = useCallback(async (card: Card) => {
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
  }, []);

  const handleAgentAction = (prompt: string, context: string) => {
    handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'agent',
      status: 'loading',
      conversation: [{ type: 'user', text: prompt }],
      // FIX: Replace JSX with React.createElement in a .ts file as JSX is not supported.
      icon: React.createElement(SparklesIcon),
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
      context: '',
      type: 'agent',
      status: 'success',
      conversation: [],
      // FIX: Replace JSX with React.createElement in a .ts file as JSX is not supported.
      icon: React.createElement(SparklesIcon),
    };
    setCards(prev => [newCard, ...prev]);
    setIsSidebarVisible(true);
  };

  const handleFollowUp = useCallback(async (cardId: string, message: string) => {
    let cardToUpdate: Card | undefined;
    
    setCards(prev => prev.map(c => {
        if (c.id === cardId) {
            cardToUpdate = {
                ...c,
                status: 'loading' as const,
                conversation: [...c.conversation, { type: 'user' as const, text: message }]
            };
            return cardToUpdate;
        }
        return c;
    }));
  
    if (cardToUpdate?.type === 'agent') {
      runAgentTurn(cardToUpdate);
      return;
    }

    if (cardToUpdate) {
        try {
            const stream = processChatStream(message, cardToUpdate.context, cardToUpdate.conversation);
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
            setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'success' as const } : c));
        } catch (error) {
            console.error("Follow-up error:", error);
            const errorMessage = error instanceof Error ? `An error occurred: ${error.message}` : "An unknown error occurred.";
            setCards(prev => prev.map(c => {
                if (c.id !== cardId) return c;
                return { ...c, status: 'error' as const, conversation: [...c.conversation, { type: 'error' as const, text: errorMessage }] };
            }));
        }
    }
  }, [runAgentTurn]);

  const handleApproveToolCall = useCallback((cardId: string) => {
    let nextCardForAgent: Card | undefined;

    setCards(prev => {
        const cardIndex = prev.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return prev;
        const card = prev[cardIndex];
        if (!card?.pendingToolCall) return prev;

        const { name, args } = card.pendingToolCall;
        let result = '';

        if (name === 'executeDomModification') {
            result = executeDomModificationCode(args.code, card.selectionRange?.cloneRange());
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
  }, [runAgentTurn]);
  
  const handleDenyToolCall = useCallback((cardId: string) => {
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
  }, [runAgentTurn]);

  const handleDeleteCard = (id: string) => {
    setCards(prevCards => prevCards.filter(card => card.id !== id));
  };
  
  const handleToggleSidebar = () => {
    setIsSidebarVisible(prev => !prev);
  };
  
  return {
    selection,
    cards,
    isSidebarVisible,
    highlightRects,
    handleAction,
    handleAiCodeAction,
    handleCodeAction,
    handleDomCodeAction,
    handleAgentAction,
    handleClosePopover,
    handleDeleteCard,
    handleFollowUp,
    handleToggleSidebar,
    handleApproveToolCall,
    handleDenyToolCall,
    handleNewAgentCard,
  };
};
