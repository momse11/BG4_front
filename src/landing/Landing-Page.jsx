import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../auth/AuthProvider'
import api from '../utils/api'

import Logo from '../assets/Logo.png'
import Portada from '../assets/Portada.png'
import '../assets/styles/landing.css'

export default function LandingPage() {
  const { user, logout, createPartida } = useContext(AuthContext)
  const navigate = useNavigate()

  // modal unirse
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')

  // modal crear partida
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [privado, setPrivado] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
    // 👉 después de cerrar sesión, ir a la landing pública
    navigate('/')
  }

  // Si llega sin sesión
  if (!user) {
    return (
      <div className="landing-pixel-root">
        <div className="auth-card">
          <h2 className="auth-title">No has iniciado sesión</h2>
          <button
            className="pixel-button"
            onClick={() => navigate('/login')}
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  // abrir modal crear
  const openCreateModal = () => {
    setCreateError('')
    setPrivado(false)
    setShowCreateModal(true)
  }

  // submit crear partida (usa createPartida del contexto)
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    try {
      const partida = await createPartida({
        privado: privado ? 1 : 0,
        // ya no usamos contraseña, solo ID auto-generado en el back
      })

      setShowCreateModal(false)
      navigate(`/partida/${partida.id}`)
    } catch (err) {
      const serverMsg =
        err?.error || err?.message || err?.response?.data?.error || null
      setCreateError(serverMsg || '❌ Error al crear la partida')
    } finally {
      setCreateLoading(false)
    }
  }

  // abrir modal unirse
  const openJoinModal = () => {
    setJoinError('')
    setJoinCode('')
    setShowJoinModal(true)
  }

  // submit unirse a partida
  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    setJoinError('')

    const trimmed = joinCode.trim()
    if (!trimmed) {
      setJoinError('Ingresa un ID de partida.')
      return
    }

    try {
      await api.get(`/partidas/${trimmed}`)
      setShowJoinModal(false)
      navigate(`/partida/${trimmed}`)
    } catch (err) {
      const msg = err?.response?.data?.error || 'Partida no encontrada.'
      setJoinError(msg)
    }
  }

  return (
    <div className="landing-pixel-root">
      <div className="user-landing-frame">
        {/* Logo */}
        <img src={Logo} alt="Logo TilinerOS" className="landing-logo" />

        {/* Portada */}
        <img src={Portada} alt="Portada TilinerOS" className="landing-portada" />

        {/* Saludo */}
        <h2 className="user-landing-greeting">
          Hola, {user.username || user.email}
        </h2>

        {/* Botones principales */}
        <div className="user-landing-buttons">
          <button
            className="pixel-button"
            onClick={openCreateModal}
          >
            Crear partida
          </button>

          <button
            className="pixel-button"
            onClick={openJoinModal}
          >
            Unirse a partida
          </button>

          <button
            className="pixel-button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Modal Crear Partida */}
      {showCreateModal && (
        <div
          className="pixel-modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="pixel-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pixel-modal-title">Crear partida</h2>

            <form className="auth-form" onSubmit={handleCreateSubmit}>
              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={privado}
                  onChange={(e) => setPrivado(e.target.checked)}
                />
                <span>Partida privada</span>
              </label>

              <button
                type="submit"
                disabled={createLoading}
                className="pixel-button"
              >
                {createLoading ? 'Creando...' : 'Crear partida'}
              </button>
            </form>

            {createError && (
              <p className="auth-error" style={{ marginTop: '0.8rem' }}>
                {createError}
              </p>
            )}

            <button
              className="pixel-button auth-button-spaced"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Unirse a partida */}
      {showJoinModal && (
        <div
          className="pixel-modal-overlay"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="pixel-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pixel-modal-title">Unirse a partida</h2>

            <form className="auth-form" onSubmit={handleJoinSubmit}>
              <input
                type="text"
                className="auth-input"
                placeholder="ID de partida"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />

              <button
                type="submit"
                className="pixel-button"
              >
                Unirse
              </button>
            </form>

            {joinError && (
              <p className="auth-error" style={{ marginTop: '0.8rem' }}>
                {joinError}
              </p>
            )}

            <button
              className="pixel-button auth-button-spaced"
              onClick={() => setShowJoinModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}