import { useEffect, useState, useRef } from "react";

// Almacenamiento global de WebSockets por partidaId para reutilizar entre componentes
const globalWSConnections = new Map();

export function usePartidaWS(partidaId, jugador, options = {}) {
  const { onPartidaDeleted, onPartidaStarted } = options;

  const [jugadores, setJugadores] = useState([]);
  const [turnoActivo, setTurnoActivo] = useState({
    personajeId: null,
    movimientos_restantes: 0,
  });
  const wsRef = useRef(null);
  const isOwner = useRef(false); // track si este hook es el "dueño" de la conexión

  useEffect(() => {
    // solo conectamos si hay partida y jugador válido
    if (!partidaId || !jugador || !jugador.id) {
      setJugadores([]);
      return;
    }

    let ws = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // ms
    let shouldReconnect = true; // clave: no reconectar después del cleanup

    const connect = () => {
      if (!shouldReconnect) return;

      // Intentar reutilizar conexión global existente
      const existingWS = globalWSConnections.get(partidaId);
      if (existingWS && 
          (existingWS.readyState === WebSocket.OPEN || 
           existingWS.readyState === WebSocket.CONNECTING)) {
        console.log('[usePartidaWS] Reutilizando WebSocket existente para partida', partidaId);
        ws = existingWS;
        wsRef.current = ws;
        isOwner.current = false; // No somos dueños de esta conexión
        return;
      }

      // Crear nueva conexión
      console.log('[usePartidaWS] Creando nuevo WebSocket para partida', partidaId);
      ws = new WebSocket("ws://localhost:3000/ws");
      wsRef.current = ws;
      globalWSConnections.set(partidaId, ws);
      isOwner.current = true; // Somos dueños de esta conexión

      ws.onopen = () => {
        console.log("Conectado a WS");
        reconnectAttempts = 0;
        try {
          ws.send(
            JSON.stringify({
              type: "JOIN",
              partidaId,
              jugador,
            })
          );
        } catch (e) {
          /* ignore */
        }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.debug("[usePartidaWS] WS message", data);

          // 🔴 Partida destruida desde el backend
          if (data && data.type === "PARTIDA_DELETED") {
            console.debug(
              "[usePartidaWS] PARTIDA_DELETED received"
            );

            if (onPartidaDeleted) {
              onPartidaDeleted(data);
            } else {
              // fallback por si no se pasa callback
              try {
                window.location.replace("/landing");
              } catch (e) {
                /* noop */
              }
            }
            return;
          }

          // partida empezó (seguir usando callback opcional si quieres SPA)
          if (data?.type === "PARTIDA_STARTED") {
            try {
              const mapaId = data.mapaId || data.mapa_id || null;
              if (onPartidaStarted) {
                onPartidaStarted({ partidaId, mapaId, raw: data });
              } else if (mapaId) {
                console.debug(
                  "[usePartidaWS] PARTIDA_STARTED received — redirecting to map",
                  partidaId,
                  mapaId
                );
                window.location.href = `/partida/${partidaId}/mapa/${mapaId}`;
              }
            } catch (e) {}
            return;
          }

          if (data.type === "UPDATE_PLAYERS") {
            const arr = Array.isArray(data.jugadores)
              ? data.jugadores
              : [];

            // 1) normalizamos y quitamos duplicados por id
            const map = {};
            arr.forEach((j) => {
              if (j && j.id !== undefined) {
                map[String(j.id)] = j;
              }
            });
            let unique = Object.values(map);

            // 2) Aseguramos que el jugador actual esté presente mientras
            //    el componente siga montado (defensa ante bugs del backend)
            if (jugador && jugador.id !== undefined) {
              const meId = Number(jugador.id);
              const hasMe = unique.some((j) => Number(j.id) === meId);

              if (!hasMe) {
                console.warn(
                  "[usePartidaWS] UPDATE_PLAYERS sin el jugador actual. Reinyectando localmente.",
                  { meId, unique }
                );

                unique = [
                  ...unique,
                  {
                    id: jugador.id,
                    username: jugador.username,
                    selected_personaje_id: null,
                    selected_personaje: null,
                  },
                ];
              }
            }

            setJugadores(unique);
          }

          if (data.type === "JUGADA_MOVIDA") {
            try {
              // emitir evento con payload para que hooks locales lo manejen sin recargar
              window.dispatchEvent(
                new CustomEvent("jugada_moved", { detail: data })
              );
            } catch (e) {
              /* noop */
            }
          }

          if (data.type === "PARTIDA_TURNO_ACTIVO") {
            try {
              setTurnoActivo({
                personajeId: data.personajeId || data.personaje_id || null,
                movimientos_restantes: data.movimientos_restantes || 0,
              });
            } catch (e) {
              /* noop */
            }
          }

          // opcional: si tu backend manda eventos de “salió un jugador”
          if (data.type === "PLAYER_LEFT") {
            const leftId = data.jugadorId || data.jugador_id;
            if (leftId === undefined) return;

            // si el que "salió" soy yo, dejamos que la navegación
            // saque al usuario del lobby; no lo borramos visualmente aquí
            if (jugador && Number(leftId) === Number(jugador.id)) {
              console.warn(
                "[usePartidaWS] PLAYER_LEFT para el jugador actual, ignorando en frontend"
              );
              return;
            }

            setJugadores((prev) =>
              prev.filter((j) => Number(j.id) !== Number(leftId))
            );
          }

          // COMBAT started: redirect to /partida/:partidaId/combate/:id
          if (data?.type === 'COMBAT_STARTED') {
            try {
              const combate = data.combate || data.combat || null;
              const startAt = data.startAt || (data.combate && data.combate.startAt) || Date.now();
              if (combate && combate.id) {
                const targetPath = `/partida/${partidaId}/combate/${combate.id}`;
                // siempre guardar el payload para que la vista pueda hidratarse tras navegación completa
                try {
                  localStorage.setItem(`combat_${combate.id}`, JSON.stringify(data));
                  console.debug('[WS] stored combat payload for', combate.id);
                } catch (e) { console.debug('[WS] failed to store combat payload', e); }

                // Not using BroadcastChannel anymore. Rely on server WS broadcast
                // and notify in-page listeners via a CustomEvent so components can hydrate.
                try {
                  window.dispatchEvent(new CustomEvent('combat_started_remote', { detail: data }));
                } catch (ee) { /* noop */ }

                // Programar navegación en esta pestaña según startAt para sincronizar inicio
                try {
                  if (window.__nn_combat_nav_timer) {
                    clearTimeout(window.__nn_combat_nav_timer);
                    window.__nn_combat_nav_timer = null;
                  }
                  const delay = Math.max(0, Number(startAt) - Date.now());
                  window.__nn_combat_nav_timer = setTimeout(() => {
                    try {
                      // Emitir evento para navegación SPA
                      window.dispatchEvent(new CustomEvent('navigate_to_combat', { 
                        detail: { path: targetPath, combateId: combate.id, partidaId, data }
                      }));
                      console.debug('[WS] emitted navigate_to_combat event for', targetPath);
                    } catch (e) {
                      console.error('[WS] failed to emit navigate event', e);
                    }
                  }, delay);
                  console.debug('[WS] scheduled navigation to', targetPath, 'in', delay, 'ms');
                } catch (e) { console.debug('[WS] failed to schedule local navigation', e); }
              }
            } catch (e) {
              console.error('Error manejando COMBAT_STARTED', e);
            }
            return;
          }
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      ws.onclose = (ev) => {
        console.debug("[usePartidaWS] WS cerrado", ev && ev.code ? `(code: ${ev.code})` : "", ev && ev.reason ? ev.reason : "");
        if (!shouldReconnect) {
          // nos fuimos del lobby / componente desmontado → no reconectar
          return;
        }

        if (reconnectAttempts < maxRetries) {
          reconnectAttempts += 1;
          const delay = baseDelay * Math.pow(2, reconnectAttempts - 1);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, delay);
        } else {
          console.warn(
            "Max WS reconnect attempts reached for partida",
            partidaId
          );
        }
      };

      ws.onerror = (err) => {
        console.error("WS error:", err);
      };
    };

    connect();

    const cleanup = () => {
      try {
        shouldReconnect = false;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Solo cerrar el WebSocket si somos los "dueños" de la conexión
        // Si otro componente está reutilizando la conexión, no la cerramos
        if (isOwner.current && wsRef.current) {
          console.debug('[usePartidaWS] cleanup: cerrando WebSocket (owner)');
          
          if (wsRef.current.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(
                JSON.stringify({
                  type: "LEAVE",
                  partidaId,
                  jugadorId: jugador.id,
                })
              );
            } catch (e) {
              console.debug("Error enviando LEAVE por WS", e);
            }

            try {
              wsRef.current.close();
            } catch (e) {}
          } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
            try {
              wsRef.current.close();
            } catch (e) {}
          }
          
          // Remover de conexiones globales
          globalWSConnections.delete(partidaId);
        } else {
          console.debug('[usePartidaWS] cleanup: manteniendo WebSocket (not owner)');
        }

        wsRef.current = null;
        isOwner.current = false;
        // no hacemos setJugadores([]) aquí para no "parpadear" la UI
        try {
          if (window.__nn_combat_nav_timer) {
            clearTimeout(window.__nn_combat_nav_timer);
            window.__nn_combat_nav_timer = null;
          }
        } catch (ee) {}
      } catch (e) {
        console.error("Error en cleanup WS", e);
      }
    };

    // cleanup al cambiar partida o desmontar
    return cleanup;
  }, [partidaId, jugador?.id, jugador?.username, onPartidaDeleted, onPartidaStarted]);

  return { jugadores, turnoActivo };
}