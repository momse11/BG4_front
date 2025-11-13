import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "../auth/AuthProvider";
import axios from "axios";

export default function PartidaView() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [partida, setPartida] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPartida = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`http://localhost:3000/api/v1/partidas/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPartida(response.data);
      } catch (err) {
        setError("No se pudo cargar la partida");
      } finally {
        setLoading(false);
      }
    };
    fetchPartida();
  }, [id]);

  if (loading) return <div>Cargando partida...</div>;
  if (error) return <div>{error}</div>;
  if (!partida) return <div>Partida no encontrada</div>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Partida #{partida.id}</h2>
      <p>Privada: {partida.privado ? "Sí" : "No"}</p>
      <p>Creador: {partida.creador_id}</p>

      <h3>Jugadores:</h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        {partida.jugadores?.map((j) => (
          <div
            key={j.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              width: "180px",
              textAlign: "center",
            }}
          >
            <p style={{ fontWeight: "bold" }}>{j.username}</p>
            {j.avatar_url && (
              <img
                src={j.avatar_url}
                alt={j.username}
                style={{ width: "80px", height: "80px", borderRadius: "50%", margin: "10px 0", objectFit: "cover" }}
              />
            )}
            <p>Email: {j.email}</p>
            <p>ID: {j.id}</p>
            <p>Online: {j.online ? "🟢" : "🔴"}</p>
            {j.bio && <p>Bio: {j.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
