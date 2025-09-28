import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('[main.tsx] Starting React app...')
const rootElement = document.getElementById('root')
console.log('[main.tsx] Root element found:', !!rootElement)

if (rootElement) {
  console.log('[main.tsx] Creating React root and rendering...')
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('[main.tsx] React render called')
} else {
  console.error('[main.tsx] FATAL: Could not find root element!')
}