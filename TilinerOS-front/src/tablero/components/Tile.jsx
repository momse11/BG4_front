export default function Tile({ tile, active, onClick }) {
  return (
    <div
      onClick={() => onClick(tile)}
      style={{
        width: "68px",
        height: "68px",
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.25)", // visible para debug
        position: "relative",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid yellow",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}