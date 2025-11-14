import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/La Espina del Mundo.gif";

export default function SpineOfTheWorldView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={6} fondoPath={fondo} actorIds={actorIds} />;
}