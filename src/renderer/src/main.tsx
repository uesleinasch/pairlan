import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './m3'
import './theme/tokens.css'
import './theme/base.css'
import './app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
