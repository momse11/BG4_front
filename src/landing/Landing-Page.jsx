//landing page por ahora (esta como ruta protegida pa probar, de ahi cambiar)

import { useContext } from 'react'
import { AuthContext } from '../auth/AuthProvider'
import { useNavigate, Link } from 'react-router-dom'

export default function LandingPage() {
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div
      style={{
        maxWidth: "420px",
        margin: "0 auto",
        textAlign: "center",
        padding: "2rem",
        borderRadius: "12px",
        background: "rgba(110, 231, 183, 0.15)", // mismo tono que tus otros fondos
        border: "1px solid rgba(110, 231, 183, 0.3)",
        boxShadow: "0 0 12px rgba(0,0,0,0.15)"
      }}
    >
      {user ? (
        <>
          <h2>Hola, {user.username || user.email}</h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "20px"
            }}
          >
            <Link to="/">
              <button className="btn-acuosa">Volver al inicio</button>
            </Link>

            <Link to="/partidas">
              <button className="btn-acuosa">Ver Partidas Disponibles</button>
            </Link>

            <Link to="/crear-partida">
              <button className="btn-acuosa">Crear una Partida</button>
            </Link>

            {user.partida_id && (
              <Link to={`/partida/${user.partida_id}`}>
                <button className="btn-acuosa">Volver a mi Partida</button>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="btn-acuosa"
              style={{ background: "rgba(255, 85, 85, 0.85)" }}
            >
              Cerrar sesión
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>No has iniciado sesión</h2>
          <Link to="/login">
            <button className="btn-acuosa">Ir al inicio de sesión</button>
          </Link>
        </>
      )}
    </div>
  )
}
