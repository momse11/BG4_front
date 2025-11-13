//maneja los websockets (de partida nomas por ahora)

import { useEffect, useState, useRef } from "react";

export function usePartidaWS(partidaId, jugador) {
  const [jugadores, setJugadores] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Conectado a WS');
      ws.send(JSON.stringify({ type: 'JOIN', partidaId, jugador }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'UPDATE_PLAYERS') {
        setJugadores(data.jugadores);
      }
    };

    ws.onclose = () => console.log('WS cerrado');
    ws.onerror = (err) => console.error('WS error:', err);

    return () => ws.close();
  }, [partidaId, jugador]);

  return { jugadores };
}
