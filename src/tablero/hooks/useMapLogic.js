import { useEffect, useState } from "react";
import { getMapa, getPersonaje, getJugada, moveJugador } from "../services/mapService";


const retratos = import.meta.glob(
  "/src/assets/tablero/retratos/*.{png,jpg,jpeg}",
  { eager: true }
);

const spriteFiles = import.meta.glob(
  "/src/assets/tablero/sprites/*.{png,jpg,jpeg,gif}",
  { eager: true }
);

function getPortrait(name) {
  const clean = name.toLowerCase();
  for (const p in retratos) {
    const file = p.split("/").pop().split(".")[0].toLowerCase();
    if (file === clean) return retratos[p].default;
  }
  return null;
}

function getSprite(name) {
  const clean = name.toLowerCase();
  for (const p in spriteFiles) {
    const file = p.split("/").pop().split(".")[0].toLowerCase();
    if (file === clean) return spriteFiles[p].default;
  }
  return null;
}

const d4 = () => Math.floor(Math.random() * 4) + 1;

function findStart(casillas) {
  return casillas.find((c) => c.tipo === "Descanso") || casillas[0];
}

import api from '../../utils/api';

function normalizeActoresForCombate(rawActores) {
  const out = [];
  for (const a of rawActores || []) {
    if (!a) continue;
    const tipo = String(a.tipo || 'PJ').toUpperCase();
    if (tipo === 'PJ') {
      const num = Number(a.entidadId);
      if (Number.isFinite(num)) out.push({ tipo: 'PJ', entidadId: Number(num) });
      else out.push({ tipo: 'PJ', entidadId: String(a.entidadId) });
      continue;
    }
    // EN
    const key = a.entidadId;
    if (key && typeof key === 'object') {
      const name = key.nombre ?? key.name ?? (key.id != null ? String(key.id) : null);
      if (name != null) out.push({ tipo: 'EN', entidadId: String(name) });
      else out.push({ tipo: 'EN', entidadId: JSON.stringify(key) });
    } else {
      out.push({ tipo: 'EN', entidadId: String(key) });
    }
  }
  return out;
}

