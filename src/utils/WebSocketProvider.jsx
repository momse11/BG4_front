import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from 'react-router-dom'
import { AuthContext } from "../auth/AuthProvider";
import api from './api'

export const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!user) return;

    ws.current = new WebSocket("ws://localhost:3000/ws");

    ws.current.onopen = () => {
      console.log("WebSocket conectado");
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket desconectado");
      setConnected(false);
    };

    ws.current.onerror = (err) => {
      console.error("WS error:", err);
    };

    return () => {
      ws.current?.close();
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
            console.debug('Auto-leave failed', e?.response?.data || e?.message || e);
          }
        })();
      }
      prevPartidaRef.current = curPartida;
    } catch (e) {
      // noop
    }
  }, [location, user]);

  // enviar mensaje
  const sendMessage = (msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  };

  return (
    <WebSocketContext.Provider value={{ ws: ws.current, connected, messages, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook de uso simple
export const useWebSocket = () => useContext(WebSocketContext);