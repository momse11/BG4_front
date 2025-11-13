//ve todo lo de autentufuacion, como el login y logout.
import { createContext, useState, useEffect } from "react";
import axios from "axios";
import api from '../utils/api'

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // mantener sesion
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  // login
  const login = async ({ email, username, password }) => {
    try {
      // usar la instancia `api` con baseURL y manejo de token
      const response = await api.post('/users/login', { email, username, password });
      const { access_token, user } = response.data;

      // Guardar token y usuario
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Configurar axios globalmente (por si otros módulos usan axios directamente)
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(user);

      return { user, token: access_token };
    } catch (error) {
      console.error('Error al iniciar sesión en AuthProvider:', error?.response?.data || error.message);
      // lanzar el error para que el componente de UI lo capture y muestre un mensaje
      throw error;
    }
  };

  // logout
  const logout = async () => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      await axios.post(
        "http://localhost:3000/api/v1/users/logout",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  }
};

  // 🔹 Crear partida
  const createPartida = async (form) => {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      "http://localhost:3000/api/v1/partidas",
      form,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    // response.data may contain { partida }
    return response.data.partida || response.data;
  } catch (error) {
    console.error("Error al crear partida:", error);
    throw error;
  }
};


  if (loading) return <div>Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, createPartida }}>
      {children}
    </AuthContext.Provider>
  );
}