export function useMapLogic({ mapaId, personajesIds, partidaId }) {
  const [mapa, setMapa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState([]);
  const [pos, setPos] = useState({ x: 1, y: 1 });
  const [jugadas, setJugadas] = useState([]);
  const [combateActores, setCombateActores] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const m = (await getMapa(mapaId)).data;
        setMapa(m);

        const actores = [];
        const jugadasLocal = [];

        // fetch personaje data and jugada (pos/turno) for each personaje id
        await Promise.all(
          (personajesIds || []).map(async (id) => {
            try {
              const pjR = await getPersonaje(id);
              const pj = pjR.data.personaje || pjR.data || pjR;
              pj.portrait = getPortrait(pj.nombre);
              // intentar obtener sprite local por nombre; si no, usar campo `sprite` que venga del backend/catalogo
              const localSprite = getSprite(pj.nombre);
              pj.sprite = localSprite || pj.sprite || null;
              actores.push(pj);

              try {
                const jR = await getJugada(mapaId, id);
                const j = jR.data;
                jugadasLocal.push({ jugador_id: id, x: j.x, y: j.y, turno: j.turno, movimientos_restantes: j.movimientos_restantes || 0 });
              } catch (e) {
                // no hay jugada — ignorar
              }
            } catch (e) {
              console.error('Error cargando personaje o jugada', id, e);
            }
          })
        );

        // DEBUG: mostrar actores y jugadasLocal para verificar sprites
        try {
          console.debug('[useMapLogic] actores:', actores.map(a => ({ id: a.id, nombre: a.nombre, sprite: a.sprite })) );
          console.debug('[useMapLogic] jugadasLocal:', jugadasLocal);
        } catch (e) { /* noop */ }

        setJugadas(jugadasLocal);

        // construir orden en base al campo 'turno' si existe, fallback a iniciativa aleatoria
        let lista = [];
        if (jugadasLocal.length > 0) {
          lista = actores.map((pj) => {
            const j = jugadasLocal.find((x) => String(x.jugador_id) === String(pj.id));
            return { actor: pj, turno: j ? Number(j.turno) : 0 };
          });
          lista.sort((a, b) => a.turno - b.turno); // menor turno = juega antes
        } else {
          lista = actores.map((pj) => ({ actor: pj, iniciativa: d4() + Number(pj.modIniciativa ?? 0) }));
          lista.sort((a, b) => b.iniciativa - a.iniciativa);
        }

        setOrder(lista);

        // pos por defecto: si tenemos una jugada para el primer actor, usarla
        const firstPos = jugadasLocal[0];
        if (firstPos) setPos({ x: firstPos.x, y: firstPos.y });
        else {
          const start = findStart(m.casillas);
          setPos({ x: start.x, y: start.y });
        }

      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mapaId, personajesIds]);

  // listener para actualizaciones de movimiento via WS (sin recargar)
  useEffect(() => {
    function onJugadaMoved(e) {
      const data = e.detail || {};
      const moved = Array.isArray(data.moved_personajes) ? data.moved_personajes : [];
      if (moved.length === 0) return;

      setJugadas((prev) => {
        const copy = [...prev];
        for (const m of moved) {
          // moved payloads pueden traer "personaje_id" o "personajeId" o "jugador_id"
          const movedPersonajeId = m.personaje_id ?? m.personajeId ?? m.jugador_id ?? m.personaje;
          const idx = copy.findIndex((j) => String(j.jugador_id) === String(movedPersonajeId));
          if (idx >= 0) {
            copy[idx] = { ...copy[idx], x: m.x, y: m.y };
            // si el payload trae movimientos_restantes global para el actor, actualizarlo
            if (data.movimientos_restantes !== undefined && String(copy[idx].jugador_id) === String(data.jugadorId ?? data.jugador_id ?? movedPersonajeId)) {
              copy[idx].movimientos_restantes = data.movimientos_restantes;
            }
          } else {
            copy.push({ jugador_id: movedPersonajeId, x: m.x, y: m.y, turno: null, movimientos_restantes: (data.movimientos_restantes || 0) });
          }
        }
        return copy;
      });

      // actualizar pos si uno de los movidos es el primer personaje de la lista (o el que representa la cámara)
      const primary = personajesIds && personajesIds.length > 0 ? String(personajesIds[0]) : null;
      const primaryMoved = moved.find(m => String(m.personaje_id ?? m.personajeId ?? m.jugador_id) === primary);
      if (primaryMoved) setPos({ x: primaryMoved.x, y: primaryMoved.y });
    }

    window.addEventListener('jugada_moved', onJugadaMoved);
    return () => window.removeEventListener('jugada_moved', onJugadaMoved);
  }, [personajesIds]);
  return {
    loading,
    mapa,
    casillas: mapa?.casillas || [],
    pos,
    order,
    jugadas,
    moveTo: async (jugadorId, x, y) => {
      try {
        const res = await moveJugador(mapaId, jugadorId, { x, y });
        if (res && (res.status === 200 || res.status === 201)) {
          // actualizar jugadas locales
          setJugadas((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((j) => String(j.jugador_id) === String(jugadorId));
            if (idx >= 0) {
              copy[idx] = { ...copy[idx], x, y, movimientos_restantes: (res.data && res.data.movimientos_restantes !== undefined) ? res.data.movimientos_restantes : copy[idx].movimientos_restantes };
            } else {
              copy.push({ jugador_id: jugadorId, x, y, turno: null, movimientos_restantes: (res.data && res.data.movimientos_restantes) || 0 });
            }
            return copy;
          });
          // si el jugador movido es el que representa pos, actualizar pos
          setPos({ x, y });
          
          // ===== COMBATE AHORA SE MANEJA EN EL BACKEND =====
          // El backend ya verifica si la casilla tiene enemigos y detona el combate automáticamente
          // Si la respuesta incluye data de combate, la retornamos para que MapView navegue
          if (res.data && res.data.combate) {
            console.debug('[useMapLogic] Backend detonó combate:', res.data.combate);
            return res.data; // Incluye combate y actores
          }

          return res.data;
        }
        return null;
      } catch (e) {
        console.error('Error moving jugador', e);
        throw e;
      }
    },
  };
}