
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

export async function* processTextWithGeminiStream(prompt: string, context: string): AsyncGenerator<string> {
  const fullPrompt = `Based on the following selected text from a webpage, perform the requested action.

Selected Text (Context):
---
${context}
---

User's Action/Request: "${prompt}"

Provide a concise and direct response. If the request is for a translation, only provide the translated text.`;
  
  try {
    const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: fullPrompt
    });

    for await (const chunk of response) {
      yield chunk.text;
    }
  } catch (error) {
    console.error("Error processing text with Gemini:", error);
    // Let the caller handle the error state
    throw error;
  }
}
