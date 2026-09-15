import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { VisualSettingsProvider } from './context/VisualSettingsContext'

// Hide harmless THREE.Clock deprecation warning from react-three-fiber
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) {
    return;
  }
  originalWarn(...args);
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VisualSettingsProvider>
      <App />
    </VisualSettingsProvider>
  </StrictMode>,
)
