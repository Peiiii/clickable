import { GoogleGenAI, Chat, Content, GenerateContentResponse, Tool, Type, Part } from "@google/genai";
import type { ConversationPart, PendingToolCall } from '../types';

const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey });

const agentTools: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'readPageContent',
                description: "Reads and returns text content from the current webpage using a CSS selector. This is a SAFE, read-only action that runs automatically without user confirmation.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        selector: {
                            type: Type.STRING,
                            description: "A CSS selector (e.g., 'h1', '.article', '#main'). Use 'body' to attempt to get all visible text on the page.",
                        },
                    },
                    required: ['selector'],
                },
            },
            {
                name: 'executeDomModification',
                description: 'Executes JavaScript code to modify the DOM of the current page based on the user\'s selection. This is a DANGEROUS action and requires user confirmation.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        code: {
                            type: Type.STRING,
                            description: 'The self-contained JavaScript code to execute. This code will have access to a `range` variable (a DOM Range object) representing the user\'s original text selection.',
                        },
                        explanation: {
                           type: Type.STRING,
                           description: 'A brief, user-friendly explanation of what the code does.'
                        }
                    },
                    required: ['code', 'explanation'],
                },
            },
            {
                name: 'createOrUpdateAction',
                description: 'Creates a new custom, reusable action for the user, or updates an existing one. This is a DANGEROUS action and requires user confirmation.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: 'A short, descriptive name for the action, e.g., "Highlight Yellow".',
                        },
                        code: {
                            type: Type.STRING,
                            description: 'The JavaScript code that this action will execute.',
                        },
                        explanation: {
                           type: Type.STRING,
                           description: 'A brief, user-friendly explanation of what this new action will do.'
                        }
                    },
                    required: ['name', 'code', 'explanation'],
                },
            }
        ]
    }
];

function buildHistory(context: string, conversation: ConversationPart[]): Content[] {
    const history: Content[] = [];
    const systemInstruction = `You are a helpful AI assistant. Based on the following selected text from a webpage, perform the requested action.

Selected Text (Context):
---
${context}
---

Your first response should directly address the user's initial request. For subsequent messages, continue the conversation naturally.`;

    history.push({ role: 'user', parts: [{ text: systemInstruction }] });
    history.push({ role: 'model', parts: [{ text: "Understood. I'm ready to help."}]});

    conversation.forEach(part => {
        if (part.type === 'ai') {
            history.push({ role: 'model', parts: [{ text: part.text }] });
        } else if (part.type === 'user') {
            history.push({ role: 'user', parts: [{ text: part.text }] });
        }
    });

    return history;
}

function buildAgentHistory(conversation: ConversationPart[]): Content[] {
    const history: Content[] = [];

    const systemInstruction = `You are a powerful agent that can modify web pages and create tools for the user.
- Analyze the user's request and the provided context.
- Decide which tools to use, if any, to fulfill the request.
- You can use multiple tools in sequence. Some tools are 'safe' and run automatically (like reading content). Other tools are 'dangerous' and require user confirmation.
- When you use a tool, provide a friendly explanation for the user.
- If a user denies a tool, acknowledge it and ask for clarification on how to proceed.`;

    // The first part is always the context from the system
    const context = conversation.find(p => p.type === 'system')?.text || '';
    const contextPart = context
        ? `\n\nSelected Text (Context):\n---\n${context}\n---`
        : `\n\nNote: There is no text selected on the page. If the user asks about the page, you should use the 'readPageContent' tool to get information.`;

    history.push({
        role: 'user',
        parts: [{ text: `${systemInstruction}${contextPart}` }]
    });
    history.push({ role: 'model', parts: [{ text: "Understood. I am ready to act as an agent."}]});


    // Process the rest of the conversation
    conversation.filter(p => p.type !== 'system').forEach(part => {
        if (part.type === 'user') {
            history.push({ role: 'user', parts: [{ text: part.text }] });
        } else if (part.type === 'ai') {
            history.push({ role: 'model', parts: [{ text: part.text }] });
        } else if (part.type === 'tool_response' && part.toolCall) {
            history.push({
                role: 'model',
                parts: [{ functionCall: { name: part.toolCall.name, args: part.toolCall.args } }]
            });
            history.push({
                role: 'user',
                parts: [{ functionResponse: { name: part.toolCall.name, response: { result: part.text } } }]
            });
        }
    });

    return history;
}

