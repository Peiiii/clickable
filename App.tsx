import React from 'react';
import { ClickableCore } from './ClickableCore';
import { DemoContent } from './components/DemoContent';

const App: React.FC = () => {
  return (
    <>
      <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-8">
        <DemoContent />
      </div>
      <ClickableCore />
    </>
  );
};

export default App;
