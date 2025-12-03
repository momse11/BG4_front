import { useEffect, useRef } from 'react';
import { useWebSocket } from '../../utils/WebSocketProvider';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthProvider';

// Hook simple para suscribirse a eventos de combate por partida
// - partidaId: id de la partida a unirse
// - onEvent: callback(event) cuando llega un evento de tipo COMBAT_*
export default function useCombateWS(partidaId, onEvent, options = {}) {
  const { user } = useContext(AuthContext);
  const ws = useWebSocket();
  const { onPartidaDeleted } = options;
  const lastIndex = useRef(0);
  
  // Valores por defecto si el contexto no está disponible
  const sendMessage = ws?.sendMessage || (() => {});
  const messages = ws?.messages || [];
  const connected = ws?.connected || false;

  useEffect(() => {
    if (!connected || !partidaId || !user || !sendMessage) return;
    // enviar JOIN para unir este socket a la partida
    try {
      console.debug('[useCombateWS] Enviando JOIN para partida', partidaId);
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
      // si la partida fue eliminada, manejar con prioridad
      if (m.type === 'PARTIDA_DELETED' && String(m.partidaId) === String(partidaId)) {
        try {
          if (onPartidaDeleted) onPartidaDeleted(m);
          else {
            try { window.location.href = '/landing'; } catch (e) {}
          }
        } catch (e) { console.error('Error onPartidaDeleted handler', e); }
        continue;
      }

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
