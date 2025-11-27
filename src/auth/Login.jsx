import { useState, useContext } from 'react'
import { AuthContext } from './AuthProvider'
import { useNavigate, Link } from 'react-router-dom'

import '../assets/styles/landing.css'
import '../assets/styles/signup.css'

export default function Login() {
  const { user, login, logout } = useContext(AuthContext)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await login(formData)
      navigate('/landing')
    } catch (err) {
      const serverMsg =
        err?.response?.data?.error ||
        err?.message ||
        'Credenciales incorrectas o error de conexión.'
      setError(serverMsg)
      console.error('Login error:', err)
    }
  }

  return (
    <div className="landing-pixel-root">
      <div className="auth-card">
        {user ? (
          <>
            <h2 className="auth-title">
              Hola, {user.username || user.email}
            </h2>

            <div className="auth-buttons">
              <button
                onClick={logout}
                className="pixel-button auth-button-primary"
              >
                Cerrar sesión
              </button>

              <button
                onClick={() => navigate('/landing')}
                className="pixel-button auth-button-primary"
              >
                Ir a Landing-Page
              </button>

              <button
                onClick={() => navigate('/')}
                className="pixel-button auth-button-primary"
              >
                Volver a la portada
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="auth-title">Iniciar sesión</h2>

            <form
              onSubmit={handleSubmit}
              className="auth-form"
            >
              <input
                type="email"
                name="email"
                placeholder="Correo electrónico"
                value={formData.email}
                onChange={handleChange}
                required
                className="auth-input"
              />

              <input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleChange}
                required
                className="auth-input"
              />

              <button
                type="submit"
                className="pixel-button auth-button-primary"
              >
                Acceder
              </button>
            </form>

            {error && (
              <p className="auth-error">{error}</p>
            )}

            <p className="auth-muted">¿No tienes cuenta?</p>

            <Link to="/sign-up">
              <button className="pixel-button auth-button-primary auth-button-spaced">
                Registrarse
              </button>
            </Link>

            <button
              onClick={() => navigate('/')}
              className="pixel-button auth-button-primary auth-button-spaced"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  )
}
