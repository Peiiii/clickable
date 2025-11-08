import type { AgentTool } from '../types';
import { ParamType } from '../types';

export const agentTools: AgentTool[] = [
    {
        name: 'readPageContent',
        description: "Reads and returns text content from the current webpage using a CSS selector. This is a SAFE, read-only action that runs automatically without user confirmation.",
        parameters: {
            type: ParamType.OBJECT,
            // FIX: Add missing description property
            description: 'Parameters for the readPageContent tool.',
            properties: {
                selector: {
                    type: ParamType.STRING,
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
            type: ParamType.OBJECT,
            // FIX: Add missing description property
            description: 'Parameters for the executeDomModification tool.',
            properties: {
                code: {
                    type: ParamType.STRING,
                    description: 'The self-contained JavaScript code to execute. This code will have access to a `range` variable (a DOM Range object) representing the user\'s original text selection.',
                },
                explanation: {
                    type: ParamType.STRING,
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
            type: ParamType.OBJECT,
            // FIX: Add missing description property
            description: 'Parameters for the createOrUpdateAction tool.',
            properties: {
                name: {
                    type: ParamType.STRING,
                    description: 'A short, descriptive name for the action, e.g., "Highlight Yellow".',
                },
                code: {
                    type: ParamType.STRING,
                    description: 'The JavaScript code that this action will execute.',
                },
                explanation: {
                    type: ParamType.STRING,
                    description: 'A brief, user-friendly explanation of what this new action will do.'
                }
            },
            required: ['name', 'code', 'explanation'],
        },
    },
    {
        googleSearch: {}
    }
];