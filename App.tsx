import React from 'react';
import { ClickableCore } from './ClickableCore';
import { DemoContent } from './components/DemoContent';
import { PresenterProvider } from './context/PresenterContext';

const App: React.FC = () => {
  return (
    <PresenterProvider>
      <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-8">
        <DemoContent />
      </div>
      <ClickableCore />
    </PresenterProvider>
  );
};

export default App;
