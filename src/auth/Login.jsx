import { useState, useContext } from 'react'
import { AuthContext } from './AuthProvider'
import { useNavigate, Link } from 'react-router-dom'

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
      await login(formData) // Llama al backend
      navigate('/landing') // Redirige a LandingPage si el login es exitoso
    } catch (err) {
      // Mostrar mensaje más específico si el backend lo proporciona
      const serverMsg = err?.response?.data?.error || err?.message || 'Credenciales incorrectas o error de conexión.'
      setError(serverMsg)
      console.error('Login error:', err)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      {user ? (
        <>
          <h2>Hola, {user.username || user.email}</h2>
          <button onClick={logout}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <h2>Iniciar sesión</h2>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <input
              type="email"
              name="email"
              placeholder="Correo electrónico"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit">Entrar</button>
          </form>
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <p>¿No tienes cuenta?</p>
          <Link to="/sign-up">
            <button>Registrarse</button>
          </Link>
        </>
      )}
    </div>
  )
}
