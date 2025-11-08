import { providers } from './providers';
import type { AIProvider } from '../../types';

// Read the provider key from an environment variable, defaulting to 'gemini'.
// This allows developers to switch AI providers without changing the code.
const providerKey = process.env.AI_PROVIDER || 'gemini';

let selectedProvider: AIProvider;
let providerName: string;

if (providers[providerKey]) {
  selectedProvider = providers[providerKey].instance;
  providerName = providers[providerKey].name;
} else {
  console.warn(`AI_PROVIDER key "${providerKey}" not found in configured providers. Defaulting to Gemini.`);
  selectedProvider = providers['gemini'].instance;
  providerName = providers['gemini'].name;
}

console.log(`Clickable AI is using provider: ${providerName}`);

export const activeProvider = selectedProvider;
