// instrument.ts must be the first import — initialises Sentry + Datadog before React loads
import './instrument'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Design system styles (must be first)
import './styles/variables.css'
import './styles/global.css'
import './styles/animations.css'

import App from './App.tsx'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext.tsx'

// Initialize theme
import { initTheme } from './utils/theme'
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagsProvider>
      <App />
    </FeatureFlagsProvider>
  </StrictMode>,
)
