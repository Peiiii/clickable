
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

export async function processTextWithGemini(prompt: string, context: string): Promise<string> {
  try {
    const fullPrompt = `Based on the following selected text from a webpage, perform the requested action.

Selected Text (Context):
---
${context}
---

User's Action/Request: "${prompt}"

Provide a concise and direct response. If the request is for a translation, only provide the translated text.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt
    });

    return response.text;
  } catch (error) {
    console.error("Error processing text with Gemini:", error);
    if (error instanceof Error) {
        return `An error occurred with the AI model: ${error.message}`;
    }
    return "An unknown error occurred while contacting the AI.";
  }
}
