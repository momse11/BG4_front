import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo, useState, useEffect } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import api, { deletePartida } from "../../utils/api";
import Inventory from "./Inventory";
import CombatView from "./CombatView";
import "../../assets/styles/map.css";
import { useNavigate } from 'react-router-dom';

const fondos = import.meta.glob("/src/assets/tablero/mapas/*", { eager: true });

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

export default function MapView({ partidaId, mapaId, personajesIds }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [combateActivo, setCombateActivo] = useState(null); // { combateId, combate, actores }

  const jugadorParam = useMemo(
    () => (user ? { id: user.id, username: user.username } : null),
    [user?.id, user?.username]
  );
  const { jugadores, turnoActivo } = usePartidaWS(partidaId, jugadorParam);

  const { loading, mapa, casillas, pos, order, jugadas, moveTo } =
    useMapLogic({ mapaId, personajesIds, partidaId });

  const activePersonajeIdStr =
    turnoActivo?.personajeId != null ? String(turnoActivo.personajeId) : null;

  const sortedOrder = [...(order || [])].sort(
    (a, b) => (a.turno ?? 0) - (b.turno ?? 0)
  );

  // 👤 Slot del usuario actual
  const mySlot = user
    ? (jugadores || []).find((j) => Number(j.id) === Number(user.id))
    : null;

  const mySelectedPersonajeId = mySlot
    ? mySlot.selected_personaje?.id || mySlot.selected_personaje_id || null
    : null;

  // 🔢 ID numérico que usaremos para GET /personaje/:id
  let mySelectedPersonajeNumericId = mySelectedPersonajeId;

  if (mySlot) {
    if (
      mySlot.selected_personaje_db_id &&
      /^\d+$/.test(String(mySlot.selected_personaje_db_id))
    ) {
      mySelectedPersonajeNumericId = Number(mySlot.selected_personaje_db_id);
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

  // 🔐 Inventario solo para el dueño del personaje (tecla I)
  const [showInventory, setShowInventory] = useState(false);

  // Escuchar evento de WebSocket para mostrar combate como overlay
  useEffect(() => {
    const handleShowCombat = (event) => {
      const { combateId, combate, actores, orden, turnoActual, hpActual } = event.detail || {};
      if (combateId && combate) {
        console.log('[MapView] Recibido evento show_combat_overlay:', combateId);
        const combatePayload = {
          ...combate,
          orden: orden || combate.ordenIniciativa || [],
          turnoActual,
          hpActual: hpActual || {}
        };
        setCombateActivo({
          combateId,
          combate: combatePayload,
          actores: actores || []
        });
      }
    };
    
    window.addEventListener('show_combat_overlay', handleShowCombat);
    return () => window.removeEventListener('show_combat_overlay', handleShowCombat);
  }, []);

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

  if (loading) return <div className="map-status-text">Cargando...</div>;
  if (!mapa) return <div className="map-status-text">Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);

  // ====== MAPEO JUGADOR ↔ PERSONAJE ======

  const spriteById = new Map();
  const jugadoresByNombre = {};
  const jugadorByPersonajeId = {};
  const jugadorById = new Map();

  for (const j of jugadores || []) {
    try {
      jugadorById.set(String(j.id), j);
      const sel = j.selected_personaje || null;
      if (sel && sel.nombre) {
        jugadoresByNombre[String(sel.nombre).toLowerCase()] = sel;
      }
      const pjId =
        (sel && sel.id) || j.selected_personaje_id || j.selected_personaje_db_id;
      if (pjId != null) {
        jugadorByPersonajeId[String(pjId)] = j;
      }
    } catch (e) {}
  }

  // Sprites del party
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
      const found = jugadoresByNombre[String(o.actor.nombre).toLowerCase()];
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

  // Fallback: todos en descanso si no hay jugadas
  if (
    Object.keys(partySpritesMap).length === 0 &&
    Array.isArray(jugadores) &&
    jugadores.length > 0
  ) {
    try {
      const start =
        casillas.find((c) => String(c.tipo).toLowerCase() === "descanso") ||
        casillas[0];
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
              const pjIdSel =
                (sel && sel.id) ||
                jw.selected_personaje_id ||
                jw.selected_personaje_db_id;
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

  // debug: asegúrate que identificadores y jugada se resuelven correctamente
  try {
    console.debug('[MapView] mySelectedPersonajeId:', mySelectedPersonajeId, 'mySelectedPersonajeNumericId:', mySelectedPersonajeNumericId, 'myJugada:', myJugada);
  } catch (e) {}

  // determinar si es el turno del jugador actual comparando múltiples posibles IDs
  let myTurnActive = false;
  if (turnoActivo) {
    const candidatoIds = new Set();
    if (mySelectedPersonajeNumericId != null) candidatoIds.add(String(mySelectedPersonajeNumericId));
    if (mySlot) {
      if (mySlot.selected_personaje_db_id != null) candidatoIds.add(String(mySlot.selected_personaje_db_id));
      if (mySlot.selected_personaje_id != null) candidatoIds.add(String(mySlot.selected_personaje_id));
      if (mySlot.selected_personaje && mySlot.selected_personaje.id != null) candidatoIds.add(String(mySlot.selected_personaje.id));
      // intentar mapear por nombre al orden de actores
      const selNombre = mySlot.selected_personaje && mySlot.selected_personaje.nombre;
      if (selNombre) {
        const foundByName = sortedOrder.find(
          (o) => String(o.actor?.nombre).toLowerCase() === String(selNombre).toLowerCase()
        );
        if (foundByName && foundByName.actor && foundByName.actor.id != null) {
          candidatoIds.add(String(foundByName.actor.id));
        }
      }
    }
    // también si hay un actor en el orden que pertenezca al usuario, añadir su actor.id
    const ownedActor = sortedOrder.find((o) => String(o.actor?.usuarioId) === String(user?.id));
    if (ownedActor && ownedActor.actor && ownedActor.actor.id != null) {
      candidatoIds.add(String(ownedActor.actor.id));
    }

    const turnoId = turnoActivo.personajeId != null ? String(turnoActivo.personajeId) : null;
    if (turnoId && candidatoIds.has(turnoId)) myTurnActive = true;
  }

  const movimientosRestantes = turnoActivo?.movimientos_restantes ?? 0;
  const canMove = !!mySelectedPersonajeNumericId && myTurnActive && movimientosRestantes > 0;

  const allowedTiles = new Set();
  // determinar la jugada efectiva desde la que calculamos movimientos:
  // 1) la jugada asociada al personaje seleccionado (myJugada)
  // 2) fallback: la jugada del personaje que marca el turno activo
  // 3) fallback final: la posición actual `pos` (cámara)
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
          Number(ca.x) === Number(c.x) && Number(ca.y) === Number(c.y)
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
      const sendJugadorId = myJugada?.jugador_id ?? (turnoActivo?.personajeId ?? mySelectedPersonajeNumericId);
      try {
        console.debug('[MapView] Enviando movimiento con jugadorId:', sendJugadorId, 'miSelectedNumeric:', mySelectedPersonajeNumericId, 'myJugada:', myJugada, 'turnoActivo:', turnoActivo);
      } catch (e) {}
      let r;
      try {
        r = await moveTo(sendJugadorId, c.x, c.y);
      } catch (err) {
        // si el servidor responde 403, mostrar información útil
        if (err?.response?.status === 403) {
          console.warn('[MapView] Movimiento rechazado por servidor (403).', { sendJugadorId, turnoActivo, myJugada, mySlot });
          alert(err?.response?.data?.error || 'No es tu turno para moverte (403)');
        }
        throw err;
      }
      // si el backend devolvió info de combate, redirigir a la vista de combate
      if (r && r.combate) {
        // compatibilidad: r.combate puede ser { combate, turnoActual, orden, hpActual } o directamente el combate
        const combatePayload = r.combate;
        const combateObj = (combatePayload && combatePayload.combate) ? combatePayload.combate : combatePayload;
        const actoresMap = r.actores || (combatePayload && combatePayload.actores) || [];
        if (combateObj && combateObj.id) {
          // normalizar orden antes de navegar para evitar duplicados o shape inconsistent
          const rawOrden = (combatePayload && (combatePayload.orden || combatePayload.ordenIniciativa)) || [];
          const normalizedOrden = (() => {
            if (!Array.isArray(rawOrden)) return [];
            const seen = new Set();
            const out = [];
            for (const it of rawOrden) {
              try {
                if (!it) continue;
                const tipo = String(it.tipo || '').toUpperCase();
                const idStr = String(it.entidadId ?? it.actorId ?? it.id ?? '').trim();
                if (!idStr) continue;
                const key = `${tipo}:${idStr}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ tipo, entidadId: Number.isFinite(Number(idStr)) ? Number(idStr) : idStr, iniciativa: it.iniciativa ?? null, detalle: it.detalle ?? null, nombre: it.nombre ?? it.name ?? null });
              } catch (e) {
                /* noop */
              }
            }
            return out;
          })();
          // attach normalized orden into payload copy
          const payloadWithOrden = { ...(combatePayload || {}), orden: normalizedOrden };
          // Mostrar combate como overlay en lugar de navegar
          setCombateActivo({
            combateId: combateObj.id,
            combate: payloadWithOrden,
            actores: actoresMap
          });
          return;
        }
      }
      // Recargar solo si NO es combate (para actualizar posición)
      // REMOVIDO: window.location.reload() - causa problemas con WebSocket
    } catch (e) {
      console.error("Error moviendo a casilla", e);
      alert(e?.response?.data?.error || "Error moviendo personaje");
    }
  };

  // 🔁 Dueño del personaje activo para el banner
  let activeOwner = null;
  if (activePersonajeIdStr) {
    const activeSlot = sortedOrder.find(
      (o) => String(o.actor?.id) === activePersonajeIdStr
    );
    if (activeSlot?.actor?.usuarioId != null) {
      activeOwner =
        jugadorById.get(String(activeSlot.actor.usuarioId)) || null;
    } else {
      activeOwner = jugadorByPersonajeId[activePersonajeIdStr] || null;
    }
  }

  const nombreJugadorTurno = turnoActivo
    ? activeOwner?.username ||
      (turnoActivo.personajeId
        ? `Personaje ${turnoActivo.personajeId}`
        : "—")
    : "—";
  const textoTurno = turnoActivo
    ? `Es el turno de ${nombreJugadorTurno}, le quedan ${movimientosRestantes} movimientos...`
    : "Esperando próximo turno...";

  // 🧍 Personaje del usuario actual (snapshot WS, se usa como fallback)
  const myPersonaje =
    (mySlot && mySlot.selected_personaje) ||
    sortedOrder.find(
      (o) => String(o.actor?.id) === String(mySelectedPersonajeNumericId)
    )?.actor ||
    null;

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
        j.selected_personaje_db_id &&
        /^\d+$/.test(String(j.selected_personaje_db_id))
      ) {
        pjNumericId = Number(j.selected_personaje_db_id);
      } else if (
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

  return (
    <div className="map-root">
      {/* HEADER de retratos */}
      <div className="map-header">
        {sortedOrder.map((slot, i) => {
          const pjId = slot.actor?.id;
          // 🔗 Dueño del personaje para este retrato
          let owner =
            (slot.actor?.usuarioId != null
              ? jugadorById.get(String(slot.actor.usuarioId))
              : null) ||
            jugadorByPersonajeId[String(pjId)] ||
            null;

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
        {fondoMapa && (
          <img src={fondoMapa} className="map-background" />
        )}

        <Grid
          casillas={casillas}
          pos={pos}
          onTileClick={handleTileClick}
          partySprites={partySprites}
          partySpritesMap={partySpritesMap}
          canMove={canMove}
          allowedTiles={allowedTiles}
        />

          {/* Debug: mostrar enemigos en la casilla actual y botón forzar combate */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: '#0008', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
            <div style={{ marginBottom: 6 }}><strong>Enemigos casilla:</strong>{' '}
              {(() => {
                try {
                  const current = casillas.find(ca => Number(ca.x) === Number(pos.x) && Number(ca.y) === Number(pos.y));
                  if (!current) return '—';
                  const enem = current.enemigos || [];
                  if (!enem || enem.length === 0) return 'ninguno';
                  return enem.join(', ');
                } catch (e) { return '—'; }
              })()}
            </div>
            <div>
              <button
                onClick={async () => {
                  try {
                    const current = casillas.find(ca => Number(ca.x) === Number(pos.x) && Number(ca.y) === Number(pos.y));
                    if (!current || !current.enemigos || (Array.isArray(current.enemigos) && current.enemigos.length === 0)) {
                      alert('No hay enemigos en la casilla actual');
                      return;
                    }
                    const actores = (personajesIds || []).map((id) => ({ entidadId: Number(id), tipo: 'PJ' }));
                    const enem = Array.isArray(current.enemigos) ? current.enemigos : [current.enemigos];
                    for (const e of enem) {
                      if (e == null) continue;
                      if (typeof e === 'object') {
                        const name = e.nombre ?? e.name ?? (e.id != null ? String(e.id) : null);
                        if (name != null) actores.push({ tipo: 'EN', entidadId: String(name) });
                        else actores.push({ tipo: 'EN', entidadId: JSON.stringify(e) });
                      } else {
                        actores.push({ tipo: 'EN', entidadId: String(e) });
                      }
                    }

                    console.debug('[MapView] Forzando combate con actores:', actores);
                    const combateRes = await api.post('/combate', { partidaId, actores });
                    console.debug('[MapView] respuesta forzar combate:', combateRes && combateRes.data);
                    const combatePayload = combateRes?.data?.combate || combateRes?.data;
                    const actoresMap = combateRes?.data?.actores || [];
                    if (combatePayload && combatePayload.id) {
                      // normalize orden before navigation
                      const rawOrden = (combatePayload && (combatePayload.orden || combatePayload.ordenIniciativa)) || [];
                      const normalizedOrden = Array.isArray(rawOrden)
                        ? rawOrden.reduce((acc, it) => {
                            try {
                              const tipo = String(it.tipo || '').toUpperCase();
                              const id = String(it.entidadId ?? it.actorId ?? it.id ?? '').trim();
                              if (!id) return acc;
                              const key = `${tipo}:${id}`;
                              if (acc.__seen.has(key)) return acc;
                              acc.__seen.add(key);
                              acc.push({ tipo, entidadId: Number.isFinite(Number(id)) ? Number(id) : id, iniciativa: it.iniciativa ?? null, detalle: it.detalle ?? null, nombre: it.nombre ?? it.name ?? null });
                            } catch (e) {}
                            return acc;
                          }, []).filter(Boolean)
                        : [];
                      const payloadWithOrden = { ...(combatePayload || {}), orden: normalizedOrden };
                      // Mostrar combate como overlay
                      setCombateActivo({
                        combateId: combatePayload.id,
                        combate: payloadWithOrden,
                        actores: actoresMap
                      });
                      return;
                    }
                    alert('Combate iniciado, pero no se devolvió id (ver consola)');
                  } catch (e) {
                    console.error('Error forzando combate', e);
                    alert('Error forzando combate: ' + (e?.response?.data?.error || e.message || e));
                  }
                }}
                style={{ padding: '6px 8px', fontSize: 12 }}
              >Forzar combate (debug)</button>
            </div>
          </div>
        <div className="map-turn-banner">{textoTurno}</div>
      </div>

      <div className="map-name">{mapa.nombre}</div>

      <button
        onClick={handleAbandonar}
        className="map-abandon-button"
      >
        Abandonar partida
      </button>

      <Inventory
        personaje={myPersonaje}
        personajeId={mySelectedPersonajeNumericId}
        mapaNombre={mapa.nombre}
        items={myPersonaje?.inventario || []}
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
        teamMembers={teamMembers} 
      />

      {/* Overlay de combate */}
      {combateActivo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 9999,
          overflow: 'auto'
        }}>
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
    </div>
  );
}