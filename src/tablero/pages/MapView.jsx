import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import api, { deletePartida } from "../../utils/api";
import Inventory from "./Inventory";
import Trading from "./Trading";
import CombatView from "./CombatView";
import GameOverView from "./GameOverView";
import "../../assets/styles/map.css";
import { useNavigate } from "react-router-dom";

const fondos = import.meta.glob("/src/assets/tablero/mapas/*", {
  eager: true,
});

function clean(s) {
  return String(s).toLowerCase().replaceAll(" ", "").replaceAll("_", "");
}

function getFondo(name) {
  const key = clean(name);
  for (const p in fondos) {
    const file = p.split("/").pop().split(".")[0];
    if (clean(file) === key) return fondos[p].default;
  }
  return null;
}

function getObjetoIdFromCasillaEntry(o) {
  if (!o) return null;
  if (typeof o === "number") return o;
  if (o.objetoId != null) return o.objetoId;
  if (o.objeto_id != null) return o.objeto_id;
  if (o.id != null) return o.id;
  if (o.objeto && o.objeto.id != null) return o.objeto.id;
  if (o.item && o.item.id != null) return o.item.id;
  return null;
}

function getObjetosFromCasilla(casilla) {
  if (!casilla) return [];
  const raw =
    casilla.objetos ??
    casilla.objetosAsociados ??
    [];
  return Array.isArray(raw) ? raw : [];
}

function getEnemigosFromCasilla(casilla) {
  if (!casilla) return [];
  const raw =
    casilla.enemigos ??
    casilla.enemigosAsociados ??
    [];
  return Array.isArray(raw) ? raw : [];
}

async function autoLootCasilla({ objetos, personajeId, casilla, onAfterLoot }) {
  if (!Array.isArray(objetos) || objetos.length === 0) return;
  if (!personajeId) return;

  for (const raw of objetos) {
    const objetoId = getObjetoIdFromCasillaEntry(raw);
    if (!objetoId) continue;

    try {
      console.debug(
        "[MapView] autoLoot → agregar objeto",
        objetoId,
        "a personaje",
        personajeId
      );
      await api.put(`/personaje/${personajeId}/objetos/${objetoId}/agregar`);
    } catch (e) {
      console.error(
        "[MapView] Error agregando objeto al personaje",
        personajeId,
        objetoId,
        e?.response?.data || e.message
      );
    }

    try {
      if (casilla && Array.isArray(casilla.objetos)) {
        const idx = casilla.objetos.findIndex(
          (o2) => getObjetoIdFromCasillaEntry(o2) === objetoId
        );
        if (idx !== -1) {
          casilla.objetos.splice(idx, 1);
        }
      }
    } catch (e) {
      console.warn(
        "[MapView] No se pudo quitar el objeto de la casilla en el cliente:",
        e?.message || e
      );
    }
  }

  if (typeof onAfterLoot === "function") {
    try {
      const res = await api.get(`/personaje/${personajeId}`);
      const pj = res.data?.personaje || res.data || null;
      onAfterLoot(pj);
    } catch (e) {
      console.error(
        "[MapView] Error refrescando personaje después de loot:",
        e?.response?.data || e.message
      );
    }
  }
}

