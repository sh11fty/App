import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { App } from './App';
import { createWorkbook } from './workbook';

createWorkbook().then((wb) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FluentProvider theme={webLightTheme} style={{ minHeight: '100vh' }}>
        <App workbook={wb} />
      </FluentProvider>
    </StrictMode>,
  );
});
