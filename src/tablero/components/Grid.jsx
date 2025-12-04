import PartySprites from "./PartySprites";
import cofreIcon from "../../assets/tablero/Cofre.png";
import fogataIcon from "../../assets/tablero/Fogata.gif";
import cartelIcon from "../../assets/tablero/Cartel.png";
import bossIcon from "../../assets/tablero/Jefe.gif"; // 👈 NUEVO

export default function Grid({
  casillas,
  pos,
  onTileClick,
  partySprites,
  partySpritesMap,
  canMove = true,
  allowedTiles = new Set(), // ⬅ set de casillas clickeables este turno
}) {
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
    if (tipo.includes("jefe")) return bossIcon;       // 👈 NUEVO
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

        const key = `${c.x},${c.y}`;
        const icon = getTypeIcon(c.tipo);
        const isBlock = (c.tipo || "").toLowerCase().includes("inacces");
        const isAllowed = allowedTiles.has(key); // ⬅ solo estas se pueden usar
        const isClickable = canMove && isAllowed;

        const background = isBlock
          ? "rgba(10, 15, 0, 0.07)"      // #0A0F00 con transparencia
          : isAllowed
          ? "rgba(74, 105, 49, 0.25)"   // #4A6931 con transparencia
          : "rgba(192, 166, 108, 0.15)"; // #C0A66C con transparencia

        const border = isAllowed
          ? "1px solid #4A6931"
          : "1px solid #C0A66C";

        return (
          <div
            key={index}
            onClick={
              isClickable
                ? () => {
                    onTileClick(c);
                  }
                : undefined
            }
            style={{
              width: TILE,
              height: TILE,
              background,
              border,
              position: "relative",
              imageRendering: "pixelated",
              cursor: isClickable ? "pointer" : "default",
              opacity: isBlock ? 0.5 : 1,
            }}
          >
            {/* SPRITES: soporte para mapa de sprites por casilla (`partySpritesMap`) o fallback a `partySprites` en la posición `pos` */}
            {(() => {
              const spritesKey = `${c.x},${c.y}`;
              const spritesForTile =
                partySpritesMap && partySpritesMap[spritesKey]
                  ? partySpritesMap[spritesKey]
                  : pos && pos.x === c.x && pos.y === c.y
                  ? partySprites
                  : null;
              return spritesForTile && spritesForTile.length ? (
                <PartySprites sprites={spritesForTile} />
              ) : null;
            })()}

            {/* ÍCONOS DE COFRE / FOGATA / CARTEL / JEFE */}
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