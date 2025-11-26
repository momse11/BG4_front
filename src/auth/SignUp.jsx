import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

import { AuthContext } from './AuthProvider'

import '../assets/styles/landing.css'
import '../assets/styles/signup.css'

export default function SignUp() {
  const navigate = useNavigate()
  const { login } = useContext(AuthContext)

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

      await login({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      })

      setStatus({
        loading: false,
        success: `Cuenta creada con éxito. Bienvenido/a, ${response.data.username}!`,
        error: ''
      })

      navigate('/landing')
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || 'Error al crear la cuenta o iniciar sesión.'
      setStatus({ loading: false, success: '', error: errorMsg })
    }
  }

  return (
    <div className="landing-pixel-root">
      <div className="auth-card">
        <h2 className="auth-title">Crear cuenta</h2>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <input
            type="text"
            name="username"
            placeholder="Nombre de usuario"
            value={formData.username}
            onChange={handleChange}
            required
            className="auth-input"
          />

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
            disabled={status.loading}
            className="pixel-button auth-button-primary"
          >
            {status.loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        {status.success && (
          <p className="auth-success">{status.success}</p>
        )}
        {status.error && (
          <p className="auth-error">{status.error}</p>
        )}

        <div className="auth-buttons auth-buttons-bottom">
          <p className="auth-question">¿Tienes cuenta?</p>

          <button
            onClick={() => navigate('/login')}
            className="pixel-button auth-button-primary"
          >
            Iniciar sesión
          </button>

          <button
            onClick={() => navigate('/')}
            className="pixel-button auth-button-primary"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}