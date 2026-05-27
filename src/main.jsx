import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Sube el service worker para habilitar la funcionalidad PWA (instalación en celular y PC)
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
