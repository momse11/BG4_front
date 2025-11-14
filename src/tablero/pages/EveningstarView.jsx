import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Eveningstar.gif";


console.log("EveningstarView CARGÓ");

export default function EveningstarView() {
  // ejemplo actorIds; pásalos desde rutas o props reales
  const actorIds = [1, 2, 3, 4]; // ids válidos de /personaje/{id}
  return <MapView mapaId={1} fondoPath={fondo} actorIds={actorIds} />;
}