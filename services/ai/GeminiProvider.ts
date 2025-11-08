import { Content, Part, Tool, Type as GeminiType } from "@google/genai";
import type { AIProvider, AgentStreamResult, ConversationPart, AgentTool, AbstractTool, ToolParameter, ParamType, PendingToolCall } from '../../types';
import { ai } from '../geminiService';

function isAbstractTool(tool: AgentTool): tool is AbstractTool {
    return 'name' in tool;
}

// Maps our abstract ParamType to Gemini's Type enum
const mapParamTypeToGemini = (type: ParamType): GeminiType => {
    switch(type) {
        case 'string': return GeminiType.STRING;
        case 'number': return GeminiType.NUMBER;
        case 'boolean': return GeminiType.BOOLEAN;
        case 'object': return GeminiType.OBJECT;
        case 'array': return GeminiType.ARRAY;
        default: return GeminiType.TYPE_UNSPECIFIED;
    }
}

// Recursively converts our abstract tool parameter definition to Gemini's format
const convertParamsToGemini = (params: ToolParameter): any => {
    const geminiParams: any = {
        type: mapParamTypeToGemini(params.type),
        description: params.description,
    };
    if (params.properties) {
        geminiParams.properties = {};
        for(const key in params.properties) {
            geminiParams.properties[key] = convertParamsToGemini(params.properties[key]);
        }
    }
     if (params.items) {
        geminiParams.items = convertParamsToGemini(params.items);
    }
    if (params.required) {
        geminiParams.required = params.required;
    }
    return geminiParams;
}


export class GeminiProvider implements AIProvider {

    private buildAgentHistory(conversation: ConversationPart[]): Content[] {
        const history: Content[] = [];

        const systemInstruction = `You are a powerful agent that can modify web pages and create tools for the user.
- You can use Google Search to find up-to-date information.
- Analyze the user's request and the provided context.
- Decide which tools to use, if any, to fulfill the request.
- You can use multiple tools in sequence. Some tools are 'safe' and run automatically (like reading content). Other tools are 'dangerous' and require user confirmation.
- When you use a tool, provide a friendly explanation for the user.
- If a user denies a tool, acknowledge it and ask for clarification on how to proceed.`;

        const context = conversation.find(p => p.type === 'system')?.text || '';
        const contextPart = context
            ? `\n\nSelected Text (Context):\n---\n${context}\n---`
            : `\n\nNote: There is no text selected on the page. If the user asks about the page, you should use the 'readPageContent' tool to get information.`;

        history.push({
            role: 'user',
            parts: [{ text: `${systemInstruction}${contextPart}` }]
        });
        history.push({ role: 'model', parts: [{ text: "Understood. I am ready to act as an agent."}]});


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

    private convertTools(tools: AgentTool[]): Tool[] {
        const functionDeclarations = tools.filter(isAbstractTool).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: convertParamsToGemini(tool.parameters)
        }));
        
        const googleSearch = tools.find(t => 'googleSearch' in t);

        const geminiTools: Tool[] = [];
        if (functionDeclarations.length > 0) {
            geminiTools.push({ functionDeclarations });
        }
        if (googleSearch) {
            geminiTools.push({ googleSearch: {} });
        }
        
        return geminiTools;
    }

    async* processAgentStream(conversationHistory: ConversationPart[], tools: AgentTool[]): AsyncGenerator<AgentStreamResult> {
        const chat = ai.chats.create({
            model: 'gemini-2.5-pro',
            history: this.buildAgentHistory(conversationHistory),
            config: {
                tools: this.convertTools(tools),
            }
        });

        try {
            const partsToSend: Part[] = conversationHistory.slice(-1).map(p => {
                 if (p.type === 'tool_response' && p.toolCall) {
                    return { functionResponse: { name: p.toolCall.name, response: { result: p.text } } };
                 }
                 return { text: p.text };
            });

            const response = await chat.sendMessageStream({ message: partsToSend });

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

    async generateCode(prompt: string, context: string): Promise<string> {
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
        console.error("Error generating code with Gemini:", error);
        throw error;
      }
    }
}
