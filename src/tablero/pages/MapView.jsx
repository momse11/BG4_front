import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import { deletePartida } from "../../utils/api";
import { useNavigate } from "react-router-dom";

// 👇 importa los estilos del mapa
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

  if (loading) return <div className="map-status-text">Cargando...</div>;
  if (!mapa) return <div className="map-status-text">Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);
  const activePersonajeIdStr =
    turnoActivo?.personajeId != null ? String(turnoActivo.personajeId) : null;

  // ✔ Orden basado en turno (menor turno juega primero)
  const sortedOrder = [...order].sort(
    (a, b) => (a.turno ?? 0) - (b.turno ?? 0)
  );

  // Sprites del party (orden por turno), poniendo el personaje activo al frente
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

  // construir mapa de sprites por casilla a partir de `jugadas`
  const spriteById = new Map();
  const jugadoresByNombre = {};
  const jugadorByPersonajeId = {};

  for (const j of jugadores || []) {
    try {
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

  // Fallback: sin jugadas aún -> todos en la casilla de descanso / primera
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

  // identificar el personaje del usuario actual
  const mySlot = user
    ? (jugadores || []).find((j) => Number(j.id) === Number(user.id))
    : null;
  const mySelectedPersonajeId = mySlot
    ? mySlot.selected_personaje?.id || mySlot.selected_personaje_id || null
    : null;
  console.debug(
    "[MapView] mySlot:",
    mySlot,
    "mySelectedPersonajeId:",
    mySelectedPersonajeId,
    "turnoActivo:",
    turnoActivo
  );
  const myJugada = (jugadas || []).find(
    (j) => String(j.jugador_id) === String(mySelectedPersonajeId)
  );

  // Chequeo de turno activo
  let myTurnActive = false;

  if (turnoActivo && mySelectedPersonajeId) {
    // Es mi turno si el personaje activo en el turno es el personaje que yo tengo seleccionado
    myTurnActive =
      String(turnoActivo.personajeId) === String(mySelectedPersonajeId);
  }

  // ID numérico para el backend
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

  const movimientosRestantes = turnoActivo?.movimientos_restantes ?? 0;

  // ✅ Solo puedes mover si: tienes personaje + es tu turno + quedan movimientos
  const canMove =
    !!mySelectedPersonajeNumericId && myTurnActive && movimientosRestantes > 0;

  // ✅ Calcular casillas ortogonales accesibles desde la posición actual
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
      // No permitir inaccesibles
      if (tipo.includes("inacces")) continue;

      allowedTiles.add(`${casillaExists.x},${casillaExists.y}`);
    }
  }

  const handleTileClick = async (c) => {
    try {
      // Si no puedes mover o la casilla no está en allowedTiles, ignorar
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

      // Aquí solo revalidamos que no sea inaccesible por si acaso
      try {
        const tipo = String(casillaExists.tipo || "").toLowerCase();
        if (tipo.includes("inacces")) {
          alert("No puedes moverte: la casilla es Inaccesible");
          return;
        }
      } catch (e) {}

      // Movimiento directo a una casilla vecina válida
      await moveTo(mySelectedPersonajeNumericId, c.x, c.y);
      // Sin reload: el estado + WS actualizan la UI
    } catch (e) {
      console.error("Error moviendo a casilla", e);
      alert(e?.response?.data?.error || "Error moviendo personaje");
    }
  };

  const activeJugadorUi = activePersonajeIdStr
    ? jugadorByPersonajeId[activePersonajeIdStr] || null
    : null;
  const nombreJugadorTurno = turnoActivo
    ? activeJugadorUi?.username ||
      (turnoActivo.personajeId
        ? `Personaje ${turnoActivo.personajeId}`
        : "—")
    : "—";
  const textoTurno = turnoActivo
    ? `Es el turno de ${nombreJugadorTurno}, le quedan ${movimientosRestantes} movimientos...`
    : "Esperando próximo turno...";

  // 👇 handler del botón "Abandonar"
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
      {/* 🔷 MARCOS + RETRATOS + NOMBRE DE USUARIO ARRIBA */}
      <div className="map-header">
        {sortedOrder.map((slot, i) => {
          const pjId = slot.actor?.id;
          const owner = jugadorByPersonajeId[String(pjId)] || null;
          const username = owner?.username || "—";
          const isActive =
            activePersonajeIdStr &&
            String(pjId) === String(activePersonajeIdStr);

          return (
            <div key={i} className="map-slot">
              {/* Nombre de usuario encima del retrato */}
              <div
                className={
                  "map-slot-username" +
                  (isActive ? " map-slot-username--active" : "")
                }
              >
                {username}
              </div>

              <div className="map-slot-frame-wrapper">
                {/* Retrato atrás del marco, sin escalar */}
                {slot.actor.portrait && (
                  <img
                    src={slot.actor.portrait}
                    alt={slot.actor.nombre}
                    className="map-slot-portrait"
                  />
                )}

                {/* Marco en tamaño ORIGINAL */}
                <img
                  src={marco}
                  alt="Marco"
                  className="map-slot-frame"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 🔷 MAPA + GRID */}
      <div className="map-main">
        {fondoMapa && (
          <img
            src={fondoMapa}
            className="map-background"
          />
        )}

        <Grid
          casillas={casillas}
          pos={pos}
          onTileClick={handleTileClick}
          partySprites={partySprites}
          partySpritesMap={partySpritesMap}
          canMove={canMove}
          allowedTiles={allowedTiles} // ⬅ aquí van las casillas verdes del turno
        />

        {/* Texto de turno sobre el mapa */}
        <div className="map-turn-banner">{textoTurno}</div>
      </div>

      {/* Nombre del mapa abajo */}
      <div className="map-name">{mapa.nombre}</div>

      <button
        onClick={handleAbandonar}
        className="map-abandon-button"
      >
        Abandonar partida
      </button>
    </div>
  );
}