export default function MapView({ partidaId, mapaId, personajesIds }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [combateActivo, setCombateActivo] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [myPersonajeLive, setMyPersonajeLive] = useState(null);

  const jugadorParam = useMemo(
    () => (user ? { id: user.id, username: user.username } : null),
    [user?.id, user?.username]
  );
  const { jugadores, turnoActivo } = usePartidaWS(partidaId, jugadorParam);

  const { loading, mapa, casillas, pos, order, jugadas, moveTo } = useMapLogic(
    { mapaId, personajesIds, partidaId }
  );

  const activePersonajeIdStr =
    turnoActivo?.personajeId != null ? String(turnoActivo.personajeId) : null;

  const sortedOrder = [...(order || [])].sort(
    (a, b) => (a.turno ?? 0) - (b.turno ?? 0)
  );

  const mySlot = user
    ? (jugadores || []).find((j) => Number(j.id) === Number(user.id))
    : null;

  const mySelectedPersonajeId = mySlot
    ? mySlot.selected_personaje_id || mySlot.selected_personaje?.id || null
    : null;

  let mySelectedPersonajeNumericId = mySelectedPersonajeId;

  if (mySlot) {
    if (
      mySlot.selected_personaje_id &&
      /^\d+$/.test(String(mySlot.selected_personaje_id))
    ) {
      mySelectedPersonajeNumericId = Number(mySlot.selected_personaje_id);
    } else if (
      mySlot.selected_personaje &&
      /^\d+$/.test(String(mySlot.selected_personaje.id))
    ) {
      mySelectedPersonajeNumericId = Number(mySlot.selected_personaje.id);
    }
  }

  if (!/^\d+$/.test(String(mySelectedPersonajeNumericId))) {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[_\s]+/g, "")
        .trim();
    const found = sortedOrder.find(
      (o) =>
        norm(o.actor?.nombre) === norm(mySelectedPersonajeNumericId) ||
        norm(String(o.actor?.id || "")) === norm(mySelectedPersonajeNumericId)
    );
    if (found) mySelectedPersonajeNumericId = found.actor.id;
  }

  const [showInventory, setShowInventory] = useState(false);

  const [showTrading, setShowTrading] = useState(false);

  const [interactionMessage, setInteractionMessage] = useState(null);

  const lootedTilesRef = useRef(new Set());
  const combatTilesRef = useRef(new Set());

  // ====== MAPEO AUXILIAR (nombre → sprite, jugador, etc) ======
  const spriteById = new Map();
  const jugadoresByNombre = {};
  const jugadorById = new Map();
  const jugadorByPersonajeId = {};

  for (const j of jugadores || []) {
    try {
      jugadorById.set(String(j.id), j);
      const sel = j.selected_personaje || null;
      if (sel && sel.nombre) {
        jugadoresByNombre[String(sel.nombre).toLowerCase()] = sel;
      }

      const pjId = j.selected_personaje_id || (sel && sel.id);
      if (pjId != null) {
        jugadorByPersonajeId[String(pjId)] = j;
      }
    } catch (e) {}
  }

  useEffect(() => {
    const handleShowCombat = (event) => {
      const { combateId, combate, actores, orden, turnoActual, hpActual } =
        event.detail || {};
      if (combateId && combate) {
        console.log(
          "[MapView] Recibido evento show_combat_overlay:",
          combateId
        );
        const combatePayload = {
          ...combate,
          orden: orden || combate.ordenIniciativa || [],
          turnoActual,
          hpActual: hpActual || {},
        };
        setCombateActivo({
          combateId,
          combate: combatePayload,
          actores: actores || [],
        });
      }
    };

    window.addEventListener("show_combat_overlay", handleShowCombat);
    return () => window.removeEventListener("show_combat_overlay", handleShowCombat);
  }, []);

  useEffect(() => {
    const handleGameOver = (event) => {
      const data = event.detail;

      if (
        data.type === "GAME_OVER" &&
        String(data.partidaId) === String(partidaId)
      ) {
        console.log("[MapView] GAME_OVER recibido:", data);

        setCombateActivo(null);

        setGameOver({
          partidaNombre: data.partidaNombre || "Partida",
          mensaje: data.mensaje || "Todos los aliados han caído",
        });
      }
    };

    window.addEventListener("combat_message", handleGameOver);
    return () => window.removeEventListener("combat_message", handleGameOver);
  }, [partidaId]);

  useEffect(() => {
    const handler = async (event) => {
      const data = event.detail || {};
      console.debug('[MapView] transport_party event received:', data);
      const evtPartidaId = data.partidaId || data.partida_id || data.partida || null;
      if (evtPartidaId == null || String(evtPartidaId) !== String(partidaId)) return;

      const tileIncrement = Number(data.tileIncrement ?? 1);

      try {
        const currentCasilla = casillas.find(
          (c) => Number(c.x) === Number(pos.x) && Number(c.y) === Number(pos.y)
        );
        if (!currentCasilla) {
          console.warn('[MapView] transport_party: no se encontró casilla actual');
          return;
        }
        const currentId = Number(currentCasilla.id);
        const targetId = currentId + tileIncrement;
        const target = casillas.find((c) => Number(c.id) === Number(targetId));
        if (!target) {
          console.warn('[MapView] transport_party: casilla destino no encontrada', targetId);
          return;
        }

        console.log('[MapView] transport_party: moviendo party a casilla', targetId, target.x, target.y, 'jugadasCount:', (jugadas || []).length);

        for (const j of jugadas || []) {
          try {
            if (j.jugador_id == null) continue;
            console.debug('[MapView] transport_party: moving jugador', j.jugador_id, '→', target.x, target.y);
            try {
              const res = await moveTo(j.jugador_id, target.x, target.y);
              console.debug('[MapView] transport_party: moveTo result for', j.jugador_id, res);
            } catch (moveErr) {
              console.warn('[MapView] transport_party: moveTo failed for', j.jugador_id, moveErr?.response?.data || moveErr.message || moveErr);
              try {
                const moved = [{ personaje_id: j.jugador_id, x: target.x, y: target.y }];
                window.dispatchEvent(new CustomEvent('jugada_moved', { detail: { moved_personajes: moved } }));
                console.debug('[MapView] transport_party: dispatched jugada_moved fallback for', j.jugador_id);
              } catch (e) {
                console.error('[MapView] transport_party: failed to dispatch jugada_moved fallback', e);
              }
            }
          } catch (e) {
            console.warn('[MapView] transport_party: error moviendo jugador', j.jugador_id, e?.response?.data || e.message || e);
          }
        }
      } catch (e) {
        console.error('[MapView] transport_party handler error', e);
      }
    };

    window.addEventListener('transport_party', handler);
    return () => window.removeEventListener('transport_party', handler);
  }, [casillas, pos, jugadas, partidaId, moveTo]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "i" || event.key === "I") {
        if (!mySelectedPersonajeNumericId) return;
        setShowInventory((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mySelectedPersonajeNumericId]);

  useEffect(() => {
    const findOwnerByPersonajeId = (pjId) => {
      if (pjId == null) return null;
      const target = String(pjId);

      return (
        (jugadores || []).find((j) => {
          const sel = j.selected_personaje || null;
          const ids = [j.selected_personaje_id, sel?.id]
            .filter((x) => x != null)
            .map((x) => String(x));
          return ids.includes(target);
        }) || null
      );
    };

    const handler = async (event) => {
      const data = event.detail || {};
      console.debug("[MapView] jugada_moved recibido:", data);

      const evtPartidaId =
        data.partidaId || data.partida_id || data.partida || null;
      if (
        evtPartidaId != null &&
        String(evtPartidaId) !== String(partidaId)
      ) {
        return;
      }

      const payload = data.jugada || data;

      const destX =
        payload.x ??
        payload.destX ??
        payload.nueva_x ??
        payload.pos_x ??
        null;
      const destY =
        payload.y ??
        payload.destY ??
        payload.nueva_y ??
        payload.pos_y ??
        null;

      const personajeIdFromPayload =
        payload.personajeId ??
        payload.personaje_id ??
        payload.actor_id ??
        null;

      const jugadorId =
        payload.jugadorId ??
        payload.jugador_id ??
        payload.usuarioId ??
        payload.usuario_id ??
        null;

      if (destX == null || destY == null) {
        console.debug("[MapView] jugada_moved sin coordenadas destino");
        return;
      }

      const casilla = casillas.find(
        (c) => Number(c.x) === Number(destX) && Number(c.y) === Number(destY)
      );
      if (!casilla) {
        console.debug(
          "[MapView] jugada_moved: casilla no encontrada para destino",
          destX,
          destY
        );
        setInteractionMessage(null);
        return;
      }

      const objetosInCasilla = getObjetosFromCasilla(casilla);
      const enemigosInCasilla = getEnemigosFromCasilla(casilla);

      const getNombreEnemigo = (e) => {
        if (!e) return "";
        if (typeof e === "string") return e;
        if (e.nombre) return e.nombre;
        if (e.enemigo && e.enemigo.nombre) return e.enemigo.nombre;
        if (e.enemy && e.enemy.nombre) return e.enemy.nombre;
        return "";
      };

      const getNombreObjeto = (o) => {
        if (!o) return "";
        if (typeof o === "string") return o;
        if (o.nombre) return o.nombre;
        if (o.objeto && o.objeto.nombre) return o.objeto.nombre;
        if (o.item && o.item.nombre) return o.item.nombre;
        return "";
      };

      const movingPersonajeId =
        turnoActivo?.personajeId != null
          ? turnoActivo.personajeId
          : personajeIdFromPayload;

      let owner = null;

      if (movingPersonajeId != null) {
        owner = findOwnerByPersonajeId(movingPersonajeId);
      }

      if (!owner && jugadorId != null) {
        owner =
          (jugadores || []).find(
            (j) => Number(j.id) === Number(jugadorId)
          ) || null;
      }

      const actorSlot =
        movingPersonajeId != null
          ? sortedOrder.find(
              (o) => String(o.actor?.id) === String(movingPersonajeId)
            )
          : null;

      const actorPersonajeName = actorSlot?.actor?.nombre || null;

      const actorName =
        actorPersonajeName ||
        owner?.username ||
        (movingPersonajeId != null
          ? `Personaje ${movingPersonajeId}`
          : "Un aventurero");

      const tileKey = `${partidaId}:${casilla.x},${casilla.y}`;

      const isMyMove =
        !!user &&
        (
          (owner && String(owner.id) === String(user.id)) ||
          (
            mySelectedPersonajeNumericId != null &&
            movingPersonajeId != null &&
            String(movingPersonajeId) === String(mySelectedPersonajeNumericId)
          )
        );

      console.debug(
        "[MapView] jugada_moved: casilla=",
        tileKey,
        "objetos=",
        objetosInCasilla.length,
        "enemigos=",
        enemigosInCasilla.length,
        "movingPersonajeId=",
        movingPersonajeId,
        "isMyMove=",
        isMyMove
      );

      if (
        objetosInCasilla.length > 0 &&
        isMyMove &&
        movingPersonajeId != null
      ) {
        autoLootCasilla({
          objetos: objetosInCasilla,
          personajeId: movingPersonajeId,
          casilla,
          onAfterLoot: (pj) => {
            if (!pj) return;
            setMyPersonajeLive(pj);
          },
        }).catch((e) =>
          console.error("[MapView] Error auto-looteando casilla", e)
        );
      }

      let msg = null;

      if (
        enemigosInCasilla.length > 0 &&
        !combatTilesRef.current.has(tileKey)
      ) {
        const nombresEnemigos = enemigosInCasilla
          .map(getNombreEnemigo)
          .filter(Boolean)
          .join(", ");

        if (nombresEnemigos) {
          combatTilesRef.current.add(tileKey);
          msg = `${actorName} ha detonado un combate con ${nombresEnemigos}.`;
        }
      }
      else if (
        objetosInCasilla.length > 0 &&
        !lootedTilesRef.current.has(tileKey)
      ) {
        const nombresObjetos = objetosInCasilla
          .map(getNombreObjeto)
          .filter(Boolean)
          .join(", ");

        if (nombresObjetos) {
          lootedTilesRef.current.add(tileKey);
          msg = `${actorName} ha encontrado ${nombresObjetos}.`;
        }
      }

      if (msg) {
        console.debug("[MapView] interactionMessage:", msg);
        setInteractionMessage(msg);
      } else {
        setInteractionMessage(null);
      }
    };

    window.addEventListener("jugada_moved", handler);
    return () => window.removeEventListener("jugada_moved", handler);
    }, [
    casillas,
    jugadores,
    partidaId,
    turnoActivo,
    user,
    mySelectedPersonajeNumericId,
  ]);

  // Manejar avance de mapa (MAP_ADVANCED) → mover party a casilla de descanso y navegar si hace falta
  useEffect(() => {
    const handler = async (event) => {
      const data = event.detail || {};
      const evtPartidaId = data.partidaId || data.partida_id || data.partida || null;
      if (evtPartidaId == null || String(evtPartidaId) !== String(partidaId)) return;

      const rest = data.restCasilla || data.rest_casilla || null;
      if (rest && rest.x != null && rest.y != null) {
        console.debug('[MapView] MAP_ADVANCED received — moving party to rest casilla', rest);
        for (const j of jugadas || []) {
          try {
            if (j.jugador_id == null) continue;
            await moveTo(j.jugador_id, rest.x, rest.y);
          } catch (moveErr) {
            console.warn('[MapView] MAP_ADVANCED moveTo failed for', j.jugador_id, moveErr?.response?.data || moveErr.message || moveErr);
            try {
              const moved = [{ personaje_id: j.jugador_id, x: rest.x, y: rest.y }];
              window.dispatchEvent(new CustomEvent('jugada_moved', { detail: { partidaId, jugada: { x: rest.x, y: rest.y }, moved_personajes: moved } }));
            } catch (e) {
              console.error('[MapView] MAP_ADVANCED fallback emit failed', e);
            }
          }
        }
      }
    };

    window.addEventListener('map_advanced', handler);

    try {
      const stored = localStorage.getItem(`map_advanced_${partidaId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        window.dispatchEvent(new CustomEvent('map_advanced', { detail: parsed }));
        try { localStorage.removeItem(`map_advanced_${partidaId}`); } catch (e) {}
      }
    } catch (e) {
      console.debug('[MapView] no map_advanced payload in localStorage', e);
    }

    return () => window.removeEventListener('map_advanced', handler);
  }, [jugadas, partidaId, moveTo]);

  if (loading) return <div className="map-status-text">Cargando...</div>;
  if (!mapa) return <div className="map-status-text">Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);

  const spritesOtros = [];
  const spritesActivos = [];
  for (const o of sortedOrder) {
    const spr = o.actor.sprite;
    if (!spr) continue;
    if (activePersonajeIdStr && String(o.actor.id) === activePersonajeIdStr) {
      spritesActivos.push(spr);
    } else {
      spritesOtros.push(spr);
    }
  }
  const partySprites = [...spritesOtros, ...spritesActivos];

  for (const o of sortedOrder) {
    if (!o || !o.actor || o.actor.id == null) continue;
    let spr = o.actor.sprite || null;
    if (!spr && o.actor.nombre) {
      const found =
        jugadoresByNombre[String(o.actor.nombre).toLowerCase()];
      if (found && found.sprite) spr = found.sprite;
    }
    try {
      console.debug(
        "[MapView] asignando sprite para actor",
        o.actor.nombre,
        "->",
        spr
      );
    } catch (e) {}
    if (spr) spriteById.set(String(o.actor.id), spr);
  }

  const partySpritesMap = {};
  const tempSpritesMap = {};

  for (const j of jugadas || []) {
    try {
      const key = `${j.x},${j.y}`;
      const spr = spriteById.get(String(j.jugador_id)) || null;
      if (!spr) continue;
      if (!tempSpritesMap[key]) {
        tempSpritesMap[key] = { normal: [], active: [] };
      }
      const isActiveHere =
        activePersonajeIdStr &&
        String(j.jugador_id) === String(activePersonajeIdStr);
      if (isActiveHere) {
        tempSpritesMap[key].active.push(spr);
      } else {
        tempSpritesMap[key].normal.push(spr);
      }
    } catch (e) {}
  }

  for (const key in tempSpritesMap) {
    partySpritesMap[key] = [
      ...tempSpritesMap[key].normal,
      ...tempSpritesMap[key].active,
    ];
  }

  if (
    Object.keys(partySpritesMap).length === 0 &&
    Array.isArray(jugadores) &&
    jugadores.length > 0
  ) {
    try {
      const start =
        casillas.find(
          (c) => String(c.tipo).toLowerCase() === "descanso"
        ) || casillas[0];
      if (start) {
        const key = `${start.x},${start.y}`;
        const baseSprites = [];
        const activeSpritesFallback = [];

        for (const jw of jugadores) {
          try {
            const sel = jw.selected_personaje || null;
            let spr = null;
            if (sel && sel.sprite) spr = sel.sprite;
            else if (sel && sel.nombre) {
              const cleanName = String(sel.nombre)
                .toLowerCase()
                .replace(/[_\s]+/g, "");
              for (const [, v] of spriteById) {
                if (String(v).toLowerCase().includes(cleanName)) {
                  spr = v;
                  break;
                }
              }
            }

            if (spr) {
              const pjIdSel = jw.selected_personaje_id || (sel && sel.id);
              const isActiveHere =
                activePersonajeIdStr &&
                pjIdSel != null &&
                String(pjIdSel) === activePersonajeIdStr;
              if (isActiveHere) activeSpritesFallback.push(spr);
              else baseSprites.push(spr);
            }
          } catch (e) {}
        }

        if (baseSprites.length || activeSpritesFallback.length) {
          partySpritesMap[key] = [...baseSprites, ...activeSpritesFallback];
        }
      }
    } catch (e) {}
  }

  console.debug(
    "[MapView] mySlot:",
    mySlot,
    "mySelectedPersonajeId:",
    mySelectedPersonajeId,
    "mySelectedPersonajeNumericId:",
    mySelectedPersonajeNumericId,
    "turnoActivo:",
    turnoActivo
  );

  const myJugada = (jugadas || []).find(
    (j) => String(j.jugador_id) === String(mySelectedPersonajeNumericId)
  );

  try {
    console.debug(
      "[MapView] mySelectedPersonajeId:",
      mySelectedPersonajeId,
      "mySelectedPersonajeNumericId:",
      mySelectedPersonajeNumericId,
      "myJugada:",
      myJugada
    );
  } catch (e) {}

  // determinar si es el turno del jugador actual comparando múltiples posibles IDs
  let myTurnActive = false;
  if (turnoActivo) {
    const candidatoIds = new Set();
    if (mySelectedPersonajeNumericId != null)
      candidatoIds.add(String(mySelectedPersonajeNumericId));
    if (mySlot) {
      if (mySlot.selected_personaje_id != null)
        candidatoIds.add(String(mySlot.selected_personaje_id));
      if (
        mySlot.selected_personaje &&
        mySlot.selected_personaje.id != null
      )
        candidatoIds.add(String(mySlot.selected_personaje.id));
      const selNombre =
        mySlot.selected_personaje && mySlot.selected_personaje.nombre;
      if (selNombre) {
        const found = sortedOrder.find(
          (o) =>
            String(o.actor?.nombre).toLowerCase() ===
            String(selNombre).toLowerCase()
        );
        if (found && found.actor && found.actor.id != null) {
          candidatoIds.add(String(found.actor.id));
        }
      }
    }
    const ownedActor = sortedOrder.find(
      (o) => String(o.actor?.usuarioId) === String(user?.id)
    );
    if (ownedActor && ownedActor.actor && ownedActor.actor.id != null) {
      candidatoIds.add(String(ownedActor.actor.id));
    }

    const turnoId =
      turnoActivo.personajeId != null
        ? String(turnoActivo.personajeId)
        : null;
    if (turnoId && candidatoIds.has(turnoId)) myTurnActive = true;
  }

  const movimientosRestantes = turnoActivo?.movimientos_restantes ?? 0;
  const canMove =
    !!mySelectedPersonajeNumericId && myTurnActive && movimientosRestantes > 0;

  // 🔍 Casilla actual de MI personaje
  const myCurrentCasilla =
    myJugada &&
    casillas.find(
      (c) =>
        Number(c.x) === Number(myJugada.x) &&
        Number(c.y) === Number(myJugada.y)
    );

  const tipoMyCasilla = String(myCurrentCasilla?.tipo || "").toLowerCase();
  const canRestHere = tipoMyCasilla === "descanso";
  const canTradeHere = tipoMyCasilla === "acceso";

  const currentCityEntry = myCurrentCasilla?.ciudades?.[0] || null;
  const currentMerchantEntry =
    currentCityEntry?.mercaderes?.[0] || null;

  const ciudadNombre = currentCityEntry?.ciudad?.nombre || null;

  const mercader = currentMerchantEntry?.mercader || null;

  const mercaderInventario =
    currentMerchantEntry?.inventario || [];

  const allowedTiles = new Set();
  let effectiveJugada = myJugada;
  if (!effectiveJugada && turnoActivo && turnoActivo.personajeId != null) {
    effectiveJugada = (jugadas || []).find(
      (j) => String(j.jugador_id) === String(turnoActivo.personajeId)
    );
  }
  if (!effectiveJugada) {
    effectiveJugada = { x: pos.x, y: pos.y };
  }

  if (canMove && effectiveJugada) {
    const curX = Number(effectiveJugada.x);
    const curY = Number(effectiveJugada.y);

    const candidatos = [
      { x: curX + 1, y: curY },
      { x: curX - 1, y: curY },
      { x: curX, y: curY + 1 },
      { x: curX, y: curY - 1 },
    ];

    for (const dest of candidatos) {
      const casillaExists = casillas.find(
        (ca) => Number(ca.x) === dest.x && Number(ca.y) === dest.y
      );
      if (!casillaExists) continue;

      const tipo = String(casillaExists.tipo || "").toLowerCase();
      if (tipo.includes("inacces")) continue;

      allowedTiles.add(`${casillaExists.x},${casillaExists.y}`);
    }
  }

  const handleTileClick = async (c) => {
    try {
      const key = `${c.x},${c.y}`;
      if (!canMove || !allowedTiles.has(key)) return;

      if (!mySelectedPersonajeNumericId) {
        alert("No tienes personaje seleccionado en esta partida");
        return;
      }

      const casillaExists = casillas.find(
        (ca) =>
          Number(ca.x) === Number(c.x) &&
          Number(ca.y) === Number(c.y)
      );
      if (!casillaExists) {
        console.warn(
          "[MapView] Bloqueando solicitud local: casilla destino no pertenece al mapa",
          { destino: c, mapaId: mapa?.id }
        );
        alert(
          "La casilla destino no pertenece a este mapa (verifica coordenadas)"
        );
        return;
      }

      try {
        const tipo = String(casillaExists.tipo || "").toLowerCase();
        if (tipo.includes("inacces")) {
          alert("No puedes moverte: la casilla es Inaccesible");
          return;
        }
      } catch (e) {}

      const sendJugadorId =
        myJugada?.jugador_id ??
        (turnoActivo?.personajeId ?? mySelectedPersonajeNumericId);
      try {
        console.debug(
          "[MapView] Enviando movimiento con jugadorId:",
          sendJugadorId,
          "miSelectedNumeric:",
          mySelectedPersonajeNumericId,
          "myJugada:",
          myJugada,
          "turnoActivo:",
          turnoActivo
        );
      } catch (e) {}

      let r;
      try {
        r = await moveTo(sendJugadorId, c.x, c.y);
      } catch (err) {
        if (err?.response?.status === 403) {
          console.warn("[MapView] Movimiento rechazado por servidor (403).", {
            sendJugadorId,
            turnoActivo,
            myJugada,
            mySlot,
          });
          alert(
            err?.response?.data?.error ||
              "No es tu turno para moverte (403)"
          );
        }
        throw err;
      }

      if (r && r.combate) {
        const combatePayload = r.combate;
        const combateObj =
          combatePayload && combatePayload.combate
            ? combatePayload.combate
            : combatePayload;
        const actoresMap =
          r.actores || (combatePayload && combatePayload.actores) || [];

        if (combateObj && combateObj.id) {
          const rawOrden =
            (combatePayload &&
              (combatePayload.orden ||
                combatePayload.ordenIniciativa)) ||
            [];
          const normalizedOrden = (() => {
            if (!Array.isArray(rawOrden)) return [];
            const seen = new Set();
            const out = [];
            for (const it of rawOrden) {
              try {
                if (!it) continue;
                const tipo = String(it.tipo || "").toUpperCase();
                const idStr = String(
                  it.entidadId ?? it.actorId ?? it.id ?? ""
                ).trim();
                if (!idStr) continue;
                const key = `${tipo}:${idStr}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({
                  tipo,
                  entidadId: Number.isFinite(Number(idStr))
                    ? Number(idStr)
                    : idStr,
                  iniciativa: it.iniciativa ?? null,
                  detalle: it.detalle ?? null,
                  nombre: it.nombre ?? it.name ?? null,
                });
              } catch (e) {}
            }
            return out;
          })();

          const payloadWithOrden = {
            ...(combatePayload || {}),
            orden: normalizedOrden,
          };

          setCombateActivo({
            combateId: combateObj.id,
            combate: payloadWithOrden,
            actores: actoresMap,
          });
          return;
        }
      }
    } catch (e) {
      console.error("Error moviendo a casilla", e);
      alert(e?.response?.data?.error || "Error moviendo personaje");
    }
  };

  // 🔁 Datos del personaje activo (turno actual)
  const activeSlot =
    activePersonajeIdStr &&
    sortedOrder.find((o) => String(o.actor?.id) === activePersonajeIdStr);

  let activeOwner = null;
  if (activePersonajeIdStr) {
    if (activeSlot?.actor?.usuarioId != null) {
      activeOwner =
        jugadorById.get(String(activeSlot.actor.usuarioId)) || null;
    } else if (activeSlot?.actor?.id != null) {
      activeOwner =
        jugadorByPersonajeId[String(activeSlot.actor.id)] || null;
    }
  }
  const activeActor = activeSlot?.actor || null;

  const nombreJugadorTurno = turnoActivo
    ? activeOwner?.username ||
      (turnoActivo.personajeId
        ? `Personaje ${turnoActivo.personajeId}`
        : "—")
    : "—";
  const textoTurno = turnoActivo
    ? `Es el turno de ${nombreJugadorTurno}, le quedan ${movimientosRestantes} movimientos...`
    : "Esperando próximo turno...";

  // 🧍 Personaje del usuario actual (con refresco en vivo)
  const fallbackPersonaje =
    (mySlot && mySlot.selected_personaje) ||
    sortedOrder.find(
      (o) =>
        String(o.actor?.id) ===
        String(mySelectedPersonajeNumericId)
    )?.actor ||
    null;

  const myPersonaje = myPersonajeLive || fallbackPersonaje;

  // ============= TEAM MEMBERS PARA INVENTORY =============
  const teamMembers = [];
  const normName = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[_\s]+/g, "")
      .trim();

  if (Array.isArray(jugadores)) {
    for (const j of jugadores) {
      const sel = j.selected_personaje || null;

      let pjNumericId = null;

      if (
        j.selected_personaje_id &&
        /^\d+$/.test(String(j.selected_personaje_id))
      ) {
        pjNumericId = Number(j.selected_personaje_id);
      } else if (sel && sel.id && /^\d+$/.test(String(sel.id))) {
        pjNumericId = Number(sel.id);
      } else if (sel && sel.nombre) {
        const found = sortedOrder.find(
          (o) => normName(o.actor?.nombre) === normName(sel.nombre)
        );
        if (found && found.actor?.id && /^\d+$/.test(String(found.actor.id))) {
          pjNumericId = Number(found.actor.id);
        }
      }

      if (!pjNumericId) continue;

      let nombre = sel?.nombre;
      if (!nombre) {
        const foundById = sortedOrder.find(
          (o) => String(o.actor?.id) === String(pjNumericId)
        );
        nombre = foundById?.actor?.nombre || `PJ #${pjNumericId}`;
      }

      if (!teamMembers.some((m) => String(m.id) === String(pjNumericId))) {
        teamMembers.push({ id: pjNumericId, nombre });
      }
    }
  }

  const handleAbandonar = async () => {
    const ok = window.confirm(
      "Si abandonas, la partida se perderá para todos los jugadores.\n\n¿Seguro que quieres salir?"
    );
    if (!ok) return;
    try {
      if (partidaId) {
        await deletePartida(partidaId);
      }
    } catch (e) {
      console.error("Error eliminando partida", e);
    } finally {
      try {
        navigate("/landing");
      } catch (e) {
        window.location.replace("/landing");
      }
    }
  };

  // === Handlers de los botones ===
  const handleDescansarClick = async () => {
    if (!canRestHere) return;
    if (!mySelectedPersonajeNumericId) {
      alert("No tienes un personaje seleccionado para descansar.");
      return;
    }

    try {
      // Llamada al endpoint REST: POST /personaje/:id/descansar
      const res = await api.post(`/personaje/${mySelectedPersonajeNumericId}/descansar`);

      // Respuesta esperada: { personaje: { ... } } o directamente personaje
      const personajeActualizado = res.data?.personaje || res.data;
      if (personajeActualizado) {
        setMyPersonajeLive(personajeActualizado);
        setInteractionMessage("Has descansado. Suministros consumidos y atributos regenerados.");
        // Opcional: limpiar el mensaje después de unos segundos
        setTimeout(() => setInteractionMessage(null), 4000);
      } else {
        setInteractionMessage("Descanso completado.");
        setTimeout(() => setInteractionMessage(null), 3000);
      }
    } catch (err) {
      console.error("[MapView] Error en descansar:", err?.response?.data || err.message || err);
      const msg = err?.response?.data?.error || err?.message || "Error al intentar descansar";
      alert(msg);
    }
  };

  const handleInventoryButtonClick = () => {
    if (!mySelectedPersonajeNumericId) return;
    setShowInventory(true);
  };

  const handleComerciarClick = () => {
    if (!canTradeHere) return;
    setShowTrading(true);
  };

  return (
    <div className="map-root">
      {/* HEADER de retratos */}
      <div className="map-header">
        {sortedOrder.map((slot, i) => {
          const pjId = slot.actor?.id;

          let owner = null;

          if (slot.actor?.usuarioId != null) {
            owner = jugadorById.get(String(slot.actor.usuarioId)) || null;
          }
          if (!owner && pjId != null) {
            owner = jugadorByPersonajeId[String(pjId)] || null;
          }

          const username = owner?.username || "—";

          const isActive =
            activePersonajeIdStr &&
            String(pjId) === String(activePersonajeIdStr);

          return (
            <div key={i} className="map-slot">
              <div
                className={
                  "map-slot-username" +
                  (isActive ? " map-slot-username--active" : "")
                }
              >
                {username}
              </div>

              <div className="map-slot-frame-wrapper">
                {slot.actor.portrait && (
                  <img
                    src={slot.actor.portrait}
                    alt={slot.actor.nombre}
                    className="map-slot-portrait"
                  />
                )}
                <img src={marco} alt="Marco" className="map-slot-frame" />
              </div>
            </div>
          );
        })}
      </div>

      {/* MAPA + GRID */}
      <div className="map-main">
        {fondoMapa && <img src={fondoMapa} className="map-background" />}

        <Grid
          casillas={casillas}
          pos={pos}
          onTileClick={handleTileClick}
          partySprites={partySprites}
          partySpritesMap={partySpritesMap}
          canMove={canMove}
          allowedTiles={allowedTiles}
        />

        {/* Mensaje amarillo de interacción */}
        {interactionMessage && (
          <div className="map-interaction-banner">{interactionMessage}</div>
        )}

        <div className="map-turn-banner">{textoTurno}</div>
      </div>

      {/* Nombre del mapa */}
      <div className="map-name">{mapa.nombre}</div>

      {/* Botones */}
      <div className="map-actions">
        <button
          className="map-abandon-button map-action-button"
          onClick={handleDescansarClick}
          disabled={!canRestHere}
        >
          Descansar
        </button>
        <button
          className="map-abandon-button map-action-button"
          onClick={handleInventoryButtonClick}
        >
          Inventario
        </button>
        <button
          className="map-abandon-button map-action-button"
          onClick={handleComerciarClick}
          disabled={!canTradeHere}
        >
          Comerciar
        </button>
        <button
          className="map-abandon-button map-action-button"
          onClick={handleAbandonar}
        >
          Abandonar
        </button>
      </div>

      <Inventory
        personaje={myPersonaje}
        personajeId={mySelectedPersonajeNumericId}
        mapaNombre={mapa.nombre}
        items={myPersonaje?.inventario || []}
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
        teamMembers={teamMembers}
      />

      <Trading
        personaje={myPersonaje}
        personajeId={mySelectedPersonajeNumericId}
        items={myPersonaje?.inventario || []}
        ciudadNombre={ciudadNombre}
        mercader={mercader}
        mercaderInventario={mercaderInventario}
        isOpen={showTrading}
        onClose={() => setShowTrading(false)}
      />

      {/* Overlay de combate */}
      {combateActivo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            zIndex: 9999,
            overflow: "auto",
          }}
        >
          <CombatView
            partidaId={partidaId}
            combateId={combateActivo.combateId}
            initialCombate={combateActivo.combate}
            initialActores={combateActivo.actores}
            jugadores={jugadores}
            onClose={() => setCombateActivo(null)}
          />
        </div>
      )}

      {/* 💀 Pantalla de GAME OVER */}
      {gameOver && (
        <GameOverView
          partidaNombre={gameOver.partidaNombre}
          onContinue={() => {
            setGameOver(null);
            navigate("/");
          }}
        />
      )}
    </div>
  );
}