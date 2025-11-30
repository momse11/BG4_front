export default function MovementControls({ onUp, onDown, onLeft, onRight }) {
  const btn = {
    padding: "6px 10px",
    margin: 6,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.4)",
    cursor: "pointer",
    background: "transparent",         
    color: "#C0A66C",
    fontFamily: "'Press Start 2P', cursive",
    fontSize: 10,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <button style={btn} onClick={onUp}>↑</button>
      <button style={btn} onClick={onLeft}>←</button>
      <button style={btn} onClick={onRight}>→</button>
      <button style={btn} onClick={onDown}>↓</button>
    </div>
  );
}