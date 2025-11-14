import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Seros.gif";

export default function SerosView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={4} fondoPath={fondo} actorIds={actorIds} />;
}