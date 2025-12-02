import { useEffect, useRef } from 'react';
import { useWebSocket } from '../../utils/WebSocketProvider';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthProvider';

// Hook simple para suscribirse a eventos de combate por partida
// - partidaId: id de la partida a unirse
// - onEvent: callback(event) cuando llega un evento de tipo COMBAT_*
export default function useCombateWS(partidaId, onEvent) {
  const { user } = useContext(AuthContext);
  const { sendMessage, messages, connected } = useWebSocket();
  const lastIndex = useRef(0);

  useEffect(() => {
    if (!connected || !partidaId || !user) return;
    // enviar JOIN para unir este socket a la partida
    try {
      sendMessage({ type: 'JOIN', partidaId, jugador: { id: user.id, username: user.username } });
    } catch (e) {
      console.debug('useCombateWS: no se pudo enviar JOIN', e?.message || e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, partidaId, user]);

  useEffect(() => {
    if (!onEvent || !Array.isArray(messages)) return;
    // procesar solo mensajes nuevos
    const start = Math.max(0, lastIndex.current || 0);
    for (let i = start; i < messages.length; i++) {
      const m = messages[i];
      if (!m) continue;
      // filtrar por eventos de combate
      if (typeof m.type === 'string' && m.type.startsWith('COMBAT_')) {
        try {
          // opcional: si el evento tiene partidaId y no coincide, ignorar
          if (m.partidaId && String(m.partidaId) !== String(partidaId)) continue;
          onEvent(m);
        } catch (e) {
          console.error('useCombateWS onEvent callback failed:', e);
        }
      }
    }
    lastIndex.current = messages.length;
  }, [messages, onEvent, partidaId]);

  return { connected };
}
