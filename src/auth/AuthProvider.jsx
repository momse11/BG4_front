//ve todo lo de autentufuacion, como el login y logout.
import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { loginUser as apiLoginUser, loginAdmin as apiLoginAdmin } from "../utils/api";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // mantener sesion
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    const adminToken = localStorage.getItem("admin_token");
    const adminData = localStorage.getItem("admin");

    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (adminToken && adminData) {
      setUser(JSON.parse(adminData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${adminToken}`;
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    setLoading(false);
  }, []);

  // login: intenta user -> si falla intenta admin
  const login = async ({ email, username, password }) => {
    try {
      // Intentar login como usuario (usa helper de api)
      const { token, user } = await apiLoginUser({ email, username, password });
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(user);
      setIsAdmin(false);
      return;
    } catch (err) {
      // Si falla el login de usuario, intentar admin
      console.warn("User login failed, trying admin...", err?.response?.data || err?.message);
      try {
        const { token: adminToken, admin } = await apiLoginAdmin({ email, password });
        localStorage.setItem("admin_token", adminToken);
        localStorage.setItem("admin", JSON.stringify(admin));
        axios.defaults.headers.common["Authorization"] = `Bearer ${adminToken}`;
        setUser(admin);
        setIsAdmin(true);
        return;
      } catch (err2) {
        console.error("Admin login also failed:", err2?.response?.data || err2?.message);
        alert("Credenciales incorrectas o error de conexión.");
      }
    }
  };

  // logout
  const logout = async () => {
    try {
      const token = localStorage.getItem("token");
      const adminToken = localStorage.getItem("admin_token");
      if (token) {
        await axios.post(
          "http://localhost:3000/api/v1/users/logout",
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      // No hay logout para admin en esta API por defecto; limpiamos localStorage
      if (adminToken) {
        // opcional: llamar a endpoint admin/logout si lo implementas
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin");
      delete axios.defaults.headers.common["Authorization"];
      setUser(null);
      setIsAdmin(false);
    }
  };

  // 🔹 Crear partida (ejemplo existente adaptado)
  const createPartida = async (form) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post("http://localhost:3000/api/v1/partidas", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.partida || response.data;
    } catch (error) {
      console.error("Error al crear partida:", error);
      const payload = error?.response?.data || { error: error.message || "Error al crear partida" };
      throw payload;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout, createPartida }}>
      {children}
    </AuthContext.Provider>
  );
}
