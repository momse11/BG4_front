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
    <div className="container" style={{ maxWidth: "460px" }}>
      <div className="team-card" style={{ padding: "2rem", textAlign: "center" }}>

        {user ? (
          <>
            <h2 style={{ marginBottom: "1rem", color: "var(--accent)" }}>
              Hola, {user.username || user.email}
            </h2>

            <button onClick={logout} className="btn input-field" style={{ width: "100%" }}>
              Cerrar sesión
            </button>
            <button onClick={() => navigate('/landing')} className="btn input-field" style={{ width: "100%" }}>
              Página de Usuario
            </button>

            <button
              onClick={() => navigate('/')}
              className="btn input-field"
              style={{ marginTop: "1rem", width: "100%" }}
            >
              Volver al inicio
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: "1rem", color: "var(--accent)" }}>Iniciar sesión</h2>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <input
                type="email"
                name="email"
                placeholder="Correo electrónico"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-field"
              />

              <input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleChange}
                required
                className="input-field"
              />

              <button type="submit" className="btn large input-field">
                Entrar
              </button>
            </form>

            {error && (
              <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</p>
            )}

            <p style={{ marginTop: "1rem", color: "var(--muted)" }}>¿No tienes cuenta?</p>

            <Link to="/sign-up">
              <button className="btn input-field" style={{ marginTop: "0.5rem", width: "100%" }}>
                Registrarse
              </button>
            </Link>

            <button
              onClick={() => navigate('/')}
              className="btn input-field"
              style={{ marginTop: "1rem", width: "100%" }}
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  )
}