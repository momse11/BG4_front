import React, { useEffect, useState, useContext, useMemo } from 'react';
import api from '../../utils/api';
import useCombateWS from '../hooks/useCombateWS';
import { AuthContext } from '../../auth/AuthProvider';
import { usePartidaWS } from '../../utils/ws';

// Normaliza y elimina duplicados en una lista de actores
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
    // garantizar shape esperado
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

function HpBar({ current, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  return (
    <div style={{ width: 140, background: '#222', border: '1px solid #444', height: 12, borderRadius: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#e33', borderRadius: 6 }} />
    </div>
  );
}

export default function CombatView({ 
  partidaId, 
  combateId, 
  initialCombate, 
  initialActores,
  jugadores: jugadoresProp, // 🔥 Recibir jugadores desde MapView
  onClose 
}) {
  // CombatView ahora SOLO funciona como overlay - requiere props
  if (!partidaId || !combateId) {
    return <div style={{ color: 'white', padding: 20 }}>Error: CombatView requiere partidaId y combateId</div>;
  }
  
  const { user } = useContext(AuthContext);
  
  // 🔥 Usar jugadores de props (vienen de MapView que tiene el WebSocket activo)
  const jugadores = jugadoresProp || [];
  
  // 🔥 Debug: Log cuando cambian los jugadores
  useEffect(() => {
    console.log('[CombatView] 🔄 jugadores desde props:', jugadores?.length, jugadores?.map(j => ({ id: j.id, personaje_db_id: j.selected_personaje_db_id })));
  }, [jugadores]);
  
  // Inicializar estado desde props (initialCombate siempre viene del overlay)
  const initialOrden = normalizeOrden(initialCombate?.orden || initialCombate?.ordenIniciativa || []);
  const initialTurno = initialCombate?.turnoActual || null;
  const initialHp = initialCombate?.hpActual || {};
  
  if (initialTurno) {
    console.log('[CombatView] 🔥 turnoActual recibido:', JSON.stringify(initialTurno));
  }
  console.log('[CombatView] 🔥 orden inicial:', JSON.stringify(initialOrden.map(o => ({ tipo: o.tipo, entidadId: o.entidadId }))));

  const [combate, setCombate] = useState(initialCombate || null);
  const [orden, setOrden] = useState(initialOrden || []);
  const [participants, setParticipants] = useState([]); // fetched personaje data
  const [turnoActual, setTurnoActual] = useState(initialTurno || null);
  const [hpActual, setHpActual] = useState(initialHp || {});
  const [selectedActor, setSelectedActor] = useState(null);
  const [myPersonajeId, setMyPersonajeId] = useState(null); // 🔥 ID del personaje del jugador actual
  const [myPersonaje, setMyPersonaje] = useState(null); // 🔥 Datos completos del personaje del jugador actual
  const [loading, setLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(true);
  const [debugActors, setDebugActors] = useState(initialActores || []);
  const [hydrated, setHydrated] = useState(true); // Ya está hidratado desde props

  // Escuchar eventos de combate vía WebSocket
  useCombateWS(partidaId, (event) => {
    try {
      console.debug('[CombatView] WS event:', event.type, event);
      
      if (event.type === 'COMBAT_TURN_CHANGED' && String(event.combateId) === String(combateId)) {
        // Actualizar turno actual y HP cuando cambia el turno
        if (event.turnoActual || event.turno) {
          setTurnoActual(event.turnoActual || event.turno);
        }
        if (event.hpActual) {
          setHpActual(event.hpActual);
        }
        console.log('[CombatView] Turno cambiado:', event.turnoActual || event.turno);
      }
      
      if (event.type === 'COMBAT_ACTION' && String(event.combateId) === String(combateId)) {
        // Actualizar HP cuando hay una acción (especialmente ataques de IA)
        if (event.result?.hp) {
          setHpActual((prev) => ({
            ...prev,
            [event.result.hp.objetivo]: event.result.hp.despues,
          }));
        }
        console.log('[CombatView] Acción de combate:', event.isAI ? 'IA' : 'Jugador', event.result);
      }
      
      if (event.type === 'COMBAT_ENDED' && String(event.combateId) === String(combateId)) {
        // Navegar a victoria/derrota
        const resultado = event.resultado || 'victoria';
        if (resultado === 'victoria') {
          navigate(`/partida/${partidaId}/victory`, { state: { combateId } });
        } else {
          navigate(`/partida/${partidaId}/defeat`, { state: { combateId } });
        }
      }
    } catch (e) {
      console.error('[CombatView] Error procesando evento WS:', e);
    }
  });

    // Si el WS guardó payload del combate en sessionStorage, úsalo al montar
  useEffect(() => {
    // REMOVIDO: Ya no cargamos desde localStorage ni BroadcastChannel
    // CombatView siempre recibe initialCombate desde MapView via props
    console.debug('[CombatView] Inicializado con combate:', combateId);
  }, [combateId]);

  useEffect(() => {
    // si no tenemos payload inicial, intentar cargar vía API (no implementado en backend)
    if (!combate && !initial) {
      console.warn('No hay datos de combate en state; intenta abrir desde la creación del combate.');
    }
    // si tenemos orden, intentar cargar datos de personajes para mostrar sprites/retratos/inventario
    async function loadParticipants() {
      if (!orden || orden.length === 0) {
        setParticipants([]);
        return;
      }
      const out = [];
      for (const item of orden) {
        try {
          const tipo = String(item.tipo || '').toUpperCase();
          if (tipo === 'PJ') {
            const r = await api.get(`/personaje/${item.entidadId}`);
            const pj = r.data.personaje || r.data || null;
            out.push({ ...item, personaje: pj });
          } else {
            // EN: intentar obtener nombre desde debugActors (actores resueltos enviados por backend)
            let nombre = item.nombre || null;
            if (!nombre && Array.isArray(debugActors)) {
              const found = debugActors.find(a => String(a.entidadId) === String(item.entidadId) || String(a.id) === String(item.entidadId));
              if (found) nombre = found.nombre || found.name || null;
            }
            out.push({ ...item, personaje: nombre ? { nombre } : null });
          }
        } catch (e) {
          console.warn('No se pudo cargar personaje', item.entidadId, e);
          out.push({ ...item, personaje: null });
        }
      }
      setParticipants(out);
      // Asegurar hpActual para PJ: si faltan valores, inicializar con puntos de golpe máximos
      try {
        setHpActual((prev) => {
          const copy = { ...(prev || {}) };
          for (const p of out) {
            try {
              if (String((p || {}).tipo || '').toUpperCase() === 'PJ') {
                const id = String(p.entidadId);
                if (copy[id] == null) {
                  const maxHp = p.personaje?.puntosGolpe ?? p.personaje?.hp ?? 10;
                  copy[id] = maxHp;
                }
              }
            } catch (e) { /* noop */ }
          }
          return copy;
        });
      } catch (e) { /* noop */ }
    }

    loadParticipants();
  }, [orden, combate]);

  // efecto para sincronizar debugActors cuando se actualiza la navigation state
  useEffect(() => {
    if (location.state?.actores) setDebugActors(location.state.actores);
  }, [location.state]);

  // 🔥 Identificar mi personaje usando los datos del WebSocket (jugadores) o debugActors
  useEffect(() => {
    console.log('[CombatView] useEffect resolver personaje - user:', user?.id, 'jugadores:', jugadores?.length, 'orden:', orden?.length, 'debugActors:', debugActors?.length);
    
    if (!user || !orden || orden.length === 0) {
      console.warn('[CombatView] Falta user o orden para resolver personaje');
      return;
    }
    
    let resolvedPersonajeId = null;
    let mySlot = null;
    
    // MÉTODO 1: Usar WebSocket jugadores si está disponible
    if (jugadores && jugadores.length > 0) {
      mySlot = jugadores.find(j => Number(j.id) === Number(user.id));
      
      if (mySlot) {
        console.log('[CombatView] 🔍 mySlot desde WS:', JSON.stringify(mySlot));
        
        if (mySlot.selected_personaje_db_id) {
          resolvedPersonajeId = mySlot.selected_personaje_db_id;
          console.log('[CombatView] ✅ Personaje desde jugadores WS (db_id):', resolvedPersonajeId);
        }
      }
    }
    
    // MÉTODO 2: Si no hay WS jugadores, intentar match por posición en orden
    // Los personajes se crean en el mismo orden que aparecen en la partida
    // Necesitamos obtener "mi personaje" de alguna forma sin WS
    if (!resolvedPersonajeId && (!jugadores || jugadores.length === 0)) {
      // Estrategia alternativa: Buscar en orden el primer PJ que coincida con el turno actual si soy yo
      // O simplemente esperar a que lleguen los jugadores (debería ser < 1 segundo)
      console.warn('[CombatView] 🕐 Esperando jugadores del WebSocket... (debugActors:', debugActors?.length, ')');
      
      // TEMPORAL: Si tenemos debugActors, buscar por input.entidadId
      // debugActors tiene: { input: { tipo, entidadId }, tipo, entidadId, nombre }
      // El input.entidadId es el personaje original que matchea con Usuario.selected_personaje_id
      if (debugActors && debugActors.length > 0) {
        console.log('[CombatView] 🔍 Intentando match con debugActors:', debugActors);
        console.log('[CombatView] 🔍 Mi user.id:', user.id);
        
        // Buscar el actor cuyo input.entidadId matchea con algún patrón conocido
        // Por ahora, usar orden basado en entidadId (menor = primer usuario)
        const pjActors = debugActors.filter(a => a.tipo === 'PJ').sort((a, b) => {
          // Ordenar por el ID del personaje original (input.entidadId)
          const aInput = a.input?.entidadId || a.entidadId;
          const bInput = b.input?.entidadId || b.entidadId;
          return aInput - bInput;
        });
        
        console.log('[CombatView] 🔍 PJ Actors ordenados:', pjActors.map(a => ({ 
          entidadId: a.entidadId, 
          inputId: a.input?.entidadId, 
          nombre: a.nombre 
        })));
        
        // Buscar el mínimo user.id en la partida y calcular offset
        // Si los users son [5, 6, 7, 8], el offset es 5
        // Entonces user 5 → índice 0, user 6 → índice 1, etc.
        const userIndex = user.id - Math.min(...[user.id]); // Por ahora asumir que es secuencial
        
        // Mejor: usar el índice directo asumiendo que debugActors está en el orden correcto
        if (pjActors.length > 0) {
          // Simplemente tomar el actor que corresponda al orden
          // Como no sabemos el mapeo exacto, usamos una heurística: el primer PJ en orden es el primer usuario
          // Esto es temporal hasta que el backend incluya userId en actoresResueltos
          
          // Por ahora, encontrar cuál de los pjActors tiene entidadId que matchea con un patrón
          // Dado que user.id = 5 y personajes son 11-14, podemos intentar encontrar por nombre
          // O simplemente usar el primer PJ disponible como el del usuario actual
          
          // HACK TEMPORAL: Asumir que el primer actor en orden es el que tiene el turno
          // y si user.id matchea con algún patrón, usar ese
          resolvedPersonajeId = pjActors[0]?.entidadId; // Placeholder
          console.log('[CombatView] 🔶 TEMPORAL: Usando primer PJ como fallback:', resolvedPersonajeId);
          
          // Mejor: No adivinar, simplemente esperar a que lleguen los jugadores
          resolvedPersonajeId = null;
        }
      }
      
      if (!resolvedPersonajeId) {
        return; // Esperar próximo render cuando lleguen jugadores
      }
    }
    
    // MÉTODO 3: Buscar por nombre en debugActors
    if (!resolvedPersonajeId && mySlot?.selected_personaje?.nombre && debugActors && debugActors.length > 0) {
      const actorMatch = debugActors.find(a => 
        a.tipo === 'PJ' && 
        a.nombre?.toLowerCase() === mySlot.selected_personaje.nombre.toLowerCase()
      );
      
      if (actorMatch?.entidadId) {
        resolvedPersonajeId = actorMatch.entidadId;
        console.log('[CombatView] ✅ Personaje desde debugActors (por nombre):', resolvedPersonajeId);
      }
    }
    
    // MÉTODO 4: Buscar directamente en orden por nombre
    if (!resolvedPersonajeId && mySlot?.selected_personaje?.nombre) {
      const pjEnOrden = orden.find(o => 
        o.tipo === 'PJ' && 
        o.nombre?.toLowerCase() === mySlot.selected_personaje.nombre.toLowerCase()
      );
      
      if (pjEnOrden?.entidadId) {
        resolvedPersonajeId = pjEnOrden.entidadId;
        console.log('[CombatView] ✅ Personaje desde orden (por nombre):', resolvedPersonajeId);
      }
    }
    
    // Si aún no se pudo resolver
    if (!resolvedPersonajeId) {
      console.error('[CombatView] ❌ No pude resolver personajeId con ningún método');
      return;
    }
    
    console.log('[CombatView] ✅ Mi personajeId resuelto:', resolvedPersonajeId);
    setMyPersonajeId(resolvedPersonajeId);
    setSelectedActor(resolvedPersonajeId);
    loadPersonajeData(resolvedPersonajeId);
    
    async function loadPersonajeData(personajeId) {
      try {
        const res = await api.get(`/personaje/${personajeId}`);
        const pjData = res.data.personaje || res.data || null;
        setMyPersonaje(pjData);
        console.log('[CombatView] Personaje cargado:', pjData?.nombre);
        console.log('[CombatView] Acciones:', pjData?.accionesObtenidas?.map(a => a.nombre).join(', '));
      } catch (e) {
        console.error('[CombatView] Error cargando personaje:', e);
      }
    }
  }, [user, jugadores, orden, debugActors]);

  useEffect(() => {
    // seleccionar actor activo por defecto (primer aliado del orden que sea tipo PJ)
    if (orden && orden.length && !selectedActor) {
      const ally = orden.find((o) => o.tipo === 'PJ');
      if (ally) setSelectedActor(ally.entidadId);
    }
  }, [orden]);

  const getActorById = (id) => {
    const found = orden.find((o) => String(o.entidadId) === String(id));
    return found || null;
  };

  const handleAction = async (accionId = null, objetoId = null, targetId = null) => {
    if (!turnoActual) return alert('Turno no encontrado');
    if (!selectedActor) return alert('Selecciona un actor');
    try {
      setLoading(true);
      const body = { actorId: selectedActor, targetId };
      if (accionId) body.accionId = accionId;
      if (objetoId) body.objetoId = objetoId;
      const res = await api.post(`/combate/${combateId}/turno/${turnoActual.id}/act`, body);
      const data = res.data;
      // actualizar HP local si el backend devolvió hp
      if (data?.hp && data.hp.objetivo != null) {
        setHpActual((prev) => ({ ...prev, [data.hp.objetivo]: data.hp.despues }));
      }
      // mostrar estados aplicados (simple console por ahora)
      if (data?.estadosAplicados) console.debug('Estados aplicados', data.estadosAplicados);
    } catch (e) {
      console.error('Error ejecutando acción', e);
      if (e?.response?.status === 401) {
        alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
      } else {
        alert(e?.response?.data?.error || 'Error ejecutando acción');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEndTurn = async () => {
    if (!turnoActual) return;
    try {
      setLoading(true);
      // 🔥 Enviar actorId para validación en backend
      const body = { actorId: turnoActual.actorId };
      const res = await api.post(`/combate/${combateId}/turno/${turnoActual.id}/end`, body);
      const nxt = res.data?.turno || null;
      const ronda = res.data?.ronda;
      const idxActual = res.data?.idxActual;
      if (res.data?.fin) {
        // Combate finalizado
        const winner = determineWinner();
        if (winner === 'victory') navigate(`/partida/${partidaId}/victory`, { state: { combateId } });
        else navigate(`/partida/${partidaId}/defeat`, { state: { combateId } });
        return;
      }
      if (nxt) setTurnoActual(nxt);
    } catch (e) {
      console.error('Error finalizando turno', e);
      if (e?.response?.status === 401) {
        alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
      } else {
        alert(e?.response?.data?.error || 'Error finalizando turno');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCombat = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/combate/${combateId}`);
      const data = res.data || {};
      // intentar normalizar payload
      const payload = data.combate || data;
      if (payload) {
        setCombate(payload.combate || payload);
        setOrden(normalizeOrden(payload.orden || payload.ordenIniciativa || orden || []));
        setTurnoActual(payload.turnoActual || turnoActual);
        setHpActual(payload.hpActual || hpActual);
        if (data.actores) setDebugActors(data.actores);
      }
    } catch (e) {
      console.warn('No se pudo refrescar combate por GET /combate/:id — puede que no exista endpoint GET', e?.response?.data || e.message);
      alert('Refresco de combate no disponible en backend');
    } finally { setLoading(false); }
  };

  const determineWinner = () => {
    const pjIds = orden.filter(o => o.tipo === 'PJ').map(o => o.entidadId);
    const alivePJ = pjIds.some(id => (hpActual[String(id)] ?? 0) > 0);
    return alivePJ ? 'victory' : 'defeat';
  };

  if (!hydrated) {
    return (
      <div style={{ color: 'white', padding: 20 }}>
        Cargando datos de combate...
      </div>
    );
  }

  if (!combate && !initial) {
    return (
      <div style={{ color: 'white', padding: 20 }}>
        No hay datos de combate. Inicia un combate desde el mapa primero.
      </div>
    );
  }

  // render básico de UI solicitado
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#071019', color: '#fff', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Botón cerrar (solo si es overlay) */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            padding: '8px 16px',
            background: '#e33',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold',
            zIndex: 10000
          }}
        >
          ✕ Cerrar Combate
        </button>
      )}
      
      <div style={{ display: 'flex', gap: 20, padding: 12 }}>
        {/* Panel retratos y HP (top-left) */}
        <div style={{ width: 220, background: '#0008', padding: 8, borderRadius: 8 }}>
          <h4>Party</h4>
          {participants.filter(o => o.tipo === 'PJ').slice(0,4).map((o) => (
            <div key={o.entidadId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <img src={o.personaje?.portrait || null} alt="retrato" style={{ width: 48, height: 48, objectFit: 'cover', imageRendering: 'pixelated' }} />
              <div>
                <div style={{ fontSize: 12 }}>{o.personaje?.nombre || `PJ ${o.entidadId}`}</div>
                <HpBar current={(hpActual?.[o.entidadId] ?? 0)} max={o.personaje?.puntosGolpe ?? 10} />
              </div>
            </div>
          ))}
        </div>

        {/* Centro: actor que tiene turno */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Turno:</div>
            <div style={{ background: '#0008', padding: 20, borderRadius: 10 }}>
              {turnoActual ? (
                <>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{getActorDisplayName(participants, orden, debugActors, turnoActual.actorId, turnoActual.actorTipo, combate)}</div>
                  {/* intentar mostrar sprite desde orden */}
                  {getActorSprite(participants, turnoActual.actorId) ? (
                    <img src={getActorSprite(participants, turnoActual.actorId)} alt="activo" style={{ width: 160, height: 160, imageRendering: 'pixelated' }} />
                  ) : (
                    <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: 8 }}>
            {getActorDisplayName(participants, orden, debugActors, turnoActual.actorId, turnoActual.actorTipo, combate)}
                    </div>
                  )}
                </>
              ) : (
                <div>No hay turno activo</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: enemigos (texto por ahora) */}
        <div style={{ width: 240, background: '#0008', padding: 8, borderRadius: 8 }}>
          <h4>Enemigos</h4>
          {/* listar enemigos desde orden / debugActors */}
          {(orden || []).filter(o => String(o.tipo).toUpperCase() === 'EN').length === 0 ? (
            <div style={{ padding: 6, background: '#111', borderRadius: 6 }}>ninguno</div>
          ) : (
            (orden || []).filter(o => String(o.tipo).toUpperCase() === 'EN').map((e) => {
              const name = e.nombre || e.name || (Array.isArray(debugActors) && (debugActors.find(d => String(d.entidadId) === String(e.entidadId) || String(d.id) === String(e.entidadId)) || {}).nombre) || `En ${e.entidadId}`;
              return <div key={`${e.tipo}:${e.entidadId}`} style={{ padding: 6, background: '#111', borderRadius: 6, marginBottom: 6 }}>{name}</div>;
            })
          )}
          {/* Debug panel toggle */}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setDebugOpen(!debugOpen)} style={{ padding: '6px 8px' }}>{debugOpen ? 'Ocultar debug' : 'Mostrar debug'}</button>
            {debugOpen && (
              <div style={{ marginTop: 8, background: '#000', padding: 8, borderRadius: 6, maxHeight: 220, overflow: 'auto' }}>
                <div style={{ marginBottom: 6 }}><strong>Combat payload (state):</strong></div>
                <pre style={{ fontSize: 11, color: '#bcd', whiteSpace: 'pre-wrap' }}>{JSON.stringify({ combate, orden, turnoActual, hpActual }, null, 2)}</pre>
                <div style={{ marginTop: 6 }}><strong>Actores resueltos:</strong></div>
                <pre style={{ fontSize: 11, color: '#bcd', whiteSpace: 'pre-wrap' }}>{JSON.stringify(debugActors, null, 2)}</pre>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={handleRefreshCombat} style={{ padding: '6px 8px' }} disabled={loading}>Refrescar</button>
                  <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ combate, orden, turnoActual, hpActual, actores: debugActors })); }} style={{ padding: '6px 8px' }}>Copiar JSON</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de acciones inferior */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, background: '#000c', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '90%', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 🔥 Calcular si es mi turno y construir lista de acciones */}
          {(() => {
            // Debug: log de valores para diagnosticar
            if (turnoActual && myPersonajeId) {
              console.log('[CombatView] Comparación de turno:', {
                'turnoActual.actorId': turnoActual.actorId,
                'turnoActual.actorTipo': turnoActual.actorTipo,
                'myPersonajeId': myPersonajeId,
                'son iguales': Number(turnoActual.actorId) === Number(myPersonajeId)
              });
            }
            
            const isMyTurn = turnoActual && myPersonajeId && Number(turnoActual.actorId) === Number(myPersonajeId);
            const isEnemyTurn = turnoActual && turnoActual.actorTipo === 'EN';
            const disabled = loading || !isMyTurn || isEnemyTurn;
            
            // 🔥 Construir lista de acciones en orden correcto
            const botonesAcciones = [];
            
            // 1. ATAQUE BÁSICO (del arma equipada)
            let ataqueBasico = null;
            if (myPersonaje) {
              // Buscar el arma equipada (equipArma es un array JSONB)
              const armaEquipada = Array.isArray(myPersonaje.equipArma) && myPersonaje.equipArma.length > 0 
                ? myPersonaje.equipArma[0] 
                : null;
              
              if (armaEquipada) {
                const nombreArma = armaEquipada.nombre || armaEquipada.name || 'Arma';
                ataqueBasico = { nombre: `Ataque básico (${nombreArma})`, indice: 1 };
              } else {
                ataqueBasico = { nombre: 'Ataque básico', indice: 1 };
              }
            }
            
            if (ataqueBasico) {
              botonesAcciones.push(
                <ActionButton 
                  key="ataque-basico"
                  title={ataqueBasico.nombre} 
                  onClick={() => handleAction(ataqueBasico.indice, null, chooseTarget(participants))} 
                  disabled={disabled} 
                />
              );
            }
            
            // 2. ACCIÓN SECUNDARIA + HABILIDADES (de accionesObtenidas)
            const accionesPersonaje = myPersonaje?.accionesObtenidas || [];
            
            if (accionesPersonaje.length > 0) {
              // Primera acción = Acción secundaria (consume accionExtra)
              botonesAcciones.push(
                <ActionButton 
                  key="secundaria"
                  title={accionesPersonaje[0].nombre || 'Acción secundaria'} 
                  onClick={() => handleAction(2, null, chooseTarget(participants))} 
                  disabled={disabled} 
                />
              );
              
              // Separador visual
              botonesAcciones.push(<div key="sep" style={{ width: 12 }} />);
              
              // Resto de acciones = Habilidades I, II, III, IV
              const habilidades = accionesPersonaje.slice(1, 5); // Máximo 4 habilidades
              habilidades.forEach((habilidad, idx) => {
                const nombreHab = habilidad.nombre || `Habilidad ${['I', 'II', 'III', 'IV'][idx]}`;
                botonesAcciones.push(
                  <ActionButton 
                    key={`hab-${idx}`}
                    title={nombreHab} 
                    onClick={() => handleAction(3 + idx, null, chooseTarget(participants))} 
                    disabled={disabled} 
                  />
                );
              });
            }
            
            return (
              <>
                <div style={{ display: 'flex', flex: 1, gap: 12, alignItems: 'center', minWidth: 0 }}>
                  {/* Acciones del personaje */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {botonesAcciones.length > 0 ? (
                      botonesAcciones
                    ) : (
                      // Fallback: mostrar botones genéricos si no se cargó el personaje
                      <>
                        <ActionButton title="Cargando acciones..." onClick={() => {}} disabled={true} />
                      </>
                    )}
                  </div>
                  
                  {/* Panel de inventario con scroll */}
                  <InventoryPanel 
                    participants={participants} 
                    hpActual={hpActual} 
                    onUseItem={(objId, targetId) => handleAction(null, objId, targetId)} 
                    disabled={disabled} 
                  />
                  
                  {/* Espaciador flexible */}
                  <div style={{ flex: 1, minWidth: 12 }} />
                  
                  {/* Mensajes de estado */}
                  {!isMyTurn && !isEnemyTurn && <span style={{ color: '#f88', fontSize: 14, whiteSpace: 'nowrap' }}>No es tu turno</span>}
                  {isEnemyTurn && <span style={{ color: '#8af', fontSize: 14, whiteSpace: 'nowrap' }}>Turno del enemigo...</span>}
                </div>
                
                {/* Botón de fin de turno siempre visible */}
                <button 
                  onClick={handleEndTurn} 
                  disabled={loading || !isMyTurn || isEnemyTurn} 
                  style={{ 
                    padding: '8px 16px',
                    minWidth: 100,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Fin turno
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ title, onClick, disabled = false }) {
  return (
    <button 
      title={title} 
      onClick={onClick} 
      disabled={disabled}
      style={{ 
        padding: '8px 12px', 
        borderRadius: 6,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      {title}
    </button>
  );
}

function InventoryPanel({ participants, hpActual, onUseItem, disabled = false }) {
  // si hay un actor en participants, listar su inventario — fallback vacío
  const actor = participants.find(o => o.tipo === 'PJ');
  const inventario = actor?.personaje?.inventario || [];
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      background: '#111', 
      padding: 8, 
      borderRadius: 6,
      minWidth: 150,
      maxWidth: 300
    }}>
      <div style={{ 
        fontSize: 11, 
        color: '#888', 
        marginBottom: 4,
        fontWeight: 'bold'
      }}>
        Inventario
      </div>
      <div style={{ 
        maxHeight: 80, 
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex', 
        flexDirection: 'column',
        gap: 4
      }}>
        {inventario.length === 0 ? (
          <div style={{ color: '#666', fontSize: 12 }}>Vacío</div>
        ) : (
          inventario.map((it, idx) => (
            <div 
              key={idx} 
              title={`${it.nombre || 'obj'} — ${it.descripcion || ''}`} 
              style={{ 
                padding: '4px 8px', 
                background: '#000', 
                borderRadius: 4, 
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 12,
                opacity: disabled ? 0.5 : 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'background 0.2s'
              }} 
              onClick={() => !disabled && onUseItem(it.id, chooseTarget(participants))}
              onMouseEnter={(e) => !disabled && (e.target.style.background = '#222')}
              onMouseLeave={(e) => e.target.style.background = '#000'}
            >
              {it.nombre || `obj${idx}`}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function chooseTarget(list) {
  // list: participants or orden; seleccionar primer EN si existe, sino primer PJ
  if (!list || list.length === 0) return null;
  const enem = list.find(o => o.tipo === 'EN');
  if (enem) return enem.entidadId;
  const ally = list.find(o => o.tipo === 'PJ');
  return ally ? ally.entidadId : null;
}

function getActorDisplayName(participants, orden, debugActors, actorId, actorTipo) {
  if (!actorId) return '';
  const p = (participants || []).find(x => String(x.entidadId) === String(actorId));
  if (p?.personaje?.nombre) return p.personaje.nombre;
  const o = (orden || []).find(x => String(x.entidadId) === String(actorId));
  if (o?.nombre) return o.nombre;
  if (Array.isArray(debugActors)) {
    const d = debugActors.find(a => String(a.entidadId) === String(actorId) || String(a?.id) === String(actorId));
    if (d?.nombre) return d.nombre;
  }
  return actorTipo === 'EN' ? 'Enemigo' : `PJ ${actorId}`;
}

function getActorSprite(list, actorId) {
  if (!list || list.length === 0) return null;
  const f = list.find(o => String(o.entidadId) === String(actorId));
  // sprite puede venir en personaje.sprite
  return f?.personaje?.sprite || f?.detalle?.sprite || null;
}