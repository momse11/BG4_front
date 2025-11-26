export default function PartySprites({ sprites = [] }) {
  const OFFSET = 15;

  return (
    <div
      style={{
        position: "absolute",
        top: "5%",
        left: "50%",
        // ⬆⬆ SUBIMOS EL GRUPO COMPLETO DE SPRITES
        transform: "translate(-50%, -60%)",
        pointerEvents: "none",
        zIndex: 500,
      }}
    >
      {sprites.map((src, i) => {
        let x = 0;
        let y = 0;

        // Posiciones estilo ROMBO con separación 15px
        if (i === 0) {
          x = 0;
          y = 0;
        } else if (i === 1) {
          x = -OFFSET;
          y = OFFSET;
        } else if (i === 2) {
          x = OFFSET;
          y = OFFSET;
        } else if (i === 3) {
          x = 0;
          y = OFFSET * 2;
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
            }}
          />
        );
      })}
    </div>
  );
}