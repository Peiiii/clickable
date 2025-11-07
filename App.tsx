
import React from 'react';
import { ClickableCore } from './ClickableCore';
import { DemoContent } from './components/DemoContent';

const App: React.FC = () => {
  return (
    <ClickableCore>
      <DemoContent />
    </ClickableCore>
  );
};

export default App;
