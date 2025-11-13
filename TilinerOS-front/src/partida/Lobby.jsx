import { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../auth/AuthProvider'
import { getPartida, selectRaza, selectPersonaje } from '../utils/api'
import { usePartidaWS } from '../utils/ws'
import SelectRazaModal from './SelectRazaModal'
import SelectPersonajeModal from './SelectPersonajeModal'

export default function Lobby() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [partida, setPartida] = useState(null)
  // jugadores ahora proviene del hook de WebSocket
  const { jugadores } = usePartidaWS(id, user ? { id: user.id, username: user.username } : null)
  const [loading, setLoading] = useState(true)
  const [showRaza, setShowRaza] = useState(false)
  const [showPersonaje, setShowPersonaje] = useState(false)
  const [selectedRazaLocal, setSelectedRazaLocal] = useState(null)

  const fetchLobby = async () => {
    try {
      const data = await getPartida(id)
      setPartida(data.partida)
      setJugadores(data.jugadores || [])
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

  const openSelectRaza = () => setShowRaza(true)
  const onRazaSelected = async (raza) => {
    try {
      await selectRaza(id, raza)
      setSelectedRazaLocal(raza)
      setShowRaza(false)
      setShowPersonaje(true)
      // no hace falta fetch: el server notificará por WS
    } catch (e) {
      console.error('Error selecting raza', e)
      alert(e?.response?.data?.error || 'Error seleccionando raza')
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

  const allSelected = jugadores.length > 0 && jugadores.every((j) => j.selected_personaje_id)
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
                <div style={{ fontSize: 12 }}>{p.avatar_url ? <img src={p.avatar_url} alt={p.username} style={{ width: 48, height: 48 }} /> : null}</div>
                <div>Raza: {p.selected_raza || '—'}</div>
                <div>Personaje ID: {p.selected_personaje_id || '—'}</div>
                {user && Number(user.id) === Number(p.id) && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={openSelectRaza}>Seleccionar personaje</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button onClick={() => navigate(`/partida/${id}`)}>Volver</button>
            <button disabled={!isCreator || !allSelected} onClick={() => alert('Iniciar partida (no implementado)')}>Empezar</button>
          </div>
        </>
      )}

      {showRaza && <SelectRazaModal onClose={() => setShowRaza(false)} onSelect={onRazaSelected} />}
      {showPersonaje && <SelectPersonajeModal raza={selectedRazaLocal || (user && jugadores.find(j => Number(j.id) === Number(user.id))?.selected_raza)} onClose={() => setShowPersonaje(false)} onSelect={onPersonajeSelected} />}
    </div>
  )
}
