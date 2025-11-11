import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/stylesheet.css'
import Routing from './routes/Routing'
import AuthProvider from './auth/AuthProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Routing />
    </AuthProvider>
  </StrictMode>,
)