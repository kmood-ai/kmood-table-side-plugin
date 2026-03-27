import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n';
import AppProvider from './AppProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AppProvider />
    </I18nProvider>
  </StrictMode>,
);
