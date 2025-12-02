import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../auth/AuthProvider';
import api from './api';

const WS_URL = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') ? 'ws://localhost:3000/ws' : 'ws://localhost:3000/ws';

export const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const reconnectRef = useRef({ attempts: 0, timer: null, shouldReconnect: true });

  useEffect(() => {
    if (!user) return;
    reconnectRef.current.shouldReconnect = true;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectRef.current.attempts = 0;
          setConnected(true);
          console.debug('[WebSocketProvider] connected');
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            setMessages((prev) => [...prev, data]);
          } catch (e) {
            console.error('[WebSocketProvider] parse message error', e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          if (!reconnectRef.current.shouldReconnect) return;
          reconnectRef.current.attempts += 1;
          const delay = Math.min(30000, 1000 * Math.pow(2, reconnectRef.current.attempts));
          reconnectRef.current.timer = setTimeout(connect, delay);
        };

        ws.onerror = (err) => console.error('[WebSocketProvider] ws error', err);
      } catch (e) {
        console.error('[WebSocketProvider] connection failed', e);
      }
    }

    connect();

    return () => {
      reconnectRef.current.shouldReconnect = false;
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
      try { if (wsRef.current) wsRef.current.close(); } catch (e) {}
    };
  }, [user]);

  // Auto-leave: cuando el usuario navega fuera de /partida/:id, avisar al backend
  const location = useLocation();
  const prevPartidaRef = useRef(null);

  useEffect(() => {
    try {
      const m = String(location?.pathname || '').match(/^\/partida\/([^/]+)/);
      const curPartida = m ? m[1] : null;
      const prev = prevPartidaRef.current;
      if (prev && prev !== curPartida) {
        // salió de la partida `prev`
        (async () => {
          try {
            await api.post(`/partidas/${prev}/leave`);
          } catch (e) {
            console.debug('Auto-leave api.post failed, attempting fallback fetch', e?.response?.data || e?.message || e);
            try {
              const token = localStorage.getItem('token');
              await fetch(`${api.defaults.baseURL}/partidas/${prev}/leave`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: null,
                keepalive: true,
              });
              console.debug('Auto-leave fallback fetch sent');
            } catch (err2) {
              console.debug('Auto-leave fallback fetch failed', err2?.message || err2);
            }
          }
        })();
      }
      prevPartidaRef.current = curPartida;
    } catch (e) {
      // noop
    }
  }, [location, user]);

  const sendMessage = (msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  return (
    <WebSocketContext.Provider value={{ sendMessage, connected, messages }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);