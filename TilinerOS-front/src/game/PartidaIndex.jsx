//muestra todas las partidas, para unirse

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function PartidaIndex() {
  const { getPartidas, joinPartida } = useContext(AuthContext);
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" }}>
      <h2>Partidas Disponibles</h2>
      {mensaje && <p style={{ color: "green" }}>{mensaje}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "400px" }}>
        {partidas.map((p) => (
          <div key={p.id} style={{ background: "#fff", padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}>
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
                style={{ marginTop: "5px", padding: "4px" }}
              />
            )}
            <button
              onClick={() => handleJoin(p)}
              style={{ marginTop: "8px", padding: "6px", cursor: "pointer" }}
            >
              Unirse
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
