import React, { useState, useRef, useEffect } from 'react';
import type { Card, PendingToolCall, ConversationPart } from '../types';
import { CloseIcon, SparklesIcon, SendIcon, ShieldCheckIcon, ChevronDownIcon } from './Icons';
import { usePresenter } from '../context/PresenterContext';

interface ActionCardProps {
  card: Card;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400"></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

const BlinkingCursor: React.FC = () => (
    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-bottom" />
);

const PendingToolCallCard: React.FC<{ toolCall: PendingToolCall, onApprove: () => void, onDeny: () => void }> = ({ toolCall, onApprove, onDeny }) => {
    const { name, args } = toolCall;
    const code = name === 'executeDomModification' ? args.code : name === 'createOrUpdateAction' ? args.code : JSON.stringify(args, null, 2);
    const explanation = args.explanation || 'The AI wants to perform an action.';

    return (
        <div className="p-3 border-t border-yellow-800 bg-yellow-900/20 space-y-3">
            <div className="flex items-start gap-2">
                <ShieldCheckIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1"/>
                <div>
                    <h4 className="font-semibold text-yellow-300">Confirmation Required</h4>
                    <p className="text-xs text-yellow-200">{explanation}</p>
                </div>
            </div>
            
            <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">Tool: <span className="font-mono text-yellow-400">{name}</span></p>
                {name === 'createOrUpdateAction' && <p className="text-xs font-semibold text-gray-400 mb-1">Action Name: <span className="font-mono text-yellow-400">{args.name}</span></p>}
                <pre className="bg-gray-900/50 p-2 rounded-md text-xs overflow-x-auto max-h-40">
                    <code className="font-mono text-cyan-300">{code}</code>
                </pre>
            </div>
            
            <div className="flex justify-end gap-2">
                <button onClick={onDeny} className="px-3 py-1 text-sm font-semibold bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors">
                    Deny
                </button>
                <button onClick={onApprove} className="px-3 py-1 text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors">
                    Approve
                </button>
            </div>
        </div>
    );
};

const ExecutedToolCard: React.FC<{ part: ConversationPart }> = ({ part }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!part.toolCall) return null;

    const { name, args } = part.toolCall;
    const isError = part.text.toLowerCase().startsWith('error:');
    const code = args.code || JSON.stringify(args, null, 2);

    return (
        <div className={`rounded-lg border ${isError ? 'bg-red-900/20 border-red-800' : 'bg-gray-700/30 border-gray-700'} my-2 overflow-hidden`}>
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-2 text-left flex justify-between items-center"
            >
                <p className="text-xs font-semibold text-gray-400">
                    Tool Executed: <span className={`font-mono ${isError ? 'text-red-300' : 'text-green-300'}`}>{name} - {isError ? 'Error' : 'Success'}</span>
                </p>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                 <div className="px-3 pb-3 animate-fade-in-down-fast">
                    <pre className="bg-gray-900/50 p-2 rounded-md text-xs overflow-x-auto max-h-40 mb-2">
                        <code className="font-mono text-cyan-300">{code}</code>
                    </pre>
                    <p className="text-xs font-semibold text-gray-400 mb-1">Result:</p>
                    <div className="max-h-40 overflow-y-auto">
                        <p className={`text-xs font-mono p-2 rounded-md ${isError ? 'text-red-300' : 'text-gray-300'}`}>
                            {part.text}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};


export const ActionCard: React.FC<ActionCardProps> = ({ card }) => {
    const { clickableManager } = usePresenter();
    const [followUpMessage, setFollowUpMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = scrollRef.current;
        if (element) {
            // Heuristic to check if user has scrolled up significantly
            const isScrolledUp = element.scrollHeight - element.scrollTop > element.clientHeight + 100;
            if (!isScrolledUp) {
                element.scrollTop = element.scrollHeight;
            }
        }
    }, [card.conversation, card.status]);


