import React, { createContext, useContext, useEffect } from 'react';
import { Presenter } from '../presenter/Presenter';

const presenter = new Presenter();

export const PresenterContext = createContext<Presenter | null>(null);

export const PresenterProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  useEffect(() => {
    presenter.init();
    return () => {
        presenter.destroy();
    }
  }, []);

  return (
    <PresenterContext.Provider value={presenter}>
      {children}
    </PresenterContext.Provider>
  );
};

export const usePresenter = (): Presenter => {
  const context = useContext(PresenterContext);
  if (!context) {
    throw new Error('usePresenter must be used within a PresenterProvider');
  }
  return context;
};
