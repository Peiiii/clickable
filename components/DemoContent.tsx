
import React from 'react';

export const DemoContent: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto prose prose-invert prose-lg">
      <h1 className="text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Welcome to Clickable</h1>
      <p className="text-gray-400">
        This is a demonstration of the "Clickable" AI browser extension concept. The core functionality is implemented within this single page.
        To use it, simply <strong className="text-blue-300">select any text on this page</strong>.
        A popover menu will appear, allowing you to perform AI actions on the selected content.
      </p>

      <h2 className="mt-12">The Philosophy of "Clickable"</h2>
      <p>
        The modern web is a rich tapestry of information, but interacting with it can often be cumbersome. Copying text, switching tabs to a translator or a summarizer, and then pasting it back breaks the user's flow. "Clickable" aims to eliminate this friction. By bringing powerful AI tools directly to your selection, we keep you in context, making you more efficient and focused. You don't type, you click.
      </p>
      
      <blockquote className="border-l-4 border-purple-500 pl-4 italic">
          "The future of user interfaces is not about adding more features, but about removing steps. We envision a web where every piece of content is an interactive starting point for discovery and creation."
      </blockquote>

      <h2>Example Use Cases</h2>
      <p>
        Imagine reading a complex scientific paper. You can select a dense paragraph and click "Summarize" to get the key takeaways instantly. Or, if you're browsing a foreign news site, a simple highlight and click on "Translate" gives you the information you need, right where you are. The possibilities are endless with custom actions—check grammar, change tone, explain like I'm five, or even convert to a JSON object.
      </p>
    </div>
  );
};
