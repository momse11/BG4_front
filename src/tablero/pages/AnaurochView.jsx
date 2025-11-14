import MapView from "./MapView";
import fondo from "../../assets/tablero/mapas/Anauroch.gif";

export default function AnaurochView() {
  const actorIds = [1, 2, 3];
  return <MapView mapaId={5} fondoPath={fondo} actorIds={actorIds} />;
}