import { createContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // mantener sesión
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
      const response = await axios.post("http://localhost:3000/api/v1/users/login", {
        email,
        username,
        password,
      });

      const { access_token, user } = response.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));

      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      setUser(user);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Credenciales incorrectas o error de conexión.");
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error("Error al crear partida:", error);
      throw error;
    }
  };

  // 🔹 Obtener partidas disponibles
  const getPartidas = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://localhost:3000/api/v1/partidas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error("Error al obtener partidas:", error);
      throw error;
    }
  };

  // 🔹 Unirse a una partida
  const joinPartida = async (id, contraseña = null) => {
    try {
      const token = localStorage.getItem("token");
      const body = contraseña ? { contraseña } : {};
      const response = await axios.post(
        `http://localhost:3000/api/v1/partidas/${id}/join`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error("Error al unirse a la partida:", error);
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <AuthContext.Provider
      value={{ user, login, logout, createPartida, getPartidas, joinPartida }}
    >
      {children}
    </AuthContext.Provider>
  );
}
