import { useContext } from 'react'
import { AuthContext } from './AuthProvider'

export default function Login() {
  const { user, login, logout } = useContext(AuthContext)

  return (
    <div>
      {user ? (
        <>
          <h2>Hola, {user.name}</h2>
          <button onClick={logout}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <h2>Iniciar sesión</h2>
          <button onClick={() => login('Usuario')}>Entrar</button>
        </>
      )}
    </div>
  )
}