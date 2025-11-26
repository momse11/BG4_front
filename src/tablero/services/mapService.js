import api from "../../utils/api.js";

// PERSONAJES
export const getPersonaje = (id) => api.get(`/personaje/${id}`);

// MAPAS
export const createMapa = (payload) => api.post(`/mapas`, payload);
export const getMapa = (id) => api.get(`/mapas/${id}`);

// CASILLAS
export const getCasilla = (id) => api.get(`/casillas/${id}`);
export const createCasilla = (payload) => api.post(`/casillas`, payload);

// JUGADAS / MOVIMIENTO (BACKEND REAL)
export const getJugada = (mapaId, jugadorId) =>
  api.get(`/jugadas/${mapaId}/${jugadorId}`);

export const moveJugador = (mapaId, jugadorId, data) =>
  api.patch(`/jugadas/${mapaId}/${jugadorId}`, data);