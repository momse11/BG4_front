import { useParams } from "react-router-dom";
import MapView from "./MapView";
import { useEffect, useState } from "react";
import api from "../../utils/api";

export default function MapViewWrapper() {
  const { partidaId, mapaId } = useParams();
  const [personajesIds, setPersonajesIds] = useState(null);

  useEffect(() => {
    async function loadPartida() {
      try {
        const res = await api.get(`/partidas/${partidaId}`);
        const ids = res?.data?.partida?.personajes || [];
        setPersonajesIds(ids);
      } catch (err) {
        console.error("❌ Error cargando partida:", err);
      }
    }

    loadPartida();
  }, [partidaId]);

  if (!personajesIds)
    return <div style={{ color: "white" }}>Cargando personajes...</div>;

  return <MapView partidaId={partidaId} mapaId={mapaId} personajesIds={personajesIds} />;
}