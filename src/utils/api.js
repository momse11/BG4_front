//CONEXION CON API (con axios o axiom como se llame)

//estructura tentativa

import axios from 'axios'

const API_BASE_URL = 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Agrega token JWT a cada request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Maneja errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Token expirado o inválido. Redirigiendo al login...')
      localStorage.removeItem('token')
      // opcional: window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// --- API Functions ---

export const loginUser = async (credentials) => {
  const response = await api.post('/users/login', credentials)
  const { access_token, user } = response.data
  localStorage.setItem('token', access_token)
  return { token: access_token, user }
}

export const logoutUser = async () => {
  try {
    await api.post('/users/logout') // envía token automáticamente
  } catch (error) {
    console.error('Error cerrando sesión:', error)
  } finally {
    localStorage.removeItem('token')
  }
}

export const getCurrentUser = async () => {
  const response = await api.get('/users/me')
  return response.data
}

// Partida / Lobby APIs
export const getPartida = async (id) => {
  const r = await api.get(`/partidas/${id}`)
  return r.data
}

export const selectRaza = async (partidaId, raza) => {
  const r = await api.post(`/partidas/${partidaId}/select-raza`, { raza })
  return r.data
}

export const selectPersonaje = async (partidaId, personajeId) => {
  const r = await api.post(`/partidas/${partidaId}/select-personaje`, { personajeId })
  return r.data
}

// Personaje catalog
export const getRazas = async () => {
  const r = await api.get('/personaje/razas')
  return r.data.razas || []
}

export const getPersonajesByRaza = async (raza) => {
  const r = await api.get(`/personaje/raza/${encodeURIComponent(raza)}`)
  return r.data.personajes || []
}

//WEBSOCKETS (DESPUES)

export default api
