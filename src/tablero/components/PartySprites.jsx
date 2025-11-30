export default function PartySprites({ sprites = [] }) {
  const OFFSET = 16;
  const total = sprites.length;

  // Definimos posiciones tipo rombo:
  //   back:    (0, -OFFSET)
  //   left:    (-OFFSET, 0)
  //   right:   (OFFSET, 0)
  //   front:   (0, OFFSET)
  //
  // El último sprite del array es el "front" (el que juega este turno).
  if (!total) return null;

  const positionsForOthers = [
    { x: 0, y: -OFFSET },      // back
    { x: -OFFSET, y: 0 },      // left
    { x: OFFSET, y: 0 },       // right
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -60%)",
        pointerEvents: "none",
        zIndex: 500,
      }}
    >
      {sprites.map((src, i) => {
        const isFront = i === total - 1;

        let x = 0;
        let y = 0;

        if (isFront) {
          // Adelante del rombo
          x = 0;
          y = OFFSET;
        } else {
          // repartimos los demás en back / left / right
          const pos = positionsForOthers[i] || positionsForOthers[positionsForOthers.length - 1];
          x = pos.x;
          y = pos.y;
        }

        return (
          <img
            key={i}
            src={src}
            alt="party-sprite"
            style={{
              position: "absolute",
              top: `${y}px`,
              left: `${x}px`,
              transform: "translate(-50%, -50%)",
              imageRendering: "pixelated",
              pointerEvents: "none",
              zIndex: isFront ? 3 : 2,
            }}
          />
        );
      })}
    </div>
  );
}