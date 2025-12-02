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

// BroadcastChannel listener: recibir notificaciones de combate y navegar vía history (SPA)
try {
  const bc = new BroadcastChannel('nn_combat_channel');
  bc.onmessage = (ev) => {
    try {
      const m = ev.data || {};
      if (m && m.type === 'COMBAT_STARTED' && m.combateId) {
        const target = `/partida/${m.partidaId}/combate/${m.combateId}`;
        console.debug('[BC] received COMBAT_STARTED, navigating SPA to', target);
        // usar pushState + dispatch popstate para que React Router actualice la ruta sin reload
        try {
          window.history.pushState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (e) {
          // fallback: reload if pushState fails
          window.location.href = target;
        }
      }
    } catch (e) { console.error('BC onmessage error', e); }
  };
} catch (e) { console.debug('BroadcastChannel not available', e); }