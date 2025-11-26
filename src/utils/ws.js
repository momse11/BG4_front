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
    let reconnectAttempts = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // ms

    const connect = () => {
      // avoid creating duplicate connecting sockets
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        ws = wsRef.current;
        return;
      }

      ws = new WebSocket('ws://localhost:3000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Conectado a WS');
        reconnectAttempts = 0;
        try { ws.send(JSON.stringify({ type: 'JOIN', partidaId, jugador })); } catch (e) { /* ignore */ }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.debug('[usePartidaWS] WS message', data);
          if (data && data.type === 'PARTIDA_DELETED') {
            console.debug('[usePartidaWS] PARTIDA_DELETED received — redirecting to /partidas');
            try { window.location.href = '/partidas'; } catch (e) { /* noop */ }
            return;
          }
          if (data && data.type === 'PARTIDA_STARTED') {
            try {
              const mapaId = data.mapaId || data.mapa_id || null;
              if (mapaId) {
                console.debug('[usePartidaWS] PARTIDA_STARTED received — redirecting to map', partidaId, mapaId);
                try { window.location.href = `/partida/${partidaId}/mapa/${mapaId}`; } catch (e) { /* noop */ }
              }
            } catch (e) { /* noop */ }
            return;
          }
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
        // exponential backoff reconnect, with limit
        if (reconnectAttempts < maxRetries) {
          reconnectAttempts += 1;
          const delay = baseDelay * Math.pow(2, reconnectAttempts - 1);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
        } else {
          console.warn('Max WS reconnect attempts reached for partida', partidaId);
        }
      };

      ws.onerror = (err) => {
        console.error('WS error:', err);
      };
    };

    connect();

    return () => {
      try {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
          try { wsRef.current.close(); } catch (e) {}
        }
      } catch (e) {}
    };
  }, [partidaId, jugador]);

  return { jugadores };
}
