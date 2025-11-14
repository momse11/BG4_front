import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Baldurs Gate.gif";

export default function SubciudadView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={7} fondoPath={fondo} actorIds={actorIds} />;
}