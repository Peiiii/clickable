import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}

export const ai = new GoogleGenAI({ apiKey });
