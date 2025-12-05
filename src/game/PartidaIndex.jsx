//muestra todas las partidas, para unirse

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import "../assets/styles/crearpartida.css"; // Importar estilos

export default function PartidaIndex() {
const { getPartidas, joinPartida, isAdmin } = useContext(AuthContext);
  const [partidas, setPartidas] = useState([]);
  const [contraseñas, setContraseñas] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await getPartidas();
        setPartidas(data);
      } catch {
        setError("Error al cargar las partidas");
      }
    })();
  }, [getPartidas]);

  const handleJoin = async (p) => {
    try {
      const res = await joinPartida(p.id, p.privado ? contraseñas[p.id] : null);
      if (res.joined) {
        setMensaje(`Te uniste a la partida #${p.id}`);
        setTimeout(() => navigate(`/partida/${p.id}`), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error al unirse a la partida");
    }
  };

  return (
    <div className="crearpartida-wrapper">
      <div className="crearpartida-card">
        <h2>Partidas Disponibles</h2>

        {mensaje && <div className="msg-success">{mensaje}</div>}
        {error && <div className="msg-error">{error}</div>}

        {partidas.map((p) => (
          <div
            key={p.id}
            style={{
              marginBottom: "1rem",
              padding: "0.8rem",
              borderRadius: "8px",
              border: "1px solid rgba(110, 231, 183, 0.15)",
              background: "rgba(2,6,12,0.2)",
            }}
          >
            <strong>Partida #{p.id}</strong>
            <div>Privada: {p.privado ? "Sí 🔒" : "No 🔓"}</div>

            {p.privado && (
              <input
                type="password"
                placeholder="Contraseña"
                value={contraseñas[p.id] || ""}
                onChange={(e) =>
                  setContraseñas({ ...contraseñas, [p.id]: e.target.value })
                }
                className="input-field"
              />
            )}

            <button
              onClick={() => handleJoin(p)}
              className="btn-acuosa"
              style={{ marginTop: "0.5rem" }}
            >
              Unirse
            </button>
          </div>
        ))}

        <button
          onClick={() => navigate("/")}
          className="btn-secondary"
        >
          Volver a Landing
        </button>
      </div>
    </div>
  );
}