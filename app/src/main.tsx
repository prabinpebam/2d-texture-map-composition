import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

const rootElement = document.getElementById('root')

window.addEventListener('error', (event) => {
  if (
    event.message ===
    'ResizeObserver loop completed with undelivered notifications.'
  ) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}, true)

if (!rootElement) {
  throw new Error('TextureFlow root element is missing')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
