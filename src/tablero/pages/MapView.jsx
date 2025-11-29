import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";
import { useContext, useMemo } from "react";
import { AuthContext } from "../../auth/AuthProvider";
import { usePartidaWS } from "../../utils/ws";
import MovementControls from "../components/MovementControls";

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
  const jugadorParam = useMemo(() => (user ? { id: user.id, username: user.username } : null), [user?.id, user?.username]);
  const { jugadores, turnoActivo } = usePartidaWS(partidaId, jugadorParam);

  const { loading, mapa, casillas, pos, order, jugadas, moveTo } =
    useMapLogic({ mapaId, personajesIds });

  if (loading) return <div style={{ color: "#fff" }}>Cargando...</div>;
  if (!mapa) return <div style={{ color: "#fff" }}>Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);

  // ✔ Orden basado en turno (menor turno juega primero)
  const sortedOrder = [...order].sort((a, b) => (a.turno ?? 0) - (b.turno ?? 0));

  // Sprites del party (orden por turno)
  const partySprites = sortedOrder.map((o) => o.actor.sprite).filter(Boolean);

  // construir mapa de sprites por casilla a partir de `jugadas`
  const spriteById = new Map();
  // build a quick lookup of jugadores (from WS) by personaje nombre or id
  const jugadoresByNombre = {};
  for (const j of jugadores || []) {
    try {
      const sel = j.selected_personaje || null;
      if (sel && sel.nombre) jugadoresByNombre[String(sel.nombre).toLowerCase()] = sel;
    } catch (e) {}
  }

  for (const o of sortedOrder) {
    if (!o || !o.actor || o.actor.id == null) continue;
    let spr = o.actor.sprite || null;
    // fallback: buscar en la lista de jugadores (WS) por nombre
    if (!spr && o.actor.nombre) {
      const found = jugadoresByNombre[String(o.actor.nombre).toLowerCase()];
      if (found && found.sprite) spr = found.sprite;
    }
    // DEBUG
    try { console.debug('[MapView] asignando sprite para actor', o.actor.nombre, '->', spr); } catch (e) {}
    if (spr) spriteById.set(String(o.actor.id), spr);
  }

  const partySpritesMap = {};
  for (const j of jugadas || []) {
    try {
      const key = `${j.x},${j.y}`;
      const spr = spriteById.get(String(j.jugador_id)) || null;
      if (!spr) continue;
      if (!partySpritesMap[key]) partySpritesMap[key] = [];
      partySpritesMap[key].push(spr);
    } catch (e) { /* noop */ }
  }

  // Fallback: si no hay jugadas (aún no creadas en el backend), usar los sprites declarados en WS `jugadores`
  // y colocarlos en la casilla de inicio (tipo 'Descanso' o primera casilla)
  if (Object.keys(partySpritesMap).length === 0 && Array.isArray(jugadores) && jugadores.length > 0) {
    try {
      const start = casillas.find((c) => String(c.tipo).toLowerCase() === 'descanso') || casillas[0];
      if (start) {
        const key = `${start.x},${start.y}`;
        partySpritesMap[key] = partySpritesMap[key] || [];
        for (const jw of jugadores) {
          try {
            const sel = jw.selected_personaje || null;
            let spr = null;
            if (sel && sel.sprite) spr = sel.sprite;
            else if (sel && sel.nombre) {
              // intentar derivar local path por nombre (limpio el nombre)
              const clean = String(sel.nombre).toLowerCase().replace(/[_\s]+/g, '');
              // buscar en los already computed spriteById map (por nombre)
              for (const [, v] of spriteById) {
                if (String(v).toLowerCase().includes(clean)) { spr = v; break; }
              }
            }
            if (spr) partySpritesMap[key].push(spr);
          } catch (e) { /* noop */ }
        }
      }
    } catch (e) { /* noop */ }
  }

  // identificar el personaje del usuario actual
  const mySlot = user ? jugadores.find(j => Number(j.id) === Number(user.id)) : null;
  const mySelectedPersonajeId = mySlot ? (mySlot.selected_personaje?.id || mySlot.selected_personaje_id || null) : null;
  console.debug('[MapView] mySlot:', mySlot, 'mySelectedPersonajeId:', mySelectedPersonajeId, 'turnoActivo:', turnoActivo);
  const myJugada = jugadas.find(j => String(j.jugador_id) === String(mySelectedPersonajeId));
  const myTurn = myJugada ? myJugada.turno : null;
  // Robust active-turn check: map server personajeId back to a jugador slot if possible
  let myTurnActive = false;
  let activeJugadorForTurn = null;
  if (turnoActivo) {
    activeJugadorForTurn = jugadores.find((j) =>
      String(j.selected_personaje?.id) === String(turnoActivo.personajeId) ||
      String(j.selected_personaje_id) === String(turnoActivo.personajeId) ||
      String(j.id) === String(turnoActivo.personajeId)
    );
    console.debug('[MapView] activeJugador for turno:', activeJugadorForTurn);
    if (activeJugadorForTurn) {
      myTurnActive = Number(activeJugadorForTurn.id) === Number(user?.id);
    } else {
      myTurnActive = String(turnoActivo.personajeId) === String(mySelectedPersonajeId);
    }
  }
  // Compute numeric personaje id to send to backend: prefer DB-resolved id from WS
  let mySelectedPersonajeNumericId = mySelectedPersonajeId;

  // if we have a mySlot (usuario info from WS), prefer the explicit DB id provided by the server
  if (mySlot) {
    // 1) prefer explicit DB id sent by server (selected_personaje_db_id)
    if (mySlot.selected_personaje_db_id && /^\d+$/.test(String(mySlot.selected_personaje_db_id))) {
      mySelectedPersonajeNumericId = Number(mySlot.selected_personaje_db_id);
    }
    // 2) else prefer selected_personaje.id if it's numeric
    else if (mySlot.selected_personaje && /^\d+$/.test(String(mySlot.selected_personaje.id))) {
      mySelectedPersonajeNumericId = Number(mySlot.selected_personaje.id);
    }
  }

  // 3) If still not numeric, attempt to resolve by matching actor nombre in sortedOrder
  if (!/^\d+$/.test(String(mySelectedPersonajeNumericId))) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[_\s]+/g, '').trim();
    const found = sortedOrder.find(o => norm(o.actor?.nombre) === norm(mySelectedPersonajeNumericId) || norm(String(o.actor?.id || '')) === norm(mySelectedPersonajeNumericId));
    if (found) mySelectedPersonajeNumericId = found.actor.id;
  }

  // Final guard: if still no numeric id, block moving and show message in UI
  if (!mySelectedPersonajeNumericId || !/^\d+$/.test(String(mySelectedPersonajeNumericId))) {
    // this will be handled by the handlers before calling moveTo (alerts etc.)
  }

  const handleTileClick = async (c) => {
    try {
      // si no hay personaje seleccionado por mi, no mover
      if (!mySelectedPersonajeNumericId) { alert('No tienes personaje seleccionado en esta partida'); return; }
      // comprobar si es mi turno (comparar con servidor via WS)
      if (!myTurnActive) { alert('No es tu turno'); return; }
      if ((turnoActivo.movimientos_restantes || 0) <= 0) { alert('No te quedan movimientos'); return; }

      // comprobar localmente que la casilla pertenece a este mapa antes de llamar al backend
      const casillaExists = casillas.find(ca => Number(ca.x) === Number(c.x) && Number(ca.y) === Number(c.y));
      if (!casillaExists) {
        console.warn('[MapView] Bloqueando solicitud local: casilla destino no pertenece al mapa', { destino: c, mapaId: mapa?.id });
        alert('La casilla destino no pertenece a este mapa (verifica coordenadas)');
        return;
      }

      // enviar movimiento usando el id numérico resuelto
      await moveTo(mySelectedPersonajeNumericId, c.x, c.y);
      // opcional: podríamos solicitar al backend el siguiente turno o actualizar jugadas
      window.location.reload();
    } catch (e) {
      console.error('Error moviendo a casilla', e);
      alert(e?.response?.data?.error || 'Error moviendo personaje');
    }
  };

  // mueve TODO el equipo UNA casilla en la dirección (dx,dy) por cada click
  const moveTeam = async (dx, dy) => {
    try {
      // solo permitir mover si es mi turno activo
      if (!myTurnActive) { alert('No es tu turno'); return; }
      if ((turnoActivo.movimientos_restantes || 0) <= 0) { alert('No te quedan movimientos'); return; }

      // obtener posición actual del personaje activo
      const myJ = (jugadas || []).find(j => String(j.jugador_id) === String(mySelectedPersonajeNumericId));
      if (!myJ) { alert('No se conoce la posición de tu personaje'); return; }
      const curX = Number(myJ.x);
      const curY = Number(myJ.y);
      const newX = curX + dx;
      const newY = curY + dy;

      // comprobar localmente la existencia de la casilla destino
      const casillaExists = casillas.find(ca => Number(ca.x) === Number(newX) && Number(ca.y) === Number(newY));
      if (!casillaExists) {
        console.warn('[MapView] Movimiento bloqueado local: casilla destino no pertenece al mapa', { dest: { x: newX, y: newY }, mapaId: mapa?.id });
        alert('La casilla destino no pertenece a este mapa');
        return;
      }

      // realizar la llamada usando el id NUMÉRICO del personaje activo; el backend moverá a todos los participantes
      try {
        await moveTo(mySelectedPersonajeNumericId, newX, newY);
      } catch (e) {
        console.error('Movimiento bloqueado para jugador', mySelectedPersonajeNumericId, e);
        alert(e?.response?.data?.error || 'Movimiento bloqueado para el equipo');
        return;
      }

      // confiar en WS para actualizar UI
    } catch (e) {
      console.error('Error moviendo equipo', e);
      alert('Error moviendo el equipo');
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Press Start 2P', cursive",
        color: "white",
      }}
    >
      {/* 🔷 MARCOS + RETRATOS SIN ESCALAR */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {sortedOrder.map((slot, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
            }}
          >
            {/* Retrato atrás del marco, sin escalar */}
            {slot.actor.portrait && (
              <img
                src={slot.actor.portrait}
                alt={slot.actor.nombre}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1,
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Marco en tamaño ORIGINAL */}
            <img
              src={marco}
              alt="Marco"
              style={{
                position: "relative",
                zIndex: 2,
                display: "block",
                imageRendering: "pixelated",
                pointerEvents: "none",
              }}
            />
            {/* badge de movimientos restantes */}
            {(() => {
              const pjId = slot.actor?.id;
              const j = jugadas.find(x => String(x.jugador_id) === String(pjId));
              const restos = j ? (j.movimientos_restantes || 0) : 0;
              if (restos != null) {
                return (
                  <div style={{ position: 'absolute', right: 2, top: 2, zIndex: 3, background: '#0008', padding: '2px 6px', borderRadius: 6, fontSize: 10 }}>
                    {restos} mv
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ))}
      </div>

      {/* 🔷 MAPA + GRID */}
      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Fondo GIF */}
        {fondoMapa && (
          <img
            src={fondoMapa}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              imageRendering: "pixelated",
            }}
          />
        )}

        {/* Grid */}
        <Grid
          casillas={casillas}
          pos={pos}
          onTileClick={handleTileClick}
          partySprites={partySprites}
          partySpritesMap={partySpritesMap}
        />
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <MovementControls
            onUp={() => moveTeam(0, 1)}
            onDown={() => moveTeam(0, -1)}
            onLeft={() => moveTeam(-1, 0)}
            onRight={() => moveTeam(1, 0)}
          />
        </div>
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#0008', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
          <strong>Turno:</strong>{' '}
          {activeJugadorForTurn ? (
            <span>{activeJugadorForTurn.username || activeJugadorForTurn.id} — {turnoActivo?.movimientos_restantes ?? 0} mv</span>
          ) : (
            <span>{turnoActivo?.personajeId ? String(turnoActivo.personajeId) : '—'} — {turnoActivo?.movimientos_restantes ?? 0} mv</span>
          )}
        </div>
      </div>

      {/* 🔷 Nombre del mapa abajo en 8 bits */}
      <div style={{ marginBottom: 25, fontSize: 18 }}>
        {mapa.nombre}
      </div>
    </div>
  );
}