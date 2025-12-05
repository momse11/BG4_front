// CONEXION CON API (con axios o axiom como se llame)

import axios from 'axios'

export const API_BASE_URL = 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Agrega token JWT a cada request
api.interceptors.request.use(
  (config) => {
    // Admin token para rutas /admin toma prioridad si existe
    const adminToken = localStorage.getItem('admin_token');
    const token = localStorage.getItem('token');
    if (config.url && config.url.startsWith('/admin') && adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

export const selectClase = async (partidaId, clase) => {
  const r = await api.post(`/partidas/${partidaId}/select-clase`, { clase })
  return r.data
}

export const selectPersonaje = async (partidaId, personajeId) => {
  const r = await api.post(`/partidas/${partidaId}/select-personaje`, { personajeId })
  return r.data
}

// salir de una partida
export const leavePartida = async (partidaId) => {
  const r = await api.post(`/partidas/${partidaId}/leave`)
  return r.data
}

// 👇 NUEVO: eliminar explícitamente una partida (DELETE /partidas/{id})
export const deletePartida = async (id) => {
  await api.delete(`/partidas/${id}`)
  // backend responde 204 sin body
}

// Personaje catalog
export const getClases = async () => {
  const r = await api.get('/personaje/clases')
  return r.data.clases || []
}

export const getPersonajesByClase = async (clase) => {
  const r = await api.get(`/personaje/clase/${encodeURIComponent(clase)}`)
  return r.data.personajes || []
}

// ADMIN APIs
export const loginAdmin = async (credentials) => {
  const response = await api.post('/admin/login', credentials);
  const { access_token, admin } = response.data;
  if (access_token) localStorage.setItem('admin_token', access_token);
  return { token: access_token, admin };
}

export const logoutAdmin = () => {
  localStorage.removeItem('admin_token');
}

export const getAdminUsers = async () => {
  const r = await api.get('/users');
  return r.data;
}

export const deleteUserAdmin = async (id) => {
  await api.delete(`/admin/users/${id}`);
}

// WEBSOCKETS (DESPUES)

export default api