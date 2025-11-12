//ve todo lo de autentufuacion, como el login y logout.
import { createContext, useState, useEffect } from "react";
import axios from "axios";

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
      const response = await axios.post("http://localhost:3000/api/v1/users/login", {
        email,
        username,
        password,
      });

      const { token, user } = response.data;

      // Guardar token y usuario
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Configurar axios para futuras peticiones
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

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
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      // Limpiar todo localmente
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      delete axios.defaults.headers.common["Authorization"];
      setUser(null);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
