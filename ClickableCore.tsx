import React from 'react';
import { PopoverMenu } from './components/PopoverMenu';
import { Sidebar } from './components/Sidebar';
import { useClickableStore } from './stores/clickableStore';

export const ClickableCore: React.FC = () => {
  const selection = useClickableStore((state) => state.selection);
  const highlightRects = useClickableStore((state) => state.highlightRects);

  return (
    <>
      {highlightRects.map((rect, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(96, 165, 250, 0.4)',
            borderRadius: '3px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      ))}
      
      {selection && <PopoverMenu />}
      
      <div data-no-select="true">
        <Sidebar />
      </div>

       <style>{`
          @keyframes fade-in-down {
            from { opacity: 0; transform: translate(-50%, -10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }

          @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
          
          @keyframes fade-in-down-fast {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-down-fast { animation: fade-in-down-fast 0.2s ease-out forwards; }
       `}</style>
    </>
  );
};
