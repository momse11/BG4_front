import Grid from "../components/Grid";
import marco from "../../assets/tablero/Marco.png";
import { useMapLogic } from "../hooks/useMapLogic";

const fondos = import.meta.glob("/src/assets/tablero/mapas/*", { eager: true });

function clean(s) {
  return String(s).toLowerCase().replaceAll(" ", "").replaceAll("_", "");
}

function getFondo(name) {
  const key = clean(name);
  for (const p in fondos) {
    const file = p.split("/").pop().split(".")[0];
    if (clean(file) === key) return fondos[p].default;
  }
  return null;
}

export default function MapView({ mapaId, personajesIds }) {
  const { loading, mapa, casillas, pos, order } =
    useMapLogic({ mapaId, personajesIds });

  if (loading) return <div style={{ color: "#fff" }}>Cargando...</div>;
  if (!mapa) return <div style={{ color: "#fff" }}>Error cargando mapa</div>;

  const fondoMapa = getFondo(mapa.nombre);

  // ✔ Orden correcto: mayor iniciativa → más a la izquierda
  const sortedOrder = [...order].sort((a, b) => b.iniciativa - a.iniciativa);

  // ✔ Sprites en orden descendente por iniciativa
  const partySprites = sortedOrder
    .map((o) => o.actor.sprite)
    .filter(Boolean);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Press Start 2P', cursive",
        color: "white",
      }}
    >
      {/* 🔷 MARCOS + RETRATOS SIN ESCALAR */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {sortedOrder.map((slot, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
            }}
          >
            {/* Retrato atrás del marco, sin escalar */}
            {slot.actor.portrait && (
              <img
                src={slot.actor.portrait}
                alt={slot.actor.nombre}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1,
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Marco en tamaño ORIGINAL */}
            <img
              src={marco}
              alt="Marco"
              style={{
                position: "relative",
                zIndex: 2,
                display: "block",
                imageRendering: "pixelated",
                pointerEvents: "none",
              }}
            />
          </div>
        ))}
      </div>

      {/* 🔷 MAPA + GRID */}
      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Fondo GIF */}
        {fondoMapa && (
          <img
            src={fondoMapa}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              imageRendering: "pixelated",
            }}
          />
        )}

        {/* Grid */}
        <Grid
          casillas={casillas}
          pos={pos}
          onTileClick={() => {}}
          partySprites={partySprites}
        />
      </div>

      {/* 🔷 Nombre del mapa abajo en 8 bits */}
      <div style={{ marginBottom: 25, fontSize: 18 }}>
        {mapa.nombre}
      </div>
    </div>
  );
}