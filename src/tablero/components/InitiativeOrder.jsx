import marco from "../../assets/tablero/Marco.png";

export default function InitiativeOrder({ order = [], turnIndex = 0 }) {
  return (
    <div
      style={{
        width: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
      }}
    >
      {order.map((o, i) => (
        <div key={o.actor?.id || i} style={{ position: "relative", width: 92, height: 92 }}>
          <img
            src={o.actor?.portrait}
            alt={o.actor?.nombre || "pj"}
            style={{
              position: "absolute",
              inset: 6,
              width: "auto",
              height: "auto",
              maxWidth: 80,
              maxHeight: 80,
              borderRadius: 8,
              objectFit: "cover",
              filter: i === turnIndex ? "none" : "grayscale(0.25)",
              transform: i === turnIndex ? "scale(1.02)" : "scale(1.0)",
            }}
          />
          <img
            src={marco}
            alt="marco"
            style={{
              position: "absolute",
              inset: 0,
              width: 92,
              height: 92,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -18,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 12,
              textAlign: "center",
              width: 100,
            }}
          >
            {o.actor?.nombre || "PJ"} <br />
            <span style={{ opacity: 0.7 }}>Init: {o.iniciativa}</span>
          </div>
        </div>
      ))}
    </div>
  );
}