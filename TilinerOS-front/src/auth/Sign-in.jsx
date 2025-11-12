import { useState } from 'react'
import api from '../api' // importa tu instancia de axios

export default function SignIn() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  })

  const [status, setStatus] = useState({ loading: false, success: '', error: '' })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
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
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || 'Error al crear la cuenta. Intenta nuevamente.'
      setStatus({ loading: false, success: '', error: errorMsg })
      console.error('Error creando usuario:', error)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      <h2>Crear cuenta</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        <input
          type="text"
          name="username"
          placeholder="Nombre de usuario"
          value={formData.username}
          onChange={handleChange}
          required
        />
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
        <button type="submit" disabled={status.loading}>
          {status.loading ? 'Creando cuenta...' : 'Registrarse'}
        </button>
      </form>

      {status.success && <p style={{ color: 'green' }}>{status.success}</p>}
      {status.error && <p style={{ color: 'red' }}>{status.error}</p>}
    </div>
  )
}
