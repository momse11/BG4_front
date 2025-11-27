import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/stylesheet.css'
import Routing from './routes/Routing'
import AuthProvider from './auth/AuthProvider'
// Temporarily disable global WebSocketProvider to avoid duplicate sockets
// import {WebSocketProvider}  from "./utils/WebSocketProvider";
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <BrowserRouter>
      {/* WebSocketProvider disabled for debugging duplicate connection issues */}
        <Routing />
    </BrowserRouter>
  </AuthProvider>
)