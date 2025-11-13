import { useEffect, useState, useContext } from 'react'
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
  const { jugadores } = usePartidaWS(id, user ? { id: user.id, username: user.username } : null)
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
      console.error('Error fetching partida', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // fetch partida metadata once (creator id, etc.)
    fetchLobby()
  }, [id])

  // cuando el componente se desmonte (usuario sale de la ruta del lobby), llamar al endpoint leave
  useEffect(() => {
    return () => {
      // intenta limpiar la asociación en backend; es idempotente
      (async () => {
        try {
          // sólo intentar si hay user (si no hay token el servidor podría usar mock)
          if (user && id) {
            await api.post(`/partidas/${id}/leave`)
          }
        } catch (e) {
          // ignorar errores de limpieza
          console.debug('Leave partida cleanup failed', e?.response?.data || e.message)
        }
      })()
    }
  }, [id, user])

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
      // el server enviará UPDATE_PLAYERS por WS para refrescar la vista
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
                if (creatorId && meId === creatorId) {
                  const ok = window.confirm('Eres el creador. ¿Borrar la partida y salir?')
                  if (!ok) return
                  await api.delete(`/partidas/${id}`)
                  navigate('/partidas')
                } else {
                  const ok = window.confirm('¿Salir de la partida?')
                  if (!ok) return
                  await api.post(`/partidas/${id}/leave`)
                  navigate('/partidas')
                }
              } catch (e) {
                console.error('Error leaving/deleting partida', e)
                alert(e?.response?.data?.error || 'Error al salir de la partida')
              }
            }}>Volver</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14 }}>{jugadores.length}/4 jugadores</div>
              <button disabled={!isCreator || !allSelected} onClick={() => navigate(`/partida/${id}/empezada`)}>Empezar</button>
            </div>
          </div>
        </>
      )}

      {showClase && <SelectClaseModal onClose={() => setShowClase(false)} onSelect={onClaseSelected} />}
      {showPersonaje && <SelectPersonajeModal clase={selectedClaseLocal || (user && jugadores.find(j => Number(j.id) === Number(user.id))?.selected_clase)} onClose={() => setShowPersonaje(false)} onSelect={onPersonajeSelected} />}
    </div>
  )
}
