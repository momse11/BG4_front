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
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      {user ? (
        <>
          <h2>Hola, {user.username || user.email}</h2>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <h2>No has iniciado sesión</h2>
          <Link to="/login">
            <button>Ir al inicio de sesión</button>
          </Link>
        </>
      )}
    </div>
  )
}
