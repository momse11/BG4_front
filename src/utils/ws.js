// src/utils/ws.js
import { useEffect, useState, useRef } from "react";

export function usePartidaWS(partidaId, jugador) {
  const [jugadores, setJugadores] = useState([]);
  const [turnoActivo, setTurnoActivo] = useState({ personajeId: null, movimientos_restantes: 0 });
  const wsRef = useRef(null);

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

      // evitar duplicar sockets
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        ws = wsRef.current;
        return;
      }

      ws = new WebSocket("ws://localhost:3000/ws");
      wsRef.current = ws;

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

          if (data && data.type === "PARTIDA_DELETED") {
            console.debug(
              "[usePartidaWS] PARTIDA_DELETED received — redirecting to /landing"
            );
            try {
              window.location.replace("/landing");
            } catch (e) {
              /* noop */
            }
            return;
          }

          if (data?.type === "PARTIDA_STARTED") {
            try {
              const mapaId = data.mapaId || data.mapa_id || null;
              if (mapaId) {
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
            const arr = Array.isArray(data.jugadores) ? data.jugadores : [];

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

          if (data.type === 'JUGADA_MOVIDA') {
            try {
              // emitir evento con payload para que hooks locales lo manejen sin recargar
              window.dispatchEvent(new CustomEvent('jugada_moved', { detail: data }));
            } catch (e) { /* noop */ }
          }

          if (data.type === 'PARTIDA_TURNO_ACTIVO') {
            try {
              setTurnoActivo({ personajeId: data.personajeId || data.personaje_id || null, movimientos_restantes: data.movimientos_restantes || 0 });
            } catch (e) { /* noop */ }
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
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      ws.onclose = (ev) => {
        console.log("WS cerrado", ev && ev.reason ? ev.reason : "");
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
          console.warn("Max WS reconnect attempts reached for partida", partidaId);
        }
      };

      ws.onerror = (err) => {
        console.error("WS error:", err);
      };
    };

    connect();

    const cleanup = () => {
      try {
        shouldReconnect = false; // importante: NO volver a conectar

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          // avisamos al backend que este jugador salió del lobby
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
        } else if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          try {
            wsRef.current.close();
          } catch (e) {}
        }

        wsRef.current = null;
        // OJO: no hacemos setJugadores([]) aquí para no "desaparecer" al usuario
      } catch (e) {
        console.error("Error en cleanup WS", e);
      }
    };

    // cleanup al cambiar partida o desmontar
    return cleanup;
  }, [partidaId, jugador?.id]);

  return { jugadores, turnoActivo };
}