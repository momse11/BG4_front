import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Avernus.gif";

export default function AvernusView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={8} fondoPath={fondo} actorIds={actorIds} />;
}