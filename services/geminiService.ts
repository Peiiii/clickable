
import { GoogleGenAI, Chat, Content } from "@google/genai";
import type { ConversationPart } from '../types';

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

function buildChatHistory(context: string, conversation: ConversationPart[]): Content[] {
    const history: Content[] = [];
    
    // The initial context is the first user message.
    history.push({
        role: 'user',
        parts: [{ text: `Based on the following selected text from a webpage, perform the requested action.

Selected Text (Context):
---
${context}
---

Your first response should directly address the user's initial request. For subsequent messages, continue the conversation naturally.` }]
    });

    // Add conversation history
    conversation.forEach(part => {
        if (part.type === 'ai') {
            history.push({ role: 'model', parts: [{ text: part.text }] });
        } else if (part.type === 'user') {
            history.push({ role: 'user', parts: [{ text: part.text }] });
        }
        // 'error' parts are for UI only, not sent to the model
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
      history: buildChatHistory(context, conversationHistory),
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