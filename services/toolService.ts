import type { PredefinedAction } from '../types';

const CUSTOM_ACTIONS_STORAGE_KEY = 'clickable-custom-actions';

/**
 * Reads text content from the page using a CSS selector.
 * @param selector The CSS selector to query.
 * @returns The text content or an error message.
 */
export const readPageContent = (selector: string): string => {
  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      return `Error: No elements found for selector "${selector}".`;
    }
    let content = '';
    elements.forEach(el => {
      if (el instanceof HTMLElement) {
        content += el.innerText + '\n';
      }
    });
    const maxLength = 15000;
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '... [Content Truncated]';
    }
    return content.trim() || `Selector "${selector}" found elements, but they contained no visible text.`;
  } catch (e) {
    return `Error executing querySelector with "${selector}": ${e instanceof Error ? e.message : String(e)}`;
  }
};

/**
 * Executes a string of JavaScript code to modify the DOM.
 * @param code The JavaScript code to execute.
 * @param range The DOM Range representing the user's selection, if any.
 * @returns A success or error message.
 */
export const executeDomModificationCode = (code: string, range?: Range): string => {
  try {
    // Only manipulate the browser's selection if a range object is actually provided.
    if (range) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    // We wrap the user's code in a try-catch to report errors back.
    const func = new Function('range', `try { ${code} } catch (e) { console.error('Executed script failed:', e); throw e; }`);
    func(range);
    return "Successfully executed.";
  } catch (e) {
    return `Execution Error: ${e instanceof Error ? e.message : String(e)}`;
  }
};

/**
 * Saves a new DOM modification script as a custom action in local storage.
 * @param label The user-friendly label for the action.
 * @param code The JavaScript code for the action.
 * @returns A success or failure message.
 */
export const saveDomCodeAction = (label: string, code: string): string => {
  const newAction: PredefinedAction = {
    id: crypto.randomUUID(),
    label,
    code,
    type: 'dom-code',
    isCustom: true,
  };

  try {
    const stored = localStorage.getItem(CUSTOM_ACTIONS_STORAGE_KEY);
    const customActions: PredefinedAction[] = stored ? JSON.parse(stored) : [];
    customActions.push(newAction);
    localStorage.setItem(CUSTOM_ACTIONS_STORAGE_KEY, JSON.stringify(customActions));
    return `Action "${label}" saved successfully.`;
  } catch (e) {
    console.error("Failed to save custom action:", e);
    return `Failed to save action: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
};
