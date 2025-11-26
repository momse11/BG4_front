import { useEffect, useState, useContext, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../auth/AuthProvider'
import { getPartida, selectClase, selectPersonaje } from '../utils/api'
import api from '../utils/api'
import { usePartidaWS } from '../utils/ws'
import SelectClaseModal from './SelectClaseModal'
import SelectPersonajeModal from './SelectPersonajeModal'

export default function Lobby() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [partida, setPartida] = useState(null)
  // jugadores ahora proviene del hook de WebSocket
  // memoizar el objeto jugador para evitar recrear la referencia en cada render
  const jugadorParam = useMemo(() => (user ? { id: user.id, username: user.username } : null), [user?.id, user?.username]);
  const { jugadores } = usePartidaWS(id, jugadorParam)
  const [loading, setLoading] = useState(true)
  const [showClase, setShowClase] = useState(false)
  const [showPersonaje, setShowPersonaje] = useState(false)
  const [selectedClaseLocal, setSelectedClaseLocal] = useState(null)

  const fetchLobby = async () => {
    try {
      const data = await getPartida(id)
      setPartida(data.partida)
      // jugadores provienen del WebSocket hook; no setJugadores local
    } catch (e) {
      // si la partida no existe, redirigir a la lista de partidas
      try {
        if (e?.response?.status === 404) {
          navigate('/partidas')
          return
        }
      } catch (er) {}
      console.error('Error fetching partida', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // fetch partida metadata once (creator id, etc.)
    fetchLobby()
  }, [id])

  // cuando el componente se desmonte (usuario sale de la ruta del lobby), intentar eliminar/salir de la partida
  // Protegemos la ruta: antes de recargar/cerrar o navegar fuera, pedimos confirmación.
  // Usamos sendBeacon para notificar al servidor si el usuario confirma la salida.
  // Previously we added a beforeunload handler and intercepted link clicks
  // to try to notify the server on unload via sendBeacon and ask for
  // confirmation. That caused UX problems (native confirm dialogs) and
  // could trigger network requests to non-API routes that hang the
  // browser spinner. The WebSocketProvider now performs an auto-leave
  // fallback; keep this effect removed to avoid sendBeacon/preflight issues.
  useEffect(() => {
    // noop: intentionally left blank
    return () => {}
  }, [id])

  const openSelectClase = () => setShowClase(true)
  const onClaseSelected = async (clase) => {
    try {
      await selectClase(id, clase)
      setSelectedClaseLocal(clase)
      setShowClase(false)
      setShowPersonaje(true)
      // no hace falta fetch: el server notificará por WS
    } catch (e) {
      console.error('Error selecting clase', e)
      alert(e?.response?.data?.error || 'Error seleccionando clase')
    }
  }

  const onPersonajeSelected = async (personajeId) => {
    try {
      await selectPersonaje(id, personajeId)
      setShowPersonaje(false)
      setTimeout(() => {
        try { window.location.reload() } catch (e) { /* noop */ }
      }, 100)
    } catch (e) {
      console.error('Error selecting personaje', e)
      alert(e?.response?.data?.error || 'Error seleccionando personaje')
    }
  }
  const allSelected = jugadores.length === 4 && jugadores.length > 0 && jugadores.every((j) => j.selected_personaje_id)
  const isCreator = user && partida && Number(partida.creador_id) === Number(user.id)

  return (
    <div style={{ padding: 20 }}>
      <h2>Lobby — Partida {id}</h2>
      {loading ? <p>Cargando...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {jugadores.map((p) => (
              <div key={p.id} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>{p.username}</div>
                <div style={{ fontSize: 12 }}>
                  {p.selected_personaje && p.selected_personaje.sprite ? (
                    <img src={p.selected_personaje.sprite} alt={p.selected_personaje.nombre} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                  ) : (p.avatar_url ? <img src={p.avatar_url} alt={p.username} style={{ width: 48, height: 48 }} /> : <div style={{ width: 48, height: 48, background: '#eee' }} />)}
                </div>
                <div>Clase: {p.selected_clase || '—'}</div>
                <div>Personaje: {p.selected_personaje ? p.selected_personaje.nombre : (p.selected_personaje_id || '—')}</div>
                {user && Number(user.id) === Number(p.id) && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={openSelectClase}>{p.selected_personaje_id ? 'Cambiar personaje' : 'Seleccionar personaje'}</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button onClick={async () => {
              try {
                if (!user) { navigate('/partidas'); return }
                const meId = Number(user.id)
                const creatorId = partida ? Number(partida.creador_id) : null
                // Creator: attempt to delete the partida
                if (creatorId && meId === creatorId) {
                  const ok = window.confirm('Eres el creador. ¿Borrar la partida y salir?')
                  if (!ok) return
                  try {
                    const resp = await api.delete(`/partidas/${id}`)
                    // accept 200/204 as success
                    if (resp && (resp.status === 200 || resp.status === 204)) {
                      // navigate away; server WS will notify other clients
                      navigate('/partidas')
                      return
                    }
                    // fallback: if response not OK, show message
                    alert('No se pudo eliminar la partida. Intenta nuevamente.')
                  } catch (err) {
                    console.error('Error deleting partida', err)
                    alert(err?.response?.data?.error || 'Error eliminando la partida')
                  }
                } else {
                  const ok = window.confirm('¿Salir de la partida?')
                  if (!ok) return
                  try {
                    const resp = await api.post(`/partidas/${id}/leave`)
                    if (resp && (resp.status === 200 || resp.status === 204)) {
                      navigate('/partidas')
                      return
                    }
                    alert('No se pudo salir de la partida. Intenta nuevamente.')
                  } catch (err) {
                    console.error('Error leaving partida', err)
                    alert(err?.response?.data?.error || 'Error al salir de la partida')
                  }
                }
              } catch (e) {
                console.error('Unexpected error leaving/deleting partida', e)
                alert('Error inesperado al intentar salir')
              }
            }}>Volver</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14 }}>{jugadores.length}/4 jugadores</div>
              <button disabled={!isCreator || !allSelected} onClick={async () => {
                try {
                  // Call backend to create mapa and initial jugadas
                  const resp = await api.post(`/partidas/${id}/start`);
                  if (resp && resp.status === 200 && resp.data?.mapaId) {
                    const mapaId = resp.data.mapaId;
                    navigate(`/partida/${id}/mapa/${mapaId}`);
                    return;
                  }
                  alert('No se pudo iniciar la partida. Intenta nuevamente.');
                } catch (e) {
                  console.error('Error starting partida', e);
                  alert(e?.response?.data?.error || 'Error iniciando la partida');
                }
              }}>Empezar</button>
            </div>
          </div>
        </>
      )}

      {showClase && <SelectClaseModal onClose={() => setShowClase(false)} onSelect={onClaseSelected} />}
      {showPersonaje && <SelectPersonajeModal
        clase={selectedClaseLocal || (user && jugadores.find(j => Number(j.id) === Number(user.id))?.selected_clase)}
        onClose={async () => {
          // Al cancelar el selector de personaje, limpiar la clase seleccionada y propagar
          try {
            await selectClase(id, '')
          } catch (e) {
            console.debug('Error clearing clase on modal close', e?.response?.data || e.message)
          }
          setShowPersonaje(false)
        }}
        onSelect={onPersonajeSelected}
      />}
    </div>
  )
}
