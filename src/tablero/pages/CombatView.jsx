import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

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

export default function CombatView() {
  const { partidaId, combateId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Hidratación sincrónica desde localStorage si no hay state (evita perder datos en navigation full reload)
  let initial = location.state?.combate || location.state || null;
  if (!initial) {
    try {
      const storedRaw = typeof window !== 'undefined' ? localStorage.getItem(`combat_${combateId}`) : null;
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw);
        initial = parsed || null;
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // aceptar múltiples formas de payload:
  // 1. { combate: {...}, orden: [...], turnoActual: {...}, hpActual: {...}, actores: [...] } (backend broadcast)
  // 2. { combate: {...ordenIniciativa inside} } (solo objeto combate)
  const initialCombatObj = initial?.combate || (initial?.id ? initial : null);
  
  // Buscar orden en múltiples lugares con prioridad
  let initialRawOrden = [];
  if (initial?.orden && Array.isArray(initial.orden) && initial.orden.length > 0) {
    initialRawOrden = initial.orden;
  } else if (initialCombatObj?.ordenIniciativa && Array.isArray(initialCombatObj.ordenIniciativa)) {
    initialRawOrden = initialCombatObj.ordenIniciativa;
  } else if (initialCombatObj?.orden && Array.isArray(initialCombatObj.orden)) {
    initialRawOrden = initialCombatObj.orden;
  }
  
  const initialOrden = normalizeOrden(initialRawOrden);
  const initialTurno = initial?.turnoActual || initial?.turno || null;
  const initialHp = initial?.hpActual || {};

  const [combate, setCombate] = useState(initialCombatObj || null);
  const [orden, setOrden] = useState(initialOrden || []);
  const [participants, setParticipants] = useState([]); // fetched personaje data
  const [turnoActual, setTurnoActual] = useState(initialTurno || null);
  const [hpActual, setHpActual] = useState(initialHp || {});
  const [selectedActor, setSelectedActor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(true);
  const [debugActors, setDebugActors] = useState(location.state?.actores || initial?.actores || []);
  const [hydrated, setHydrated] = useState(false);

    // Si el WS guardó payload del combate en sessionStorage, úsalo al montar
  useEffect(() => {
    try {
      console.debug('[CombatView] mount history.state', history?.state, 'location.state', location?.state);
    } catch (e) {}

    // intento síncrono ya hecho arriba; aquí hacemos un reintento corto para cubrir carreras de eventos
    const t = setTimeout(() => {
      try {
        const stored = localStorage.getItem(`combat_${combateId}`);
        console.debug('[CombatView] recheck localStorage for', `combat_${combateId}`, stored ? '(present)' : '(null)');
        if (!stored) {
          setHydrated(true);
          return;
        }
        const data = JSON.parse(stored);
        console.debug('[CombatView] parsed localStorage data:', data);
        
        const incomingCombat = data.combate || (data.id ? data : null);
        
        // Buscar orden con la misma lógica que arriba
        let incomingOrden = [];
        if (data.orden && Array.isArray(data.orden) && data.orden.length > 0) {
          incomingOrden = data.orden;
        } else if (incomingCombat?.ordenIniciativa && Array.isArray(incomingCombat.ordenIniciativa)) {
          incomingOrden = incomingCombat.ordenIniciativa;
        } else if (incomingCombat?.orden && Array.isArray(incomingCombat.orden)) {
          incomingOrden = incomingCombat.orden;
        }
        
        const incomingTurno = data.turnoActual || data.turno || null;
        const incomingHp = data.hpActual || {};
        
        if (incomingCombat) setCombate(incomingCombat);
        // IMPORTANT: normalizar y deduplicar la orden antes de setear
        if (Array.isArray(incomingOrden) && incomingOrden.length) {
          const normalized = normalizeOrden(incomingOrden);
          console.debug('[CombatView] setting orden:', normalized);
          setOrden(normalized);
        }
        if (incomingTurno) setTurnoActual(incomingTurno);
        if (incomingHp && Object.keys(incomingHp).length > 0) setHpActual(incomingHp);
        if (data.actores) setDebugActors(data.actores);
      } catch (e) {
        console.debug('No session combat payload or parse error on recheck', e);
      } finally {
        setHydrated(true);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [combateId]);

  // BroadcastChannel: escuchar updates de COMBAT_STARTED para hidratar estado si llega más tarde
  useEffect(() => {
    let bc = null;
    try {
      bc = new BroadcastChannel('nn_combat_channel');
      bc.onmessage = (ev) => {
        try {
          const m = ev.data || {};
          if (m && m.type === 'COMBAT_STARTED' && String(m.combateId) === String(combateId)) {
            console.debug('[CombatView] BC COMBAT_STARTED received for', combateId, m);
            const payload = m.payload || m;
            const incoming = payload.combate || payload.combat || payload;
            const incomingOrden = payload.orden || payload.ordenIniciativa || payload.orden || [];
            const incomingTurno = payload.turnoActual || payload.turno || null;
            const incomingHp = payload.hpActual || {};
            if (incoming) setCombate(incoming);
            if (Array.isArray(incomingOrden) && incomingOrden.length) setOrden(normalizeOrden(incomingOrden));
            if (incomingTurno) setTurnoActual(incomingTurno);
            if (incomingHp) setHpActual(incomingHp);
            if (payload.actores) setDebugActors(payload.actores);
          }
        } catch (e) { console.error('CombatView BC onmessage error', e); }
      };
    } catch (e) {
      console.debug('CombatView BroadcastChannel not available', e);
    }
    return () => { try { if (bc) bc.close(); } catch (e) {} };
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
      alert(e?.response?.data?.error || 'Error ejecutando acción');
    } finally {
      setLoading(false);
    }
  };

  const handleEndTurn = async () => {
    if (!turnoActual) return;
    try {
      setLoading(true);
      const res = await api.post(`/combate/${combateId}/turno/${turnoActual.id}/end`);
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
      alert('Error finalizando turno');
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
          <ActionButton title="Ataque principal" onClick={() => handleAction(1, null, chooseTarget(participants))} />
          <ActionButton title="Acción secundaria" onClick={() => handleAction(2, null, chooseTarget(participants))} />
          <div style={{ width: 12 }} />
          <ActionButton title="Habilidad I" onClick={() => handleAction(101, null, chooseTarget(participants))} />
          <ActionButton title="Habilidad II" onClick={() => handleAction(102, null, chooseTarget(participants))} />
          <ActionButton title="Habilidad III" onClick={() => handleAction(103, null, chooseTarget(participants))} />
          <ActionButton title="Habilidad IV" onClick={() => handleAction(104, null, chooseTarget(participants))} />
          <div style={{ width: 12 }} />
          <InventoryPanel participants={participants} hpActual={hpActual} onUseItem={(objId, targetId) => handleAction(null, objId, targetId)} />
          <div style={{ flex: 1 }} />
          <button onClick={handleEndTurn} disabled={loading} style={{ padding: '8px 12px' }}>Fin turno</button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ title, onClick }) {
  return (
    <button title={title} onClick={onClick} style={{ padding: '8px 12px', borderRadius: 6 }}>{title}</button>
  );
}

function InventoryPanel({ participants, hpActual, onUseItem }) {
  // si hay un actor en participants, listar su inventario — fallback vacío
  const actor = participants.find(o => o.tipo === 'PJ');
  const inventario = actor?.personaje?.inventario || [];
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#111', padding: 6, borderRadius: 6 }}>
      <div style={{ maxHeight: 60, overflowY: 'auto', display: 'flex', gap: 6 }}>
        {inventario.length === 0 ? <div style={{ color: '#888' }}>Inventario vacío</div> : inventario.map((it, idx) => (
          <div key={idx} title={`${it.nombre || 'obj'} — ${it.descripcion || ''}`} style={{ padding: 6, background: '#000', borderRadius: 6, cursor: 'pointer' }} onClick={() => onUseItem(it.id, chooseTarget(participants))}>
            {it.nombre || `obj${idx}`}
          </div>
        ))}
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