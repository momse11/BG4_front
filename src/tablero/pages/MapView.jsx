import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo, useState, useEffect } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import { deletePartida } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import Inventory from "./Inventory";
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

      await moveTo(mySelectedPersonajeNumericId, c.x, c.y);
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
    </div>
  );
}