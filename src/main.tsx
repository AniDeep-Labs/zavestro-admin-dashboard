import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Design system styles (must be first)
import './styles/variables.css'
import './styles/global.css'
import './styles/animations.css'

import App from './App.tsx'

// Initialize theme
import { initTheme } from './utils/theme'
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
