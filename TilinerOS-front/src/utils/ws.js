//maneja los websockets (de partida nomas por ahora)

import { useEffect, useState, useRef } from "react";

export function usePartidaWS(partidaId, jugador) {
  const [jugadores, setJugadores] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    // only connect when we have a partidaId and jugador info
    if (!partidaId || !jugador || !jugador.id) {
      // reset jugadores if no connection
      setJugadores([]);
      return;
    }

    let ws = null;
    let reconnectTimer = null;
    const connect = () => {
      ws = new WebSocket('ws://localhost:3000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Conectado a WS');
        try { ws.send(JSON.stringify({ type: 'JOIN', partidaId, jugador })); } catch (e) { /* ignore */ }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'UPDATE_PLAYERS') {
            // dedupe jugadores by id to avoid duplicate cards
            const arr = Array.isArray(data.jugadores) ? data.jugadores : [];
            const map = {};
            arr.forEach((j) => { if (j && j.id !== undefined) map[String(j.id)] = j; });
            const unique = Object.values(map);
            setJugadores(unique);
          }
        } catch (e) { console.error('WS message parse error', e) }
      };

      ws.onclose = (ev) => {
        console.log('WS cerrado', ev && ev.reason ? ev.reason : '');
        // try to reconnect once after a short delay
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 1000);
        }
      };
      ws.onerror = (err) => console.error('WS error:', err);
    };

    connect();

    return () => {
      try {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        else if (ws && ws.readyState === WebSocket.CONNECTING) ws.close();
      } catch (e) {}
    };
  }, [partidaId, jugador]);

  return { jugadores };
}
