import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

document.documentElement.dataset.theme = 'dark'
document.documentElement.dataset.accent = 'green'
document.documentElement.dataset.platform = window.forma ? 'desktop' : 'web'

if (!window.forma && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
  // Ask the browser not to evict this device's data (Safari honours this for installed apps).
  navigator.storage?.persist?.().catch(() => {})
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