export async function* processChatStream(
    prompt: string, 
    context: string, 
    conversationHistory: ConversationPart[]
): AsyncGenerator<string> {
  
  const chat: Chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: buildHistory(context, conversationHistory),
  });

  try {
      const response = await chat.sendMessageStream({ message: prompt });
      for await (const chunk of response) {
          yield chunk.text;
      }
  } catch (error) {
      console.error("Error processing text with Gemini:", error);
      throw error;
  }
}

type AgentStreamResult = 
    | { type: 'text', payload: string }
    | { type: 'tool_call', payload: PendingToolCall };

export async function* processAgentStream(
    conversationHistory: ConversationPart[]
): AsyncGenerator<AgentStreamResult> {
    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        history: buildAgentHistory(conversationHistory),
        config: {
            tools: agentTools,
        }
    });

    try {
        const lastUserMessage = conversationHistory.filter(p => p.type === 'user' || p.type === 'tool_response').pop();
        if (!lastUserMessage) throw new Error("No last user message found for agent.");

        // We construct the last message from all parts since the last model response
        const lastModelResponseIndex = conversationHistory.map(p=>p.type).lastIndexOf('ai');
        const partsToSend = conversationHistory.slice(lastModelResponseIndex + 1);

        const messageParts: Part[] = partsToSend.map(p => {
             if (p.type === 'tool_response' && p.toolCall) {
                return { functionResponse: { name: p.toolCall.name, response: { result: p.text } } };
             }
             return { text: p.text };
        });


        const response = await chat.sendMessageStream({ message: messageParts });

        for await (const chunk of response) {
            if (chunk.functionCalls) {
                for (const fc of chunk.functionCalls) {
                     yield { type: 'tool_call', payload: { id: crypto.randomUUID(), name: fc.name, args: fc.args } };
                }
            } else if (chunk.text) {
                yield { type: 'text', payload: chunk.text };
            }
        }
    } catch (error) {
        console.error("Error processing agent stream with Gemini:", error);
        throw error;
    }
}

export async function generateWithTools(prompt: string, context: string): Promise<GenerateContentResponse> {
  const fullPrompt = `Using the following selected text from a webpage as context, provide a comprehensive answer for the request.

Selected Text (Context):
---
${context}
---

Request:
${prompt}
`;

  try {
    const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: fullPrompt,
       config: {
         tools: [{googleSearch: {}}],
       },
    });
    return response;
  } catch (error) {
    console.error("Error generating content with tools:", error);
    throw error;
  }
}

export async function generateCode(prompt: string, context: string): Promise<string> {
  const fullPrompt = `User Prompt: "${prompt}"
Selected Text (Context): 
---
${context}
---
`;

  try {
    const response = await ai.models.generateContent({
       model: "gemini-2.5-pro",
       contents: fullPrompt,
       config: {
         systemInstruction: `You are a JavaScript code generation assistant. Given a text selection from a webpage and a user prompt, you must generate a single block of JavaScript code that performs the requested action.
- The code will be executed in a sandboxed environment where a variable named 'context' (a string) will be available, containing the selected text.
- Your code MUST return a value (e.g., a string, number, object, or array).
- Do NOT include any markdown formatting (like \`\`\`javascript), explanations, or any text other than the raw JavaScript code itself.`,
       },
    });
    const code = response.text.replace(/```javascript\n|```/g, '').trim();
    return code;
  } catch (error) {
    console.error("Error generating code:", error);
    throw error;
  }
}