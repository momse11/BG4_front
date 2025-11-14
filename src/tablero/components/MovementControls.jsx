export default function MovementControls({ onUp, onDown, onLeft, onRight }) {
  const btn = {
    padding: "6px 10px",
    margin: 6,
    borderRadius: 8,
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#fafafa",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button style={btn} onClick={onUp}>↑</button>
      <button style={btn} onClick={onLeft}>←</button>
      <button style={btn} onClick={onRight}>→</button>
      <button style={btn} onClick={onDown}>↓</button>
    </div>
  );
}
