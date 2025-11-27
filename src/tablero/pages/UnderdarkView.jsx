import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Underdark.gif";

export default function UnderdarkView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={3} fondoPath={fondo} actorIds={actorIds} />;
}