import { GeminiProvider } from './GeminiProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import type { AIProvider } from '../../types';

interface ProviderInfo {
    name: string;
    instance: AIProvider;
}

export const providers: Record<string, ProviderInfo> = {
    'gemini': { name: 'Google Gemini', instance: new GeminiProvider() },
    'dashscope': { name: 'DashScope (Qwen)', instance: new OpenAICompatibleProvider('https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen3-max') },
    'deepseek': { name: 'DeepSeek', instance: new OpenAICompatibleProvider('https://api.deepseek.com/v1', 'deepseek-chat') },
    'kimi': { name: 'Kimi (Moonshot)', instance: new OpenAICompatibleProvider('https://api.moonshot.cn/v1', 'moonshot-v1-8k') },
    'glm': { name: 'GLM (Zhipu)', instance: new OpenAICompatibleProvider('https://open.bigmodel.cn/api/paas/v4', 'glm-4') },
};
