import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
} from 'react';
import api from '../../utils/api';
import { AuthContext } from '../../auth/AuthProvider';
import '../../assets/styles/CombatView.css';

// Normaliza orden e evita duplicados
function normalizeOrden(list = []) {
  const seen = new Set();
  const out = [];

  for (const it of list || []) {
    if (!it) continue;
    const tipo = String(it.tipo || '').toUpperCase();
    const id = String(it.entidadId ?? it.actorId ?? it.id ?? '').trim();
    if (!id) continue;
    const key = `${tipo}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      tipo,
      entidadId: Number.isFinite(Number(id)) ? Number(id) : id,
      iniciativa: it.iniciativa ?? it.iniciativa,
      detalle: it.detalle ?? it.detalle ?? null,
      nombre: it.nombre ?? it.name ?? null,
    });
  }

  return out;
}

function formatName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Resuelve el nombre de un actor
function getActorDisplayName(
  participants,
  orden,
  actoresResueltos,
  actorId,
  actorTipo
) {
  if (!actorId) return '';
  const idStr = String(actorId);

  const p = (participants || []).find(
    (x) => String(x.entidadId) === idStr
  );
  if (p?.personaje?.nombre) return p.personaje.nombre;

  const o = (orden || []).find(
    (x) =>
      String(x.entidadId) === idStr &&
      (!actorTipo ||
        String(x.tipo).toUpperCase() ===
          String(actorTipo).toUpperCase())
  );
  if (o?.nombre) return o.nombre;

  if (Array.isArray(actoresResueltos)) {
    const d = actoresResueltos.find(
      (a) =>
        String(a.entidadId) === idStr &&
        (!actorTipo ||
          String(a.tipo).toUpperCase() ===
            String(actorTipo).toUpperCase())
    );
    if (d?.nombre) return d.nombre;
  }

  return actorTipo === 'EN'
    ? `Enemigo ${actorId}`
    : `PJ ${actorId}`;
}

// Construye el texto bonito de la jugada
function buildActionSummary(data, resolveName) {
  const recurso = data.recurso || data.result?.recurso || {};
  const hp = data.hp || data.result?.hp || {};
  const dano = data.dano || data.result?.dano || {};
  const hitInfo = data.hit || data.result?.hit || null;
  const estados = data.estadosAplicados || data.result?.estadosAplicados || [];
  const esBenef = !!recurso.esBeneficioso;

  const actorId = data.actorId;

  // Deducción de tipo de actor si no viene (IA = enemigo)
  let actorTipoGuess = null;
  if (data.isAI) actorTipoGuess = 'EN';

  const actorNombre =
    resolveName(actorId, actorTipoGuess) || (data.isAI ? 'El enemigo' : 'Alguien');

  const targetTipo = hp.objetivoTipo || (data.isAI ? 'PJ' : null);
  const targetNombre =
    resolveName(hp.objetivo, targetTipo) || 'su objetivo';
  const accionNombre = recurso.nombre || 'una acción';

  const estadoNames = (Array.isArray(estados) ? estados : [])
    .map((e) => e && e.nombre)
    .filter(Boolean);

  const hayEstados = estadoNames.length > 0;
  const estadosListado = estadoNames.join(', ');

  const isObjeto = recurso.tipo === 'objeto';
  const accionLower = accionNombre.toLowerCase();
  const isPotionName =
    accionLower.includes('poción') || accionLower.includes('pocion');

  // Cabecera amarilla
  const headerYellow = isObjeto && isPotionName
    ? `${actorNombre} usó ${accionNombre}`
    : `${actorNombre} usó ${accionNombre}`;

  let detalle = '';

  if (esBenef) {
    // BENEFICIOSO
    const curado =
      hp.curado ??
      (typeof dano.variacionHP === 'number' && dano.variacionHP < 0
        ? Math.abs(dano.variacionHP)
        : 0) ??
      0;

    const estadoTargetsSelf =
      hayEstados &&
      !curado &&
      (
        !hp.objetivo ||
        targetTipo === 'EN' ||
        String(hp.objetivo) === String(actorId)
      );

    const receptorNombre = estadoTargetsSelf ? actorNombre : targetNombre;
    const esSiMismo = String(hp.objetivo) === String(actorId) || estadoTargetsSelf;

    if (curado > 0 && hayEstados) {
      const receptor = esSiMismo ? 'sí mismo' : receptorNombre;
      detalle = `Curó ${curado} puntos de vida y aplicó ${estadosListado} a ${receptor}`;
    } else if (curado > 0) {
      const receptor = esSiMismo ? 'sí mismo' : receptorNombre;
      detalle = `Curó ${curado} puntos de vida a ${receptor}`;
    } else if (hayEstados) {
      const receptor = esSiMismo ? 'sí mismo' : receptorNombre;
      detalle = `Se aplicó ${estadosListado} a ${receptor}`;
    } else {
      detalle = 'Se lo aplicó a sí mismo';
    }
  } else {
    // ATAQUE
    let impacto = null;

    if (hitInfo && typeof hitInfo.impacto === 'boolean') {
      impacto = hitInfo.impacto;
    } else {
      const variacion =
        typeof dano.variacionHP === 'number'
          ? dano.variacionHP
          : 0;
      const deltaHp =
        typeof hp.antes === 'number' &&
        typeof hp.despues === 'number'
          ? hp.antes - hp.despues
          : 0;
      impacto = variacion > 0 || deltaHp > 0;
    }

    const daniado =
      typeof hp.daniado === 'number'
        ? hp.daniado
        : dano.daniado ??
          (dano.variacionHP > 0
            ? dano.variacionHP
            : hp.antes - hp.despues > 0
            ? hp.antes - hp.despues
            : 0) ??
          0;

    if (!impacto) {
      detalle = 'Pero no lo logró...';
    } else {
      if (hayEstados && daniado > 0) {
        detalle = `Hizo ${daniado} de daño con éxito y puso los estados de ${estadosListado}`;
      } else if (daniado > 0) {
        detalle = `Hizo ${daniado} de daño con éxito`;
      } else if (hayEstados) {
        detalle = `Aplicó con éxito los estados de ${estadosListado}`;
      } else {
        detalle = 'Conectó el ataque con éxito';
      }
    }
  }

  return {
    actorNombre,
    targetNombre,
    accionNombre,
    headerYellow,
    detalle,
  };
}

// Target por defecto: primer EN vivo, si no, primer PJ
function chooseTargetFromOrden(orden, hpActual) {
  if (!Array.isArray(orden) || orden.length === 0) return null;
  const hp = hpActual || {};

  const en = orden.find(
    (o) =>
      String(o.tipo).toUpperCase() === 'EN' &&
      (hp[`EN:${o.entidadId}`] ?? 1) > 0
  );
  if (en) return en.entidadId;

  const pj = orden.find(
    (o) =>
      String(o.tipo).toUpperCase() === 'PJ' &&
      (hp[`PJ:${o.entidadId}`] ?? 1) > 0
  );
  return pj ? pj.entidadId : null;
}

// Detecta si un objeto es poción (usa datos planos y anidados en objeto)
function isPotion(item) {
  const baseName = item?.nombre || item?.objeto?.nombre || '';
  const tipo = item?.tipo || item?.objeto?.tipo || '';
  const categoria = item?.categoria || item?.objeto?.categoria || '';

  const txt = `${tipo} ${categoria} ${baseName}`.toLowerCase();
  return txt.includes('poción') || txt.includes('pocion');
}

/* ====================== HELPERS TOOLTIP (DAÑO / ESTADOS / STATS) ====================== */

// Icono para tipo de daño (carpeta /src/assets/daño/ con mismo nombre que el daño)
function getDamageIconPath(tipo) {
  const clean = String(tipo || '').trim();
  if (!clean) return null;
  const encoded = encodeURIComponent(clean);
  return `/src/assets/daño/${encoded}.png`;
}

// Resistencias / debilidades / inmunidades con texto + iconos
function renderDamageRowCombat(label, arr) {
  const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <>
      <p style={{ color: '#C0A66C', marginTop: 4 }}>
        <strong>{label}:</strong> {list.join(', ')}
      </p>
      <div className="character-tooltip-damage-row">
        <div className="character-tooltip-damage-icons">
          {list.map((tipo, idx) => {
            const src = getDamageIconPath(tipo);
            if (!src) return null;
            return (
              <span className="damage-icon-wrap" key={`${tipo}-${idx}`}>
                <img
                  src={src}
                  alt={tipo}
                  className="inventory-tooltip-damage-icon"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Lista de estados activos (amarillo)
function renderEstadosCombat(estados) {
  const list = Array.isArray(estados) ? estados : [];
  if (!list.length) return null;

  return (
    <div className="character-tooltip-states" style={{ marginTop: 6 }}>
      <p style={{ color: '#C0A66C' }}>
        <strong>Estados:</strong>
      </p>
      <ul>
        {list.map((e, idx) => (
          <li key={e.id || e.nombre || idx} style={{ color: '#C0A66C' }}>
            <strong>{e.nombre || 'Estado'}:</strong>{' '}
            {e.descripcion || ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Stats al final: STR, DES, CON, INT, SAB, CAR (verde)
function renderStatsLineCombat(p) {
  if (!p) return null;
  const hasAny =
    typeof p.fuerza === 'number' ||
    typeof p.destreza === 'number' ||
    typeof p.constitucion === 'number' ||
    typeof p.inteligencia === 'number' ||
    typeof p.sabiduria === 'number' ||
    typeof p.carisma === 'number';

  if (!hasAny) return null;

  return (
    <p
      className="character-tooltip-stats"
      style={{ color: '#4A6931', marginTop: 6 }}
    >
      STR {p.fuerza ?? '-'}{'  '}
      DES {p.destreza ?? '-'}{'  '}
      CON {p.constitucion ?? '-'}{'  '}
      INT {p.inteligencia ?? '-'}{'  '}
      SAB {p.sabiduria ?? '-'}{'  '}
      CAR {p.carisma ?? '-'}
    </p>
  );
}

// Contenido común para tooltip de PJ y EN
function TooltipContent({ data, estados }) {
  if (!data) return null;

  const nombre = data.nombre || data.name || 'Sin nombre';
  const descripcion =
    data.descripcion && String(data.descripcion).trim()
      ? data.descripcion
      : 'Sin descripción';

  return (
    <>
      {/* NOMBRE en verde */}
      <p style={{ color: '#4A6931', marginBottom: 4 }}>
        <strong>{nombre}</strong>
      </p>

      {/* DESCRIPCIÓN en blanco */}
      <p
        className="character-tooltip-desc"
        style={{ color: '#F8E9D0', marginBottom: 6 }}
      >
        {descripcion}
      </p>

      {/* RESISTENCIAS / DEBILIDADES / INMUNIDADES en amarillo + iconos */}
      {renderDamageRowCombat('Resistencias', data.resistencia)}
      {renderDamageRowCombat('Debilidades', data.debilidad)}
      {renderDamageRowCombat('Inmunidades', data.inmunidad)}

      {/* ESTADOS */}
      {renderEstadosCombat(estados)}

      {/* STATS */}
      {renderStatsLineCombat(data)}
    </>
  );
}

export default function CombatView({
  partidaId,
  combateId,
  initialCombate,
  initialActores,
  jugadores: jugadoresProp,
  onClose,
}) {
  if (!partidaId || !combateId) {
    return (
      <div className="combat-overlay-error">
        Error: CombatView requiere partidaId y combateId
      </div>
    );
  }

  const { user } = useContext(AuthContext);
  const jugadores = jugadoresProp || [];

  const initialOrden = normalizeOrden(
    initialCombate?.orden || initialCombate?.ordenIniciativa || []
  );
  const initialTurno = initialCombate?.turnoActual || null;
  const initialHp = initialCombate?.hpActual || {};

  const [combate] = useState(initialCombate || null);
  const [orden, setOrden] = useState(initialOrden || []);
  const [participants, setParticipants] = useState([]);
  const [turnoActual, setTurnoActual] = useState(initialTurno || null);
  const [hpActual, setHpActual] = useState(initialHp || {});
  const [hpMax, setHpMax] = useState(initialHp || {});
  const [selectedActor, setSelectedActor] = useState(null);
  const [myPersonajeId, setMyPersonajeId] = useState(null);
  const [myPersonaje, setMyPersonaje] = useState(null);
  const [actoresResueltos] = useState(initialActores || []);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const resolveName = useCallback(
    (id, tipoHint) =>
      getActorDisplayName(
        participants,
        orden,
        actoresResueltos,
        id,
        tipoHint
      ),
    [participants, orden, actoresResueltos]
  );

  // Mantener el banner de acción visible al menos 3s
  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => {
      setLastAction(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [lastAction]);

  // Listener de eventos de combate
  useEffect(() => {
    const handleCombatMessage = (event) => {
      try {
        const data = event.detail;
        if (String(data.combateId) !== String(combateId)) return;

        if (data.type === 'COMBAT_TURN_CHANGED') {
          const nuevoTurno = data.turnoActual || data.turno;
          if (nuevoTurno) {
            setTurnoActual(nuevoTurno);
          }
          if (data.hpActual) {
            setHpActual(data.hpActual);
          }
          if (data.orden) {
            setOrden(normalizeOrden(data.orden));
          }
        }

        if (data.type === 'COMBAT_ACTION') {
          // Actualizar HP local
          const hpPayload = data.hp || data.result?.hp;
          if (
            hpPayload &&
            hpPayload.objetivo != null &&
            hpPayload.despues != null
          ) {
            const objetivoTipo =
              hpPayload.objetivoTipo || (data.isAI ? 'PJ' : 'EN');
            const hpKey = `${objetivoTipo}:${hpPayload.objetivo}`;
            const objetivoId = hpPayload.objetivo;

            // Recargar personaje objetivo si es PJ (HP real)
            if (objetivoTipo === 'PJ' && objetivoId) {
              api
                .get(`/personaje/${objetivoId}`)
                .then((res) => {
                  const pjData =
                    res.data.personaje || res.data || null;
                  if (pjData) {
                    // Actualizar en participants
                    setParticipants((prev) =>
                      (prev || []).map((p) => {
                        if (
                          String(p.entidadId) ===
                            String(objetivoId) &&
                          String(p.tipo).toUpperCase() === 'PJ'
                        ) {
                          return { ...p, personaje: pjData };
                        }
                        return p;
                      })
                    );

                    // Si es mi PJ, actualizar también myPersonaje
                    if (
                      String(objetivoId) ===
                      String(selectedActor)
                    ) {
                      setMyPersonaje(pjData);
                    }
                  }
                })
                .catch((err) => {
                  console.error(
                    '[CombatView] Error recargando personaje objetivo:',
                    err
                  );
                });
            }

            setHpActual((prev) => ({
              ...(prev || {}),
              [hpKey]: hpPayload.despues,
            }));
          }

          // Recargar también el ACTOR si es PJ (recursos, acciones, etc.)
          const actorId = data.actorId;
          const actorTipo =
            data.actorTipo || (data.isAI ? 'EN' : 'PJ');

          if (
            actorId &&
            String(actorTipo).toUpperCase() === 'PJ'
          ) {
            api
              .get(`/personaje/${actorId}`)
              .then((res) => {
                const pjData =
                  res.data.personaje || res.data || null;
                if (!pjData) return;

                setParticipants((prev) =>
                  (prev || []).map((p) => {
                    if (
                      String(p.entidadId) ===
                        String(actorId) &&
                      String(p.tipo).toUpperCase() === 'PJ'
                    ) {
                      return { ...p, personaje: pjData };
                    }
                    return p;
                  })
                );

                // Si el actor soy yo, refrescar panel de acciones
                if (
                  String(actorId) === String(selectedActor)
                ) {
                  setMyPersonaje(pjData);
                }
              })
              .catch((err) => {
                console.error(
                  '[CombatView] Error recargando actor PJ:',
                  err
                );
              });
          }

          const summary = buildActionSummary(data, resolveName);
          setLastAction(summary);
        }

        if (data.type === 'COMBAT_TURN_UPDATED') {
          if (data.turnoActual) {
            setTurnoActual(data.turnoActual);
          }
        }

        if (data.type === 'COMBAT_ENDED') {
          setTimeout(() => {
            if (onClose) onClose();
          }, 3000);
        }
      } catch (e) {
        console.error(
          '[CombatView] Error procesando combat_message:',
          e
        );
      }
    };

    window.addEventListener('combat_message', handleCombatMessage);
    return () => {
      window.removeEventListener(
        'combat_message',
        handleCombatMessage
      );
    };
  }, [combateId, resolveName, onClose, myPersonajeId, selectedActor]);

  // Cargar datos participantes (PJ + EN con info completa)
  useEffect(() => {
    async function loadParticipants() {
      if (!orden || orden.length === 0) {
        setParticipants([]);
        return;
      }

      const out = [];

      for (const item of orden) {
        const tipo = String(item.tipo || '').toUpperCase();

        if (tipo === 'PJ') {
          try {
            const r = await api.get(`/personaje/${item.entidadId}`);
            const pj = r.data.personaje || r.data || null;
            out.push({ ...item, personaje: pj });
          } catch {
            out.push({
              ...item,
              personaje: { nombre: item.nombre },
            });
          }
        } else {
          // ENEMIGO — ¡OJO! ruta correcta /enemigos/:id
          try {
            const r = await api.get(`/enemigos/${item.entidadId}`);
            const enemigo = r.data.enemigo || r.data || null;

            if (enemigo) {
              out.push({ ...item, personaje: enemigo });
            } else {
              let nombre = item.nombre || null;

              if (!nombre && Array.isArray(actoresResueltos)) {
                const found = actoresResueltos.find(
                  (a) =>
                    String(a.tipo || '').toUpperCase() === 'EN' &&
                    (String(a.entidadId) === String(item.entidadId) ||
                      String(a.id) === String(item.entidadId))
                );
                if (found) nombre = found.nombre || found.name || null;
              }

              out.push({
                ...item,
                personaje: nombre ? { nombre } : null,
              });
            }
          } catch {
            // fallback si el GET falla
            let nombre = item.nombre || null;

            if (!nombre && Array.isArray(actoresResueltos)) {
              const found = actoresResueltos.find(
                (a) =>
                  String(a.tipo || '').toUpperCase() === 'EN' &&
                  (String(a.entidadId) === String(item.entidadId) ||
                    String(a.id) === String(item.entidadId))
              );
              if (found) nombre = found.nombre || found.name || null;
            }

            out.push({
              ...item,
              personaje: nombre ? { nombre } : null,
            });
          }
        }
      }

      setParticipants(out);

      // Inicializar HP máximo y actual
      const additions = [];
      for (const p of out) {
        const tipo = String(p.tipo || '').toUpperCase();
        const hpKey = `${tipo}:${p.entidadId}`;
        const maxHp =
          p.personaje?.puntosGolpe ??
          p.personaje?.hp ??
          (initialHp?.[hpKey] ?? 10);

        additions.push({ hpKey, maxHp });
      }

      setHpMax((prev) => {
        const copy = { ...(prev || {}) };
        for (const { hpKey, maxHp } of additions) {
          if (copy[hpKey] == null) {
            copy[hpKey] = maxHp;
          }
        }
        return copy;
      });

      setHpActual((prev) => {
        const copy = { ...(prev || {}) };
        for (const { hpKey, maxHp } of additions) {
          if (copy[hpKey] == null) {
            copy[hpKey] = maxHp;
          }
        }
        return copy;
      });
    }

    loadParticipants();
  }, [orden, actoresResueltos, initialHp]);

  // Resolver mi personaje
  useEffect(() => {
    async function loadPersonajeData(personajeId) {
      try {
        const res = await api.get(`/personaje/${personajeId}`);
        const pjData = res.data.personaje || res.data || null;
        setMyPersonaje(pjData);
      } catch (e) {
        console.error(
          '[CombatView] Error cargando personaje:',
          e
        );
      }
    }

    if (
      !user ||
      !orden ||
      orden.length === 0 ||
      !jugadores ||
      jugadores.length === 0
    ) {
      return;
    }

    const myJugador = jugadores.find(
      (j) => Number(j.id) === Number(user.id)
    );
    if (!myJugador) return;

    const personajeNombre = myJugador.selected_personaje?.nombre;
    if (!personajeNombre) return;

    setMyPersonajeId(personajeNombre);

    const myActor = (actoresResueltos || []).find(
      (actor) =>
        actor.tipo === 'PJ' &&
        String(actor.nombre).toLowerCase() ===
          String(personajeNombre).toLowerCase()
    );

    if (myActor && myActor.entidadId) {
      setSelectedActor(myActor.entidadId);
      loadPersonajeData(myActor.entidadId);
    }
  }, [user, jugadores, orden, actoresResueltos]);

  // Seleccionar actor PJ por defecto
  useEffect(() => {
    if (orden && orden.length && !selectedActor) {
      const ally = orden.find((o) => o.tipo === 'PJ');
      if (ally) setSelectedActor(ally.entidadId);
    }
  }, [orden, selectedActor]);

  const handleAction = async (accionId = null) => {
    if (!turnoActual) return alert('Turno no encontrado');
    if (!myPersonajeId)
      return alert('No se pudo resolver tu personaje');

    try {
      setLoading(true);
      const targetId = chooseTargetFromOrden(orden, hpActual);
      if (!targetId) {
        alert('No hay objetivo disponible');
        return;
      }

      const targetActor = orden.find(
        (o) => String(o.entidadId) === String(targetId)
      );
      const targetTipo = targetActor
        ? String(targetActor.tipo).toUpperCase()
        : 'PJ';

      const body = {
        userId: user?.id,
        personajeNombre: myPersonajeId,
        targetId,
        targetTipo,
      };

      if (accionId) body.accionId = accionId;

      await api.post(
        `/combate/${combateId}/turno/${turnoActual.id}/act`,
        body
      );
    } catch (e) {
      console.error('Error ejecutando acción', e);
      if (e?.response?.status === 401) {
        alert(
          'Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.'
        );
      } else {
        alert(
          e?.response?.data?.error ||
            'Error ejecutando acción'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsePotion = async (objetoId) => {
    if (!turnoActual) return alert('Turno no encontrado');
    if (!myPersonajeId)
      return alert('No se pudo resolver tu personaje');

    try {
      setLoading(true);
      const targetId =
        selectedActor || chooseTargetFromOrden(orden, hpActual);
      if (!targetId) {
        alert('No hay objetivo disponible');
        return;
      }

      const targetActor = orden.find(
        (o) => String(o.entidadId) === String(targetId)
      );
      const targetTipo = targetActor
        ? String(targetActor.tipo).toUpperCase()
        : 'PJ';

      const body = {
        userId: user?.id,
        personajeNombre: myPersonajeId,
        targetId,
        targetTipo,
        objetoId,
      };

      await api.post(
        `/combate/${combateId}/turno/${turnoActual.id}/act`,
        body
      );
    } catch (e) {
      console.error('Error usando poción', e);
      if (e?.response?.status === 401) {
        alert(
          'Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.'
        );
      } else {
        alert(
          e?.response?.data?.error ||
            'Error usando poción'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEndTurn = async () => {
    if (!turnoActual) return;

    try {
      setLoading(true);
      const body = {
        userId: user?.id,
        personajeNombre: myPersonajeId,
      };

      await api.post(
        `/combate/${combateId}/turno/${turnoActual.id}/end`,
        body
      );
    } catch (e) {
      console.error('Error finalizando turno', e);
      if (e?.response?.status === 401) {
        alert(
          'Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.'
        );
      } else {
        alert(
          e?.response?.data?.error ||
            'Error finalizando turno'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (!combate && !initialCombate) {
    return (
      <div className="combat-overlay-error">
        No hay datos de combate. Inicia un combate desde el mapa
        primero.
      </div>
    );
  }

  // ¿Es mi turno?
  let isMyTurn = false;
  let isEnemyTurn = false;
  let actorTurnName = '';

  if (turnoActual) {
    actorTurnName = getActorDisplayName(
      participants,
      orden,
      actoresResueltos,
      turnoActual.actorId,
      turnoActual.actorTipo
    );

    const myNameLower = (myPersonajeId || '').toLowerCase();
    const actorLower = (actorTurnName || '').toLowerCase();
    isMyTurn =
      !!myPersonajeId &&
      myNameLower &&
      actorLower &&
      myNameLower === actorLower;
    isEnemyTurn =
      String(turnoActual.actorTipo).toUpperCase() === 'EN';
  }

  // HP actual de mi personaje (desde DB)
  const myCurrentHP =
    myPersonaje?.puntosGolpeActual ??
    myPersonaje?.puntosGolpe ??
    0;

  // ¿está muerto?
  const isDead = myCurrentHP <= 0;

  // ¿se usó ya una acción extra este turno?
  const usedExtraAction = !!turnoActual?.seHizoAccionExtra;

  // Deshabilitado global: no es mi turno, es enemigo o está cargando
  const globalDisabled =
    loading || !isMyTurn || isEnemyTurn;

  // Acciones del personaje
  const accionesPersonaje =
    myPersonaje?.accionesObtenidas || [];

  const armaEquipada =
    Array.isArray(myPersonaje?.equipArma) &&
    myPersonaje.equipArma.length > 0
      ? myPersonaje.equipArma[0]
      : null;

  const nombreArma =
    armaEquipada?.nombre || armaEquipada?.name || 'Arma';

  const basicAttackName = armaEquipada
    ? `Ataque con ${nombreArma}`
    : 'Ataque básico';

  const claseNombre = myPersonaje?.clase || '';
  const claseIconName = claseNombre
    ? `${claseNombre.charAt(0).toUpperCase()}${claseNombre
        .slice(1)
        .toLowerCase()}`
    : 'Clase';

  const nivelIcon = (n) => `/src/assets/combate/Nivel%20${n}.png`;

  // Slots de acción
  const actionSlots = [
    {
      id: 1,
      icon: '/src/assets/combate/Ataque.png',
      title: basicAttackName,
      habilidadNombre: basicAttackName,
      type: 'basic',
      actionData: null,
    },
    {
      id: 2,
      icon: `/src/assets/combate/${claseIconName}.png`,
      title: accionesPersonaje[0]?.nombre || 'Acción secundaria',
      habilidadNombre: accionesPersonaje[0]?.nombre || null,
      type: 'ability',
      actionData: accionesPersonaje[0] || null,
    },
    {
      id: 3,
      icon: nivelIcon(1),
      title: accionesPersonaje[1]?.nombre || 'Habilidad I',
      habilidadNombre: accionesPersonaje[1]?.nombre || null,
      type: 'ability',
      actionData: accionesPersonaje[1] || null,
    },
    {
      id: 4,
      icon: nivelIcon(2),
      title: accionesPersonaje[2]?.nombre || 'Habilidad II',
      habilidadNombre: accionesPersonaje[2]?.nombre || null,
      type: 'ability',
      actionData: accionesPersonaje[2] || null,
    },
    {
      id: 5,
      icon: nivelIcon(3),
      title: accionesPersonaje[3]?.nombre || 'Habilidad III',
      habilidadNombre: accionesPersonaje[3]?.nombre || null,
      type: 'ability',
      actionData: accionesPersonaje[3] || null,
    },
    {
      id: 6,
      icon: nivelIcon(4),
      title: accionesPersonaje[4]?.nombre || 'Habilidad IV',
      habilidadNombre: accionesPersonaje[4]?.nombre || null,
      type: 'ability',
      actionData: accionesPersonaje[4] || null,
    },
  ];

  // ¿Se puede usar ese slot?
  const canUseSlot = (slot) => {
    if (globalDisabled) return false;
    if (!myPersonaje) return false;
    if (myCurrentHP <= 0) return false;

    // Acción básica: consume 1 acción principal
    if (slot.type === 'basic') {
      const accionesDisponibles = myPersonaje.accion ?? 0;
      if (turnoActual?.seHizoAccion) return false;
      return accionesDisponibles > 0;
    }

    const actionData = slot.actionData;
    if (!actionData) return false;

    const pj = myPersonaje;

    const reqRecurso = actionData.recurso ?? 0;
    const reqAccion = actionData.accion ?? 0;
    const reqAccionExtra = actionData.accionExtra ?? 0;
    const reqPA1 = actionData.puntosAccionNivel1 ?? 0;
    const reqPA2 = actionData.puntosAccionNivel2 ?? 0;
    const reqPA3 = actionData.puntosAccionNivel3 ?? 0;
    const reqPA4 = actionData.puntosAccionNivel4 ?? 0;

    const pjRecurso = pj.recurso ?? 0;
    const pjAccion = pj.accion ?? 0;
    const pjAccionExtra = pj.accionExtra ?? 0;
    const pjPA1 = pj.puntosAccionNivel1 ?? 0;
    const pjPA2 = pj.puntosAccionNivel2 ?? 0;
    const pjPA3 = pj.puntosAccionNivel3 ?? 0;
    const pjPA4 = pj.puntosAccionNivel4 ?? 0;

    if (turnoActual?.seHizoAccion && reqAccion > 0) {
      return false;
    }

    if (pjRecurso < reqRecurso) return false;
    if (pjAccion < reqAccion) return false;
    if (pjAccionExtra < reqAccionExtra) return false;
    if (pjPA1 < reqPA1) return false;
    if (pjPA2 < reqPA2) return false;
    if (pjPA3 < reqPA3) return false;
    if (pjPA4 < reqPA4) return false;

    return true;
  };

  // Pociones deshabilitadas si: globalDisabled, HP <= 0, o ya usó acción extra
  const potionsDisabled =
    globalDisabled || myCurrentHP <= 0 || usedExtraAction;

  // Party (máx 4) y orden escalonado
  const partyActorsRaw = (orden || [])
    .filter((o) => String(o.tipo).toUpperCase() === 'PJ')
    .slice(0, 4);

  let partyActors = partyActorsRaw;

  if (
    turnoActual &&
    String(turnoActual.actorTipo).toUpperCase() === 'PJ'
  ) {
    const idx = partyActorsRaw.findIndex(
      (p) =>
        Number(p.entidadId) === Number(turnoActual.actorId)
    );
    if (idx >= 0) {
      // El que tiene el turno va al final (lado derecho)
      partyActors = [
        ...partyActorsRaw.slice(idx + 1),
        ...partyActorsRaw.slice(0, idx + 1),
      ];
    }
  }

  // Enemigo principal
  const mainEnemy =
    (orden || []).find(
      (o) => String(o.tipo).toUpperCase() === 'EN'
    ) || null;

  const mainEnemyName = mainEnemy
    ? getActorDisplayName(
        participants,
        orden,
        actoresResueltos,
        mainEnemy.entidadId,
        'EN'
      )
    : '';

  const mainEnemyHpKey = mainEnemy
    ? `EN:${mainEnemy.entidadId}`
    : null;
  const mainEnemyHP =
    mainEnemyHpKey && hpActual
      ? hpActual[mainEnemyHpKey] ?? 0
      : 0;
  const mainEnemyMaxHP =
    mainEnemyHpKey && hpMax
      ? hpMax[mainEnemyHpKey] ?? (mainEnemyHP || 1)
      : 1;

  const enemyParticipant = mainEnemy
    ? (participants || []).find(
        (p) =>
          String(p.entidadId) ===
            String(mainEnemy.entidadId) &&
          String(p.tipo).toUpperCase() === 'EN'
      )
    : null;

  const enemyExtra = mainEnemy
    ? (actoresResueltos || []).find(
        (a) =>
          String(a.tipo || '').toUpperCase() === 'EN' &&
          String(a.entidadId ?? a.id) ===
            String(mainEnemy.entidadId)
      )
    : null;

  const enemyInfo =
    enemyParticipant?.personaje || enemyExtra || {};
  const enemyEstadosActivos =
    enemyParticipant?.estadosActivos ||
    enemyInfo.estadosActivos ||
    enemyInfo.estadosSnapshot ||
    [];

  return (
    <div className="combat-overlay">
      {/* overflowY visible para que los popups no creen scroll ni se corten */}
      <div className="combat-modal" style={{ overflowY: 'visible' }}>
        {/* Carteles superiores (verde, amarillo, blanco) */}
        <div className="combat-log-strip">
          <div className="combat-turn-banner">
            {actorTurnName ? (
              <>
                <span className="combat-turn-banner-label">
                  Es el turno de
                </span>
                <span className="combat-turn-banner-name">
                  {formatName(actorTurnName)}
                </span>
              </>
            ) : (
              <span className="combat-turn-banner-label">
                Esperando turno...
              </span>
            )}
          </div>

          <div className="combat-action-banner">
            {lastAction ? lastAction.headerYellow : ''}
          </div>

          <div className="combat-detail-banner">
            {lastAction ? lastAction.detalle : ''}
          </div>
        </div>

        {/* Panel aliados vs enemigo */}
        <div className="combat-layout">
          {/* Aliados */}
          <div className="combat-party-panel">
            <div className="combat-entities-row">
              {partyActors.length === 0 && (
                <span className="combat-empty-text">
                  Sin personajes
                </span>
              )}

              {partyActors.map((o) => {
                const pjName = getActorDisplayName(
                  participants,
                  orden,
                  actoresResueltos,
                  o.entidadId,
                  'PJ'
                );

                const participant = (participants || []).find(
                  (p) =>
                    String(p.entidadId) ===
                      String(o.entidadId) &&
                    String(p.tipo).toUpperCase() === 'PJ'
                );
                const pj = participant?.personaje || {};

                // Usamos puntosGolpeActual (o PG total si no existe)
                const currentHP =
                  pj.puntosGolpeActual ??
                  pj.puntosGolpe ??
                  0;
                const maxHP = pj.puntosGolpe ?? (currentHP || 1);
                const pct =
                  maxHP > 0
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          (currentHP / maxHP) * 100
                        )
                      )
                    : 0;

                const spriteSrc = pjName
                  ? `/src/assets/personajes/${pjName}.png`
                  : null;

                const estadosActivos =
                  participant?.estadosActivos ||
                  pj.estadosActivos ||
                  pj.estadosSnapshot ||
                  [];

                return (
                  <div
                    key={`pj-${o.entidadId}`}
                    className="combat-entity"
                  >
                    <div className="combat-entity-sprite">
                      {spriteSrc ? (
                        <img
                          src={spriteSrc}
                          alt={pjName}
                          className="combat-entity-img"
                        />
                      ) : (
                        <span className="combat-portrait-empty">
                          ?
                        </span>
                      )}
                    </div>

                    <div className="combat-entity-name">
                      {formatName(pjName)}
                    </div>

                    <div className="combat-hpbar">
                      <div
                        className="combat-hpbar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="combat-hptext">
                      {currentHP} / {maxHP}
                    </div>

                    {/* Tooltip de personaje (modelo unificado) */}
                    <div className="character-tooltip">
                      <TooltipContent
                        data={pj}
                        estados={estadosActivos}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enemigo */}
          <div className="combat-enemy-panel">
            {mainEnemy ? (
              <div className="combat-entity combat-entity--enemy">
                <div className="combat-entity-sprite">
                  {mainEnemyName ? (
                    <img
                      src={`/src/assets/enemigos/${mainEnemyName}.gif`}
                      alt={mainEnemyName}
                      className="combat-entity-img"
                    />
                  ) : (
                    <div className="combat-portrait-empty">
                      EN
                    </div>
                  )}
                </div>

                <div className="combat-entity-name">
                  {mainEnemyName}
                </div>

                <div className="combat-hpbar">
                  <div
                    className="combat-hpbar-fill"
                    style={{
                      width: `${
                        mainEnemyMaxHP > 0
                          ? Math.max(
                              0,
                              Math.min(
                                100,
                                (mainEnemyHP /
                                  mainEnemyMaxHP) *
                                  100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="combat-hptext">
                  {mainEnemyHP} / {mainEnemyMaxHP}
                </div>

                {/* Tooltip enemigo (a la IZQUIERDA, con info de modelo Enemigo) */}
                <div className="character-tooltip character-tooltip--enemy">
                  <TooltipContent
                    data={enemyInfo}
                    estados={enemyEstadosActivos}
                  />
                </div>
              </div>
            ) : (
              <div className="combat-enemy-empty">
                Sin enemigo
              </div>
            )}
          </div>
        </div>

        {/* Barra de acciones inferior */}
        <div className="combat-actions-bar">
          <div className="combat-actions-main">
            {/* Panel habilidades */}
            <div className="combat-actions-panel">
              <div className="combat-panel-title">
                Acciones
              </div>

              <div className="combat-actions-row">
                {actionSlots.map((slot) => {
                  const slotEnabled = canUseSlot(slot);
                  const actionData = slot.actionData;

                  // Datos tooltip de acción
                  const tooltipName = slot.habilidadNombre || slot.title;
                  const tooltipDesc =
                    actionData?.descripcion ||
                    (slot.type === 'basic'
                      ? `Ataque básico con ${nombreArma}`
                      : '');
                  const tooltipDanio =
                    (slot.type === 'basic' &&
                      armaEquipada?.danio) ||
                    actionData?.danio ||
                    null;
                  const tooltipTipoDanio =
                    (slot.type === 'basic' &&
                      armaEquipada?.tipoDanio) ||
                    actionData?.tipoDanio ||
                    null;
                  const tooltipPG =
                    typeof actionData?.puntosGolpe === 'number' &&
                    actionData.puntosGolpe !== 0
                      ? actionData.puntosGolpe
                      : null;

                  const tooltipEstados =
                    Array.isArray(actionData?.estados) &&
                    actionData.estados.length
                      ? actionData.estados
                      : [];

                  const tipoDanioIcon = tooltipTipoDanio
                    ? getDamageIconPath(tooltipTipoDanio)
                    : null;

                  return (
                    <button
                      key={slot.id}
                      className={
                        'combat-action-button' +
                        (!slotEnabled ? ' is-disabled' : '')
                      }
                      disabled={!slotEnabled}
                      onClick={() => {
                        if (!slotEnabled) return;
                        handleAction(slot.id);
                      }}
                    >
                      {slot.icon ? (
                        <img
                          src={slot.icon}
                          alt={slot.title}
                          className="combat-action-icon"
                        />
                      ) : (
                        <span className="combat-action-placeholder">
                          ?
                        </span>
                      )}

                      {/* Tooltip acción */}
                      <div className="combat-action-tooltip">
                        <div
                          className="combat-tooltip-title"
                          style={{ color: '#4A6931' }}
                        >
                          {tooltipName}
                        </div>

                        {tooltipDesc && (
                          <div
                            className="combat-tooltip-desc"
                            style={{ color: '#F8E9D0' }}
                          >
                            {tooltipDesc}
                          </div>
                        )}

                        {tooltipDanio && (
                          <p style={{ color: '#C0A66C' }}>
                            <span className="combat-tooltip-label">
                              Daño:
                            </span>{' '}
                            <span className="combat-tooltip-value">
                              {tooltipDanio}
                            </span>
                          </p>
                        )}

                        {tooltipTipoDanio && tipoDanioIcon && (
                          <div className="character-tooltip-damage-row">
                            <span
                              className="combat-tooltip-label"
                              style={{ color: '#C0A66C' }}
                            >
                              Tipo:
                            </span>
                            <div className="character-tooltip-damage-icons">
                              <span className="damage-icon-wrap">
                                <img
                                  src={tipoDanioIcon}
                                  alt={tooltipTipoDanio}
                                  className="inventory-tooltip-damage-icon"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </span>
                            </div>
                          </div>
                        )}

                        {tooltipPG && (
                          <p style={{ color: '#C0A66C' }}>
                            <span className="combat-tooltip-label">
                              Puntos de golpe:
                            </span>{' '}
                            <span className="combat-tooltip-value">
                              {tooltipPG > 0
                                ? `+${tooltipPG}`
                                : tooltipPG}
                            </span>
                          </p>
                        )}

                        {tooltipEstados.length > 0 && (
                          <div className="combat-tooltip-states">
                            <span
                              className="combat-tooltip-label"
                              style={{ color: '#C0A66C' }}
                            >
                              Estados:
                            </span>
                            <ul>
                              {tooltipEstados.map((e, idx) => (
                                <li
                                  key={e.id || e.nombre || idx}
                                  style={{ color: '#C0A66C' }}
                                >
                                  {e.nombre || 'Estado'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel pociones */}
            <PotionsPanel
              personaje={myPersonaje}
              disabled={potionsDisabled}
              onUsePotion={handleUsePotion}
            />
          </div>

          {/* Botón fin de turno */}
          <button
            className="combat-endturn-button"
            onClick={handleEndTurn}
            disabled={loading || !isMyTurn || isEnemyTurn}
            title="Finalizar turno"
          >
            {isDead ? 'Pasar turno' : 'Fin turno'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PotionsPanel({ personaje, disabled, onUsePotion }) {
  const inventario = personaje?.inventario || [];
  const potions = inventario.filter(isPotion);

  return (
    <div
      className="combat-inventory-panel"
      style={{ overflow: 'visible' }} // para que el tooltip pueda salir
    >
      <div className="combat-panel-title">Pociones</div>
      <div
        className="combat-inventory-list"
        style={{ overflowX: 'auto', overflowY: 'visible' }}
      >
        {potions.length === 0 ? (
          <div className="combat-inventory-empty">
            Sin pociones
          </div>
        ) : (
          potions.map((it, idx) => {
            const objetoId = it.objetoId ?? it.id;
            const nombreObjeto =
              it.nombre ||
              it.objeto?.nombre ||
              'Poción';
            const cantidad = it.cantidad ?? 1;
            const desc =
              it.descripcion ||
              it.objeto?.descripcion ||
              '';

            const danio =
              it.danio || it.objeto?.danio || null;
            const tipoDanio =
              it.tipoDanio || it.objeto?.tipoDanio || null;
            const pg =
              typeof it.puntosGolpe === 'number'
                ? it.puntosGolpe
                : it.objeto?.puntosGolpe || 0;

            const estados =
              (Array.isArray(it.estados) && it.estados) ||
              (Array.isArray(it.objeto?.estados) &&
                it.objeto.estados) ||
              [];

            const tipoDanioIcon = tipoDanio
              ? getDamageIconPath(tipoDanio)
              : null;

            return (
              <div
                key={objetoId ?? idx}
                className="combat-inventory-item"
                onClick={() => {
                  if (!disabled && objetoId != null) {
                    onUsePotion(objetoId);
                  }
                }}
              >
                <span className="combat-potion-icon-wrapper">
                  <img
                    src={`/src/assets/objetos/${nombreObjeto}.png`}
                    alt={nombreObjeto || 'Poción'}
                    className="combat-potion-icon"
                    style={
                      disabled
                        ? { filter: 'grayscale(100%)', opacity: 0.5 }
                        : undefined
                    }
                    onError={(e) => {
                      e.currentTarget.style.display =
                        'none';
                    }}
                  />
                </span>

                {/* Tooltip poción con mismo estilo: nombre verde, desc blanca, resto amarillo */}
                <div className="combat-action-tooltip">
                  {/* Nombre */}
                  <div
                    className="combat-tooltip-title"
                    style={{ color: '#4A6931' }}
                  >
                    <strong>{nombreObjeto}</strong> (x{cantidad})
                  </div>

                  {/* Descripción */}
                  {desc && (
                    <div
                      className="combat-tooltip-desc"
                      style={{ color: '#F8E9D0' }}
                    >
                      {desc}
                    </div>
                  )}

                  {/* Daño numérico */}
                  {danio && (
                    <p style={{ color: '#C0A66C' }}>
                      <span className="combat-tooltip-label">
                        Daño:
                      </span>{' '}
                      <span className="combat-tooltip-value">
                        {danio}
                      </span>
                    </p>
                  )}

                  {/* Tipo de daño con icono */}
                  {tipoDanio && tipoDanioIcon && (
                    <div className="character-tooltip-damage-row">
                      <span
                        className="combat-tooltip-label"
                        style={{ color: '#C0A66C' }}
                      >
                        Tipo:
                      </span>
                      <div className="character-tooltip-damage-icons">
                        <span className="damage-icon-wrap">
                          <img
                            src={tipoDanioIcon}
                            alt={tipoDanio}
                            className="inventory-tooltip-damage-icon"
                            onError={(e) => {
                              e.currentTarget.style.display =
                                'none';
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Curación / PG */}
                  {pg !== 0 && (
                    <p style={{ color: '#C0A66C' }}>
                      <span className="combat-tooltip-label">
                        Puntos de golpe:
                      </span>{' '}
                      <span className="combat-tooltip-value">
                        {pg > 0 ? `+${pg}` : pg}
                      </span>
                    </p>
                  )}

                  {/* Estados que aplica la poción */}
                  {Array.isArray(estados) && estados.length > 0 && (
                    <div className="combat-tooltip-states">
                      <span
                        className="combat-tooltip-label"
                        style={{ color: '#C0A66C' }}
                      >
                        Estados:
                      </span>
                      <ul>
                        {estados.map((e, i) => (
                          <li
                            key={e.id || e.nombre || i}
                            style={{ color: '#C0A66C' }}
                          >
                            {e.nombre || 'Estado'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}