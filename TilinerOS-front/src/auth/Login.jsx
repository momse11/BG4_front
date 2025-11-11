import { useState, useContext } from 'react'
import { AuthContext } from './AuthProvider'

export default function Login() {
  const { user, login, logout } = useContext(AuthContext)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Aquí podrías validar los datos antes de enviar
    login(formData)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      {user ? (
        <>
          <h2>Hola, {user.username || user.name}</h2>
          <button onClick={logout}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <h2>Iniciar sesión</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="email"
              name="email"
              placeholder="Correo electrónico"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="username"
              placeholder="Nombre de usuario"
              value={formData.username}
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
        </>
      )}
    </div>
  )
}
