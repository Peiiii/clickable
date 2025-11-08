import React from 'react';
import { useClickableStore } from '../stores/clickableStore';
import { agentTools } from '../services/agentConfig';
import { readPageContent, executeDomModificationCode, saveDomCodeAction } from '../services/toolService';
import type { Card, PredefinedAction, ConversationPart } from '../types';
import { CodeIcon, SparklesIcon } from '../components/Icons';
import { providers } from '../services/ai/providers';

export class ClickableManager {

  init = () => {
    document.addEventListener('mouseup', this.handleMouseUp);
  };

  destroy = () => {
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  clearHighlight = () => {
    useClickableStore.getState().setHighlightRects([]);
  };

  handleMouseUp = (event: MouseEvent) => {
    const currentSelection = window.getSelection();
    const targetElement = event.target as Element;
    if (targetElement.closest('[data-no-select="true"]')) {
      return;
    }

    if (currentSelection && currentSelection.toString().trim().length > 0) {
      const range = currentSelection.getRangeAt(0);
      useClickableStore.getState().setLastSelectionRange(range.cloneRange());
      this.clearHighlight();
      const rects = range.getClientRects();
      const newHighlightRects = Array.from(rects).map(rect => ({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
      }));
      useClickableStore.getState().setHighlightRects(newHighlightRects);

      const rect = range.getBoundingClientRect();
      useClickableStore.getState().setSelection({
        text: currentSelection.toString(),
        x: rect.left + rect.width / 2,
        y: rect.bottom + window.scrollY,
      });
    }
  };

  handleClosePopover = () => {
    useClickableStore.getState().setSelection(null);
    this.clearHighlight();
  };
  
  handleAiCodeAction = async (prompt: string, context: string) => {
    this.handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'ai-code',
      status: 'loading',
      conversation: [],
      icon: React.createElement(CodeIcon),
    };
    useClickableStore.getState().addCard(newCard);
    useClickableStore.getState().setSidebarVisible(true);

    try {
      const provider = providers['gemini'].instance;
      const generatedCode = await provider.generateCode(prompt, context);
      
      try {
        const func = new Function('context', generatedCode);
        const result = func(context);
        const resultString = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        useClickableStore.getState().updateCard(newCard.id, { status: 'success', generatedCode, executionResult: resultString });
      } catch (executionError) {
        const errorMessage = executionError instanceof Error ? executionError.message : "An unknown execution error occurred.";
        useClickableStore.getState().updateCard(newCard.id, { status: 'error', generatedCode, executionResult: errorMessage });
      }
    } catch (generationError) {
      const errorMessage = generationError instanceof Error ? `Failed to generate code: ${generationError.message}` : "An unknown generation error occurred.";
      useClickableStore.getState().updateCard(newCard.id, { status: 'error', generatedCode: "// Code generation failed", executionResult: errorMessage });
    }
  };

