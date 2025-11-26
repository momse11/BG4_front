import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'

// estilos
import '../assets/styles/landing.css'
import '../assets/styles/signup.css'

export default function SignUp() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  })

  const [status, setStatus] = useState({ loading: false, success: '', error: '' })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })

    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        setStatus({ ...status, error: 'Formato de correo inválido' })
      } else {
        setStatus({ ...status, error: '' })
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ loading: true, success: '', error: '' })

    try {
      const response = await api.post('/users', formData)
      setStatus({
        loading: false,
        success: `Cuenta creada con éxito. Bienvenido/a, ${response.data.username}!`,
        error: ''
      })
      setFormData({ username: '', email: '', password: '' })
      navigate('/login')
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || 'Error al crear la cuenta. Intenta nuevamente.'
      setStatus({ loading: false, success: '', error: errorMsg })
    }
  }

  return (
    <div className="container" style={{ maxWidth: "460px" }}>
      <div className="team-card" style={{ padding: "2rem", textAlign: "center" }}>
        <h2 style={{ marginBottom: "1rem", color: "var(--accent)" }}>Crear cuenta</h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <input
            type="text"
            name="username"
            placeholder="Nombre de usuario"
            value={formData.username}
            onChange={handleChange}
            required
            className="input-field"
          />

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

          <button type="submit" disabled={status.loading} className="btn large input-field">
            {status.loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        {status.success && (
          <p style={{ color: 'var(--accent)', marginTop: '1rem' }}>{status.success}</p>
        )}
        {status.error && (
          <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>{status.error}</p>
        )}

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <button onClick={() => navigate('/login')} className="btn input-field">
            Volver a Iniciar Sesión
          </button>

          <button onClick={() => navigate('/')} className="btn input-field">
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
