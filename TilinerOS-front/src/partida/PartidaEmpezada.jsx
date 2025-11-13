import { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../auth/AuthProvider'
import { getPartida } from '../utils/api'
import { usePartidaWS } from '../utils/ws'

export default function PartidaEmpezada() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [partida, setPartida] = useState(null)
  const { jugadores } = usePartidaWS(id, user ? { id: user.id, username: user.username } : null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getPartida(id)
        if (!mounted) return
        setPartida(data.partida)
      } catch (e) {
        console.error('Error fetching partida', e)
      }
    })()
    return () => { mounted = false }
  }, [id])

  return (
    <div style={{ padding: 20 }}>
      <h2>Partida {id} — Empezada (placeholder)</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>Administrador (creador):</strong> {partida ? partida.creador_id : '—'}
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Jugadores conectados:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
          {jugadores && jugadores.length > 0 ? jugadores.map(j => (
            <div key={j.id} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>{j.username} (id: {j.id})</div>
              <div>Clase: {j.selected_clase || '—'}</div>
              <div>Personaje: {j.selected_personaje ? j.selected_personaje.nombre : (j.selected_personaje_id || '—')}</div>
            </div>
          )) : <div>No hay jugadores conectados</div>}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={() => navigate('/partidas')}>Volver a partidas</button>
      </div>
    </div>
  )
}
