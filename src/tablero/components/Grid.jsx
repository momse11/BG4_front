import PartySprites from "./PartySprites";
import cofreIcon from "../../assets/tablero/Cofre.png";
import fogataIcon from "../../assets/tablero/Fogata.png";
import cartelIcon from "../../assets/tablero/Cartel.png";

export default function Grid({ casillas, pos, onTileClick, partySprites }) {
  const TILE = 68;
  const GAP = 1;

  const emptyRow = [null, null, null, null, null];
  const matrix = [
    [...emptyRow],
    [...emptyRow],
    [...emptyRow],
    [...emptyRow],
    [...emptyRow],
  ];

  casillas.forEach((c) => {
    matrix[5 - c.y][c.x - 1] = c;
  });

  const getTypeIcon = (tipo) => {
    tipo = (tipo || "").toLowerCase();
    if (tipo.includes("cofre")) return cofreIcon;
    if (tipo.includes("descanso")) return fogataIcon;
    if (tipo.includes("acceso") || tipo.includes("transito")) return cartelIcon;
    return null;
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(5, ${TILE}px)`,
        gridTemplateRows: `repeat(5, ${TILE}px)`,
        gap: `${GAP}px`,
        justifyContent: "center",
      }}
    >
      {matrix.flat().map((c, index) => {
        if (!c) return <div key={index} style={{ width: TILE, height: TILE }} />;

        const icon = getTypeIcon(c.tipo);
        const isBlock = (c.tipo || "").toLowerCase().includes("inaccesible");

        return (
          <div
            key={index}
            onClick={() => onTileClick(c)}
            style={{
              width: TILE,
              height: TILE,
              background: isBlock
                ? "rgba(255,255,255,0.07)"
                : "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
              position: "relative",
              imageRendering: "pixelated",
            }}
          >
            {/* SPRITES EN LA CASILLA ACTUAL */}
            {pos.x === c.x && pos.y === c.y && (
              <PartySprites sprites={partySprites} />
            )}

            {/* ÍCONOS DE COFRE / FOGATA / CARTEL (tamaño original) */}
            {icon && (
              <img
                src={icon}
                alt={c.tipo}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  imageRendering: "pixelated",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}