    const handleFollowUpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (followUpMessage.trim() && card.status !== 'loading' && !card.pendingToolCall) {
            clickableManager.handleFollowUp(card.id, followUpMessage.trim());
            setFollowUpMessage('');
        }
    };
    
    const icon = card.icon || <SparklesIcon className="w-4 h-4" />;
    const isConversational = card.type === 'agent';

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg flex flex-col animate-fade-in-up max-h-[90vh]">
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex justify-between items-start flex-shrink-0">
                <div>
                    <p className="text-sm font-medium text-blue-300 flex items-center gap-2">
                        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                        <span>{card.prompt}</span>
                    </p>
                    {card.context && (
                      <p className="text-xs text-gray-400 mt-1 italic truncate max-w-xs">"{card.context}"</p>
                    )}
                </div>
                <button onClick={() => clickableManager.handleDeleteCard(card.id)} className="text-gray-500 hover:text-white transition-colors p-1 -mt-1 -mr-1">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>

            {/* AI Code Execution Area (Non-conversational) */}
            {card.type === 'ai-code' && (
                <div className="p-3 text-sm text-gray-200 space-y-3">
                    {card.status === 'loading' && <LoadingSpinner />}
                    {card.status !== 'loading' && (
                        <>
                            <div>
                                <h4 className="text-xs font-semibold text-gray-400 mb-1">Generated Code:</h4>
                                <pre className="bg-gray-900/50 p-2 rounded-md text-xs overflow-x-auto">
                                    <code className="font-mono text-pink-300">{card.generatedCode}</code>
                                </pre>
                            </div>
                             <div>
                                <h4 className={`text-xs font-semibold mb-1 ${card.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                                    {card.status === 'error' ? 'Execution Error:' : 'Result:'}
                                </h4>
                                <pre className="bg-gray-900/50 p-2 rounded-md text-xs overflow-x-auto">
                                    <code className={`font-mono ${card.status === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                                        {card.executionResult}
                                    </code>
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Conversation Area */}
            {isConversational && (
                <div ref={scrollRef} className="p-3 text-sm text-gray-200 space-y-3 overflow-y-auto max-h-[400px]">
                    {card.conversation.map((part, index) => (
                        <div key={index}>
                            {part.type === 'user' && (
                                <div className="text-right">
                                    <div className="inline-block p-2 rounded-lg bg-gray-700/50 text-left">
                                        <p className="whitespace-pre-wrap">{part.text}</p>
                                    </div>
                                </div>
                            )}
                            {part.type === 'ai' && (
                                <div>
                                    <div className="inline-block p-2 rounded-lg bg-blue-900/30">
                                        <p className="whitespace-pre-wrap">
                                            {part.text}
                                            {card.status === 'loading' && index === card.conversation.length - 1 && <BlinkingCursor />}
                                        </p>
                                    </div>
                                </div>
                            )}
                             {part.type === 'system' && (
                                 <p className="text-center text-xs text-gray-500 italic py-1">{part.text}</p>
                             )}
                            {part.type === 'tool_response' && (
                                <ExecutedToolCard part={part} />
                            )}
                            {part.type === 'error' && (
                                <div className="inline-block p-2 rounded-lg bg-red-900/30">
                                    <p className="whitespace-pre-wrap">{part.text}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    {card.status === 'loading' && (!card.conversation.length || card.conversation[card.conversation.length - 1].type !== 'ai') && (
                        <div>
                            <div className="inline-block p-2 rounded-lg bg-blue-900/30 animate-fade-in-up">
                                <LoadingSpinner />
                            </div>
                        </div>
                    )}
                </div>
            )}

             {/* System/Code Area */}
             {card.type === 'code' && (
                 <div className="p-3 text-sm text-gray-200">
                     <div className="inline-block p-2 rounded-lg bg-gray-700/50">
                        <p className="whitespace-pre-wrap font-mono text-lg text-green-300">{card.conversation[0]?.text}</p>
                    </div>
                </div>
            )}

            {/* Pending Tool Call Area */}
            {card.type === 'agent' && card.pendingToolCall && (
                <PendingToolCallCard 
                    toolCall={card.pendingToolCall}
                    onApprove={() => clickableManager.handleApproveToolCall(card.id)}
                    onDeny={() => clickableManager.handleDenyToolCall(card.id)}
                />
            )}

            {/* Grounding Sources */}
            {card.grounding && card.grounding.length > 0 && (
                <div className="px-3 pt-2 pb-3 border-t border-gray-700 flex-shrink-0">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Sources from Google Search:</h4>
                    <ul className="space-y-1">
                        {card.grounding.map((chunk, index) => (
                            chunk.web && (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-gray-500 text-xs mt-0.5">&#8226;</span>
                                    <a 
                                        href={chunk.web.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        title={chunk.web.uri}
                                        className="text-xs text-blue-400 hover:underline"
                                    >
                                        {chunk.web.title}
                                    </a>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
            
            {/* Follow-up Form */}
            {isConversational && (
                <div className="px-3 pt-3 pb-1 border-t border-gray-700 bg-gray-900/20 flex-shrink-0">
                    <form onSubmit={handleFollowUpSubmit} className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={followUpMessage}
                            onChange={(e) => setFollowUpMessage(e.target.value)}
                            placeholder={card.type === 'agent' ? 'Continue agent conversation...' : 'Ask a follow-up...'}
                            className="flex-1 bg-gray-800/70 text-gray-200 placeholder-gray-500 text-sm px-3 py-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={card.status === 'loading' || !!card.pendingToolCall}
                        />
                        <button 
                            type="submit" 
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                            disabled={!followUpMessage.trim() || card.status === 'loading' || !!card.pendingToolCall}
                        >
                            <SendIcon className="w-5 h-5"/>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};