  handleCodeAction = (label: string, context: string, result: string | number, icon?: React.ReactNode) => {
    this.handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt: label,
      context,
      type: 'code',
      status: 'success',
      conversation: [{ type: 'system', text: String(result) }],
      icon: icon,
    };
    useClickableStore.getState().addCard(newCard);
    useClickableStore.getState().setSidebarVisible(true);
  };
  
  handleDomCodeAction = (action: PredefinedAction) => {
    this.handleClosePopover();
    if (!action.code) return;
    const range = useClickableStore.getState().lastSelectionRange ?? undefined;
    executeDomModificationCode(action.code, range);
  };

  runAgentTurn = async (card: Card) => {
    useClickableStore.getState().updateCard(card.id, { status: 'loading' });
    
    const provider = providers['gemini'].instance;
    const history = [{ type: 'system' as const, text: card.context }, ...card.conversation];
    const stream = provider.processAgentStream(history, agentTools);

    let finalAiText = '';
    
    for await (const result of stream) {
        if (result.type === 'text') {
            finalAiText += result.payload;

            const currentCard = useClickableStore.getState().cards.find(c => c.id === card.id);
            if (!currentCard) return;

            const newConversation = [...currentCard.conversation];
            const lastPart = newConversation[newConversation.length - 1];
            if (lastPart?.type === 'ai') {
                lastPart.text = finalAiText;
            } else {
                newConversation.push({ type: 'ai', text: finalAiText });
            }
            useClickableStore.getState().updateCard(card.id, { conversation: newConversation });

        } else if (result.type === 'tool_call') {
            const toolCall = result.payload;

            if (toolCall.name === 'executeDomModification' || toolCall.name === 'createOrUpdateAction') {
                useClickableStore.getState().updateCard(card.id, { pendingToolCall: toolCall, status: 'success' });
                return; 
            }

            if (toolCall.name === 'readPageContent') {
                const resultText = readPageContent(toolCall.args.selector);
                const toolResponsePart: ConversationPart = { type: 'tool_response', text: resultText, toolCall };
                
                const currentCard = useClickableStore.getState().cards.find(c => c.id === card.id);
                if (!currentCard) return;

                const nextCardState: Card = {
                    ...currentCard,
                    conversation: [...currentCard.conversation, toolResponsePart]
                };
                useClickableStore.getState().updateCard(card.id, nextCardState);
                
                this.runAgentTurn(nextCardState);
                return;
            }
        }
    }
    
    useClickableStore.getState().updateCard(card.id, { status: 'success' });
  };

  handleAgentAction = (prompt: string, context: string, icon?: React.ReactNode) => {
    this.handleClosePopover();
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt,
      context,
      type: 'agent',
      status: 'loading',
      conversation: [{ type: 'user', text: prompt }],
      icon: icon || React.createElement(SparklesIcon),
      selectionRange: useClickableStore.getState().lastSelectionRange?.cloneRange(),
    };
    useClickableStore.getState().addCard(newCard);
    useClickableStore.getState().setSidebarVisible(true);
    this.runAgentTurn(newCard);
  };
  
  handleNewAgentCard = () => {
    const newCard: Card = {
      id: crypto.randomUUID(),
      prompt: 'New Agent Chat',
      context: '',
      type: 'agent',
      status: 'success',
      conversation: [],
      icon: React.createElement(SparklesIcon),
    };
    useClickableStore.getState().addCard(newCard);
    useClickableStore.getState().setSidebarVisible(true);
  };

  handleFollowUp = async (cardId: string, message: string) => {
    let cardToUpdate = useClickableStore.getState().cards.find(c => c.id === cardId);
    if (!cardToUpdate) return;
    
    const updatedCard = {
        ...cardToUpdate,
        status: 'loading' as const,
        conversation: [...cardToUpdate.conversation, { type: 'user' as const, text: message }]
    };
    useClickableStore.getState().updateCard(cardId, updatedCard);
  
    if (updatedCard.type === 'agent') {
      this.runAgentTurn(updatedCard);
    }
  };

  handleApproveToolCall = (cardId: string) => {
    const card = useClickableStore.getState().cards.find(c => c.id === cardId);
    if (!card || !card.pendingToolCall) return;

    const { name, args } = card.pendingToolCall;
    let result = '';

    if (name === 'executeDomModification') {
        result = executeDomModificationCode(args.code, card.selectionRange?.cloneRange());
    } else if (name === 'createOrUpdateAction') {
        result = saveDomCodeAction(args.name, args.code);
    }

    const toolResponsePart: ConversationPart = { type: 'tool_response', text: result, toolCall: card.pendingToolCall };
    
    const nextCardForAgent: Card = { ...card, pendingToolCall: null, conversation: [...card.conversation, toolResponsePart] };
    
    useClickableStore.getState().updateCard(cardId, nextCardForAgent);
    this.runAgentTurn(nextCardForAgent);
  };
  
  handleDenyToolCall = (cardId: string) => {
    const card = useClickableStore.getState().cards.find(c => c.id === cardId);
    if (!card || !card.pendingToolCall) return;
    
    const result = 'User denied the action.';
    const toolResponsePart: ConversationPart = { type: 'tool_response', text: result, toolCall: card.pendingToolCall };

    const nextCardForAgent: Card = { ...card, pendingToolCall: null, conversation: [...card.conversation, toolResponsePart] };

    useClickableStore.getState().updateCard(cardId, nextCardForAgent);
    this.runAgentTurn(nextCardForAgent);
  };

  handleDeleteCard = (id: string) => {
    useClickableStore.getState().removeCard(id);
  };
  
  handleToggleSidebar = () => {
    useClickableStore.getState().toggleSidebar();
  };
}