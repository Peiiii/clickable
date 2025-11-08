import type { AIProvider, AgentStreamResult, ConversationPart, AgentTool, AbstractTool, ToolParameter } from '../../types';

function isAbstractTool(tool: AgentTool): tool is AbstractTool {
    return 'name' in tool;
}

export class OpenAICompatibleProvider implements AIProvider {
    private baseURL: string;
    private model: string;

    constructor(baseURL: string, model: string) {
        this.baseURL = baseURL;
        this.model = model;
    }

    private convertTools(tools: AgentTool[]): any[] {
        return tools.filter(isAbstractTool).map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: this.convertParamsToOpenAI(tool.parameters),
            }
        }));
    }

    private convertParamsToOpenAI(params: ToolParameter): any {
        const openAIParams: any = {
            type: params.type,
            description: params.description,
        };
        if (params.properties) {
            openAIParams.properties = {};
            for(const key in params.properties) {
                openAIParams.properties[key] = this.convertParamsToOpenAI(params.properties[key]);
            }
        }
        if (params.items) {
            openAIParams.items = this.convertParamsToOpenAI(params.items);
        }
        if (params.required) {
            openAIParams.required = params.required;
        }
        return openAIParams;
    }

    private buildHistory(conversation: ConversationPart[]): any[] {
        const messages: any[] = [];
        const systemPrompt = `You are a powerful agent that can modify web pages. Analyze the user's request and decide which tools to use.`;
        messages.push({ role: 'system', content: systemPrompt });

        conversation.forEach(part => {
            if (part.type === 'user') {
                messages.push({ role: 'user', content: part.text });
            } else if (part.type === 'ai') {
                messages.push({ role: 'assistant', content: part.text });
            } else if (part.type === 'tool_response' && part.toolCall) {
                messages.push({
                    role: 'tool',
                    tool_call_id: part.toolCall.id,
                    name: part.toolCall.name,
                    content: part.text,
                });
            }
        });
        return messages;
    }

    async* processAgentStream(conversation: ConversationPart[], tools: AgentTool[]): AsyncGenerator<AgentStreamResult> {
        const body = {
            model: this.model,
            messages: this.buildHistory(conversation),
            tools: this.convertTools(tools),
            tool_choice: "auto",
            stream: true,
        };

        try {
            const response = await fetch(this.baseURL.endsWith('/') ? `${this.baseURL}chat/completions` : `${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.API_KEY}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("Could not get stream reader");
            
            const decoder = new TextDecoder();
            let buffer = '';
            
            let currentToolCalls: any[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data.trim() === '[DONE]') continue;

                        try {
                            const chunk = JSON.parse(data);
                            const delta = chunk.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                yield { type: 'text', payload: delta.content };
                            }
                            
                            if (delta?.tool_calls) {
                                for (const toolCallDelta of delta.tool_calls) {
                                    if (toolCallDelta.index >= currentToolCalls.length) {
                                        currentToolCalls[toolCallDelta.index] = { ...toolCallDelta.function, id: toolCallDelta.id };
                                    } else {
                                        if (toolCallDelta.id) currentToolCalls[toolCallDelta.index].id = toolCallDelta.id;
                                        if (toolCallDelta.function.name) currentToolCalls[toolCallDelta.index].name += toolCallDelta.function.name;
                                        if (toolCallDelta.function.arguments) currentToolCalls[toolCallDelta.index].arguments += toolCallDelta.function.arguments;
                                    }
                                }
                            }

                            if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
                                for (const toolCall of currentToolCalls) {
                                     try {
                                        const args = JSON.parse(toolCall.arguments);
                                        yield { type: 'tool_call', payload: { id: toolCall.id, name: toolCall.name, args } };
                                    } catch (e) { console.error("Failed to parse tool call arguments", e); }
                                }
                                currentToolCalls = [];
                            }
                        } catch (e) {
                            console.error('Error parsing stream chunk:', data, e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing agent stream with ${this.baseURL}:`, error);
            throw error;
        }
    }

    async generateCode(prompt: string, context: string): Promise<string> {
        const messages = [
            {
                role: 'system',
                content: `You are a JavaScript code generation assistant. Given a text selection from a webpage and a user prompt, you must generate a single block of JavaScript code that performs the requested action.
- The code will be executed in a sandboxed environment where a variable named 'context' (a string) will be available, containing the selected text.
- Your code MUST return a value (e.g., a string, number, object, or array).
- Do NOT include any markdown formatting (like \`\`\`javascript), explanations, or any text other than the raw JavaScript code itself.`
            },
            {
                role: 'user',
                content: `User Prompt: "${prompt}"\nSelected Text (Context):\n---\n${context}\n---`
            }
        ];

        const body = {
            model: this.model,
            messages,
        };

        try {
            const response = await fetch(this.baseURL.endsWith('/') ? `${this.baseURL}chat/completions` : `${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.API_KEY}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                 const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }
            
            const result = await response.json();
            const code = result.choices?.[0]?.message?.content.replace(/```javascript\n|```/g, '').trim() || '';
            return code;
        } catch(e) {
            console.error(`Error generating code with ${this.baseURL}:`, e);
            throw e;
        }
    }
}
