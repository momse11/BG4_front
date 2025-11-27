import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/High Forest.gif";

export default function HighForestView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={2} fondoPath={fondo} actorIds={actorIds} />;
}