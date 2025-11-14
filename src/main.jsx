import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/stylesheet.css'
import Routing from './routes/Routing'
import AuthProvider from './auth/AuthProvider'
import {WebSocketProvider}  from "./utils/WebSocketProvider";

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <WebSocketProvider>
      <Routing />
    </WebSocketProvider>
  </AuthProvider>
)