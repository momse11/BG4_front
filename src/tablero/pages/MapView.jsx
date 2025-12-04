import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo, useState, useEffect } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import { deletePartida } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import Inventory from "./Inventory";
import Trading from "./Trading"; // ⬅️ NUEVO
import "../../assets/styles/map.css";

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

  const jugadorParam = useMemo(
    () => (user ? { id: user.id, username: user.username } : null),
    [user?.id, user?.username]
  );
  const { jugadores, turnoActivo } = usePartidaWS(partidaId, jugadorParam);

  const { loading, mapa, casillas, pos, order, jugadas, moveTo } =
    useMapLogic({ mapaId, personajesIds });

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

  // 💰 Vista de comercio
  const [showTrading, setShowTrading] = useState(false); // ⬅️ NUEVO

  // 💬 Mensaje de interacción (visible para TODOS ahora)
  const [interactionMessage, setInteractionMessage] = useState(null);

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

      const pjId =
        (sel && sel.id) || j.selected_personaje_id || j.selected_personaje_db_id;
      if (pjId != null) {
        jugadorByPersonajeId[String(pjId)] = j;
      }
    } catch (e) {}
  }

  // 🎹 Toggle inventario con tecla I
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

  // 🧨 Escuchamos los movimientos vía evento global para sincronizar el mensaje entre TODOS
  useEffect(() => {
    // helper: dado un personajeId, encontrar al jugador dueño
    const findOwnerByPersonajeId = (pjId) => {
      if (pjId == null) return null;
      const target = String(pjId);

      return (
        (jugadores || []).find((j) => {
          const sel = j.selected_personaje || null;
          const ids = [
            j.selected_personaje_db_id,
            j.selected_personaje_id,
            sel?.id,
          ]
            .filter((x) => x != null)
            .map((x) => String(x));
          return ids.includes(target);
        }) || null
      );
    };

    const handler = (event) => {
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
        payload.x ?? payload.destX ?? payload.nueva_x ?? payload.pos_x ?? null;
      const destY =
        payload.y ?? payload.destY ?? payload.nueva_y ?? payload.pos_y ?? null;

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

      if (destX == null || destY == null) return;

      const casilla = casillas.find(
        (c) => Number(c.x) === Number(destX) && Number(c.y) === Number(destY)
      );
      if (!casilla) {
        setInteractionMessage(null);
        return;
      }

      const objetosInCasilla = Array.isArray(casilla.objetos)
        ? casilla.objetos
        : [];
      const enemigosInCasilla = Array.isArray(casilla.enemigos)
        ? casilla.enemigos
        : [];

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

      // 💡 Personaje que se mueve: priorizamos el turnoActivo
      const movingPersonajeId =
        turnoActivo?.personajeId != null
          ? turnoActivo.personajeId
          : personajeIdFromPayload;

      // Buscamos dueño
      let owner = null;

      if (movingPersonajeId != null) {
        owner = findOwnerByPersonajeId(movingPersonajeId);
      }

      // Fallback: si viene jugadorId en el payload, tratamos de usarlo
      if (!owner && jugadorId != null) {
        owner =
          (jugadores || []).find(
            (j) => Number(j.id) === Number(jugadorId)
          ) || null;
      }

      const actorName =
        owner?.username ||
        (movingPersonajeId != null
          ? `Personaje ${movingPersonajeId}`
          : "Un aventurero");

      let msg = null;

      if (enemigosInCasilla.length > 0) {
        const nombresEnemigos = enemigosInCasilla
          .map(getNombreEnemigo)
          .filter(Boolean)
          .join(", ");
        if (nombresEnemigos) {
          msg = `${actorName} ha detonado un combate con ${nombresEnemigos}.`;
        }
      } else if (objetosInCasilla.length > 0) {
        const nombresObjetos = objetosInCasilla
          .map(getNombreObjeto)
          .filter(Boolean)
          .join(", ");
        if (nombresObjetos) {
          msg = `${actorName} ha encontrado ${nombresObjetos}.`;
        }
      }

      if (msg) setInteractionMessage(msg);
      else setInteractionMessage(null);
    };

    window.addEventListener("jugada_moved", handler);
    return () => window.removeEventListener("jugada_moved", handler);
  }, [casillas, jugadores, partidaId, turnoActivo]);

  // ⚠️ Returns condicionales después de TODOS los hooks
  if (loading) return <div className="map-status-text">Cargando...</div>;
  if (!mapa) return <div className="map-status-text">Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);

  // ====== SPRITES PARTY ======

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
    (j) => String(j.jugador_id) === String(mySelectedPersonajeId)
  );

  let myTurnActive = false;

  if (turnoActivo && mySelectedPersonajeId) {
    myTurnActive =
      String(turnoActivo.personajeId) === String(mySelectedPersonajeId);
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

  // ⬇️ Datos de ciudad / mercader para la vista Trading
  const currentCityEntry = myCurrentCasilla?.ciudades?.[0] || null;
  const currentMerchantEntry =
    currentCityEntry?.mercaderes?.[0] || null;

  const ciudadNombre =
    currentCityEntry?.ciudad?.nombre || null;

  const mercader =
    currentMerchantEntry?.mercader || null;

  const mercaderInventario =
    currentMerchantEntry?.inventario || [];

  const allowedTiles = new Set();
  if (canMove && myJugada) {
    const curX = Number(myJugada.x);
    const curY = Number(myJugada.y);

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
          Number(ca.x) === Number(c.x) && Number(c.y) === Number(c.y)
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

      // El mensaje aparecerá para TODOS cuando llegue el evento JUGADA_MOVIDA desde el WS
      await moveTo(mySelectedPersonajeNumericId, c.x, c.y);
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

  // 🧍 Personaje del usuario actual
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

  // === Handlers de los botones ===
  const handleDescansarClick = () => {
    if (!canRestHere) return;
    console.debug("[MapView] Descansar clicado en casilla de descanso");
  };

  const handleInventoryButtonClick = () => {
    if (!mySelectedPersonajeNumericId) return;
    setShowInventory(true);
  };

  const handleComerciarClick = () => {
    if (!canTradeHere) return;
    setShowTrading(true); // ⬅️ antes: navigate("trading")
  };

  return (
    <div className="map-root">
      {/* HEADER de retratos */}
      <div className="map-header">
        {sortedOrder.map((slot, i) => {
          const pjId = slot.actor?.id;

          // 🔗 Dueño del personaje para este retrato
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
    </div>
  );
}