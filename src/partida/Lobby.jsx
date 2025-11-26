// src/components/Lobby.jsx
import { useEffect, useState, useContext, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../auth/AuthProvider'
import { getPartida, selectClase, selectPersonaje } from '../utils/api'
import api from '../utils/api'
import { usePartidaWS } from '../utils/ws'
import SelectClaseModal from './SelectClaseModal'
import SelectPersonajeModal from './SelectPersonajeModal'

import Marco from '../assets/Marco.png'
import '../assets/styles/lobby.css'

export default function Lobby() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [partida, setPartida] = useState(null)

  const jugadorParam = useMemo(
    () => (user ? { id: user.id, username: user.username } : null),
    [user?.id, user?.username]
  )
  const { jugadores } = usePartidaWS(id, jugadorParam)

  const [loading, setLoading] = useState(true)
  const [showClase, setShowClase] = useState(false)
  const [showPersonaje, setShowPersonaje] = useState(false)
  const [selectedClaseLocal, setSelectedClaseLocal] = useState(null)

  const fetchLobby = async () => {
    try {
      const data = await getPartida(id)
      setPartida(data.partida)
    } catch (e) {
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
    fetchLobby()
  }, [id])

  useEffect(() => {
    return () => {}
  }, [id])

  const openSelectClase = () => setShowClase(true)

  const onClaseSelected = async (clase) => {
    try {
      await selectClase(id, clase)
      setSelectedClaseLocal(clase)
      setShowClase(false)
      setShowPersonaje(true)
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
        try {
          window.location.reload()
        } catch (e) {}
      }, 100)
    } catch (e) {
      console.error('Error selecting personaje', e)
      alert(e?.response?.data?.error || 'Error seleccionando personaje')
    }
  }

  const allSelected =
    jugadores.length === 4 &&
    jugadores.length > 0 &&
    jugadores.every((j) => j.selected_personaje_id)

  const isCreator =
    user && partida && Number(partida.creador_id) === Number(user.id)

  // 4 slots siempre
  const slots = useMemo(() => {
    const base = Array.isArray(jugadores) ? jugadores : []
    const filled = [...base]
    while (filled.length < 4) filled.push(null)
    return filled.slice(0, 4)
  }, [jugadores])

  const getPortraitSrc = (slot) => {
    const nombre =
      slot && slot.selected_personaje && slot.selected_personaje.nombre
        ? String(slot.selected_personaje.nombre)
        : 'Ninguno'

    try {
      const fileName = nombre
      const url = new URL(
        `../assets/tablero/retratos/${fileName}.png`,
        import.meta.url
      ).href
      return url
    } catch (e) {
      try {
        const fallback = new URL(
          '../assets/tablero/retratos/Ninguno.png',
          import.meta.url
        ).href
        return fallback
      } catch (er) {
        return ''
      }
    }
  }

  // Opcional: ids de personajes ya tomados (por si quieres bloquear repeticiones)
  const takenPersonajeIds = useMemo(
    () =>
      jugadores
        .filter((j) => j.selected_personaje_id)
        .map((j) => j.selected_personaje_id),
    [jugadores]
  )

  return (
    <div className="lobby-root">
      <div className="lobby-card">
        {/* Título y subtítulo */}
        <h2 className="lobby-title">Selección de personaje</h2>
        <p className="lobby-subtitle">Partida #{id}</p>

        {loading ? (
          <p className="lobby-loading">Cargando...</p>
        ) : (
          <>
            {/* Cuatro marcos para jugadores */}
            <div className="lobby-slots">
              {slots.map((slot, index) => {
                const isCurrentUser =
                  slot && user && Number(slot.id) === Number(user.id)
                const username =
                  slot && slot.username ? slot.username : 'Esperando...'

                return (
                  <div
                    key={slot ? slot.id : `empty-${index}`}
                    className="lobby-slot"
                  >
                    <div className="lobby-frame-wrapper">
                      {/* Retrato detrás, tamaño original y centrado */}
                      <img
                        src={getPortraitSrc(slot)}
                        alt={slot?.selected_personaje?.nombre || 'Ninguno'}
                        className="lobby-portrait"
                      />
                      {/* Marco por delante, tamaño original */}
                      <img
                        src={Marco}
                        alt="Marco personaje"
                        className="lobby-frame"
                      />
                    </div>

                    {/* Nombre debajo */}
                    <div className="lobby-slot-username">
                      {username}
                    </div>

                    {/* Botón para seleccionar/cambiar personaje solo para este jugador */}
                    {isCurrentUser && (
                      <button
                        className="pixel-button auth-button-primary lobby-slot-button"
                        onClick={openSelectClase}
                      >
                        Personaje
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Estado jugadores */}
            <div className="lobby-status">
              <span>{jugadores.length}/4 jugadores</span>
              {!isCreator && (
                <span className="lobby-status-helper">
                  Solo el creador puede empezar
                </span>
              )}
            </div>

            {/* Botones Empezar / Volver (mismo formato) */}
            <div className="lobby-actions">
              <button
                className="pixel-button lobby-button-secondary"
                disabled={!isCreator || !allSelected}
                onClick={async () => {
                  try {
                    const resp = await api.post(`/partidas/${id}/start`)
                    if (resp && resp.status === 200 && resp.data?.mapaId) {
                      const mapaId = resp.data.mapaId
                      navigate(`/partida/${id}/mapa/${mapaId}`)
                      return
                    }
                    alert('No se pudo iniciar la partida. Intenta nuevamente.')
                  } catch (e) {
                    console.error('Error starting partida', e)
                    alert(
                      e?.response?.data?.error || 'Error iniciando la partida'
                    )
                  }
                }}
              >
                Empezar
              </button>

              <button
                className="pixel-button lobby-button-secondary"
                onClick={async () => {
                  try {
                    if (!user) {
                      navigate('/landing')
                      return
                    }

                    const meId = Number(user.id)
                    const creatorId = partida ? Number(partida.creador_id) : null

                    if (creatorId && meId === creatorId) {
                      // Creador: borrar partida
                      try {
                        await api.delete(`/partidas/${id}`)
                      } catch (err) {
                        console.error('Error deleting partida', err)
                      }
                    } else {
                      // Jugador normal: salir de la partida
                      try {
                        await api.post(`/partidas/${id}/leave`)
                      } catch (err) {
                        console.error('Error leaving partida', err)
                      }
                    }
                  } catch (e) {
                    console.error(
                      'Unexpected error leaving/deleting partida',
                      e
                    )
                  } finally {
                    navigate('/landing')
                  }
                }}
              >
                Volver
              </button>
            </div>
          </>
        )}
      </div>

      {showClase && (
        <SelectClaseModal
          onClose={() => setShowClase(false)}
          onSelect={onClaseSelected}
        />
      )}

      {showPersonaje && (
        <SelectPersonajeModal
          clase={
            selectedClaseLocal ||
            (user &&
              jugadores.find(
                (j) => Number(j.id) === Number(user.id)
              )?.selected_clase)
          }
          onClose={() => {
            setShowPersonaje(false)
          }}
          onBackToClase={() => {
            setShowPersonaje(false)
            setShowClase(true)
          }}
          takenPersonajeIds={takenPersonajeIds}
          onSelect={onPersonajeSelected}
        />
      )}
    </div>
  )
}