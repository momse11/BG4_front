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

// Use server WS broadcast only; hydrate SPA when ws.js emits `combat_started_remote`.
try {
  window.addEventListener('combat_started_remote', (ev) => {
    try {
      const data = ev.detail || {};
      const combate = data.combate || data.combat || null;
      const partida = data.partidaId || data.partida_id || data.partida || null;
      const startAt = data.startAt || (data.combate && data.combate.startAt) || Date.now();
      if (combate && combate.id && partida) {
        const target = `/partida/${partida}/combate/${combate.id}`;
        const delay = Math.max(0, Number(startAt) - Date.now());
        console.debug('[global] combat_started_remote received, scheduling SPA navigation to', target, 'in', delay, 'ms');
        if (window.__nn_combat_nav_timer) { clearTimeout(window.__nn_combat_nav_timer); window.__nn_combat_nav_timer = null; }
        window.__nn_combat_nav_timer = setTimeout(() => {
          try { window.history.pushState({}, '', target); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) { window.location.href = target; }
        }, delay);
      }
    } catch (e) { console.error('combat_started_remote handler error', e); }
  });
} catch (e) { /* noop */ }