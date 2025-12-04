import { useMemo, useState, useEffect, useContext } from "react";
import "../../assets/styles/inventory.css";
import "../../assets/styles/trading.css";
import { AuthContext } from "../../auth/AuthProvider";

// ====================
//   CONSTANTES GLOBALES
// ====================
const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
).replace(/\/$/, "");

// Helper para fetch con timeout (por si el backend se cuelga)
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// Imágenes de objetos y recursos
const objetoImages = import.meta.glob(
  "/src/assets/objetos/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);
const tipoIcons = import.meta.glob(
  "/src/assets/recursos/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);

// Ciudades y comerciantes
const cityImages = import.meta.glob(
  "/src/assets/ciudades/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);
const merchantImages = import.meta.glob(
  "/src/assets/comerciantes/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);

function cleanKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "")
    .replaceAll("_", "");
}

function findImage(dict, name) {
  if (!name) return null;
  const key = cleanKey(name);
  for (const path in dict) {
    const file = path.split("/").pop().split(".")[0];
    if (cleanKey(file) === key) {
      return dict[path].default || dict[path];
    }
  }
  return null;
}

function findObjetoIcon(nombre) {
  return findImage(objetoImages, nombre);
}

function findTipoIcon(tipoNombre) {
  return findImage(tipoIcons, tipoNombre);
}

function capitalizeFirst(s) {
  const str = String(s || "").trim();
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sameIdFrontend(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

// ¿Está equipado este objeto en el personaje?
function isItemEquipped(item, pj) {
  if (!item || !pj) return false;

  const targetId = item.backendId ?? item.id ?? null;

  const slots = [
    "equipArma",
    "equipArmadura",
    "equipEscudo",
    "equipInstrumento",
    "equipCasco",
    "equipCapa",
    "equipGuantes",
    "equipBotas",
    "equipCollar",
    "equipAnillo1",
    "equipAnillo2",
  ];

  return slots.some((slot) => {
    const arr = Array.isArray(pj[slot]) ? pj[slot] : [];
    return arr.some((o) => {
      if (!o) return false;

      // Preferimos SIEMPRE comparar por IDs (backendId o id del objeto equipado)
      const equippedId = o.backendId ?? o.id ?? null;
      if (targetId != null && equippedId != null) {
        return sameIdFrontend(equippedId, targetId);
      }

      // Solo si NO tenemos IDs en ninguno, caemos al nombre como fallback
      if (!targetId && !equippedId && item.nombre && o.nombre) {
        return cleanKey(o.nombre) === cleanKey(item.nombre);
      }

      return false;
    });
  });
}

// Filtros con iconos concretos
const FILTERS = [
  { id: "armas", label: "Armas", iconKey: "Arma" },
  { id: "armadura", label: "Armadura", iconKey: "Armadura" },
  { id: "tesoros", label: "Tesoros", iconKey: "Tesoro" },
  { id: "comida", label: "Comida", iconKey: "Comida" },
  { id: "pociones", label: "Pociones", iconKey: "Poción" },
];

// Helper: transformar objetos backend → item visual
function mapBackendItem(raw, idx, source = "player") {
  const base =
    source === "merchant"
      ? raw.objeto || {}
      : raw.objeto || raw;

  if (!base) return null;

  const tipoRaw = String(base.tipo || "").trim();
  let categoria = null;
  switch (tipoRaw) {
    case "Arma":
      categoria = "armas";
      break;
    case "Armadura":
      categoria = "armadura";
      break;
    case "Pocion":
      categoria = "pociones";
      break;
    case "Suministro":
      categoria = "comida";
      break;
    case "Recurso":
      categoria = "tesoros";
      break;
    default:
      return null;
  }

  const icon = findObjetoIcon(base.nombre);

  let backendId;

  if (source === "merchant") {
    // Mercader: el objeto del backend viene claro
    backendId =
      base.id ??
      raw.objetoId ??
      raw.objeto_id ??
      raw.ObjetoId ??
      (raw.objeto && raw.objeto.id) ??
      raw.id ??
      idx;
  } else {
    // JUGADOR: forzar que sea SIEMPRE Objeto.id
    const objetoFromInclude = raw.objeto || raw.Objeto || null;

    const objetoIdReal =
      (objetoFromInclude && objetoFromInclude.id) ??
      raw.objetoId ??
      raw.objeto_id ??
      raw.ObjetoId ??
      base.id; // último fallback

    backendId = objetoIdReal ?? raw.id ?? idx;
  }

  return {
    id: raw.id ?? base.id ?? idx,
    backendId, // lo que mandamos al backend como objeto_id (y a /personaje/:id/objetos/:objetoId/…)
    nombre: base.nombre || "Sin nombre",
    categoria,
    icon,
    tipo: base.tipo || "",
    descripcion: base.descripcion || "",
    danio: base.Danio || null,
    tipoDanio: base.TipoDanio || null,
    defensaFisica: base.defensaFisica ?? 0,
    defensaMagica: base.defensaMagica ?? 0,
    precioOro:
      source === "merchant"
        ? raw.precioFinal ?? base.precioOro ?? 0
        : base.precioOro ?? 0,
    armaTipo: base.armaTipo ?? base.ArmaTipo ?? null,
    armaduraTipo: base.armaduraTipo ?? base.ArmaduraTipo ?? null,
    instrumentoTipo: base.instrumentoTipo ?? base.InstrumentoTipo ?? null,
    escudoTipo: base.escudoTipo ?? base.EscudoTipo ?? null,
    amuletoTipo: base.amuletoTipo ?? base.AmuletoTipo ?? null,
    cantidad: source === "merchant" ? raw.cantidad ?? 1 : raw.cantidad ?? 1,
    precioBase:
      source === "merchant"
        ? raw.precioBase ?? base.precioOro ?? 0
        : base.precioOro ?? 0,
  };
}

export default function TradingView({
  personaje,
  personajeId,
  items = [],
  ciudadNombre,
  mercader,
  mercaderInventario = [],
  isOpen = false,
  onClose = () => {},
}) {
  const [playerFilter, setPlayerFilter] = useState("armas");
  const [merchantFilter, setMerchantFilter] = useState("armas");

  const [personajeFull, setPersonajeFull] = useState(null);
  const [errorPj, setErrorPj] = useState(null);

  // Hovers independientes
  const [hoverMerchant, setHoverMerchant] = useState(null);
  const [hoverPlayer, setHoverPlayer] = useState(null);

  // Mensajes informativos independientes
  const [merchantMessage, setMerchantMessage] = useState("");
  const [playerMessage, setPlayerMessage] = useState("");

  // Estado local del mercader
  const [mercaderState, setMercaderState] = useState(
    () => mercader?.mercader || mercader || {}
  );

  // Inventario local del mercader
  const [merchantInventoryLocal, setMerchantInventoryLocal] = useState(null);

  // Flag anti-spam
  const [isTrading, setIsTrading] = useState(false);

  // === JWT / Auth ===
  const authCtx = useContext(AuthContext) || {};
  const jwtToken =
    authCtx.token ||
    authCtx.authToken ||
    authCtx.jwt ||
    authCtx.user?.token ||
    authCtx.user?.accessToken ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    null;

  const buildHeaders = (extra = {}) => {
    const headers = {
      Accept: "application/json",
      ...extra,
    };
    if (jwtToken) {
      headers.Authorization = `Bearer ${jwtToken}`;
    }
    return headers;
  };

  // Sincronizar estado local del mercader cuando cambie la prop
  useEffect(() => {
    setMercaderState(mercader?.mercader || mercader || {});
  }, [mercader]);

  // =========================
  //   Helpers para recargar PJ y Mercader (polling ligero)
  // =========================
  const reloadPersonaje = async () => {
    if (!personajeId) return;
    try {
      const res = await fetch(`${API_BASE}/personaje/${personajeId}`, {
        headers: buildHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const pj = (data && (data.personaje || data.data || data)) || null;
      if (pj) setPersonajeFull(pj);
    } catch (e) {
      console.error("[Trading] Error recargando personaje:", e);
    }
  };

  const reloadMercader = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/mercaderes/${id}`, {
        headers: buildHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data) return;
      if (data.mercader) setMercaderState(data.mercader);
      if (Array.isArray(data.inventario)) {
        setMerchantInventoryLocal(data.inventario);
      }
    } catch (e) {
      console.error("[Trading] Error recargando mercader:", e);
    }
  };

  // === Helpers específicos para inventario del personaje (JSON en Personaje) ===

  const addItemToPlayerInventory = async (objetoIdNum) => {
    if (!personajeId || !objetoIdNum) return false;
    try {
      const url = `${API_BASE}/personaje/${personajeId}/objetos/${objetoIdNum}/agregar`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: buildHeaders(),
        },
        8000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[Trading] Error al agregar al inventario:", data);
        setPlayerMessage(
          data?.error ||
            data?.message ||
            "Se compró el objeto, pero no se pudo agregar al inventario."
        );
        return false;
      }
      const pj =
        (data &&
          (data.personaje ||
            data.pj ||
            data.player ||
            (data.data && data.data.personaje))) ||
        null;
      if (pj) setPersonajeFull(pj);
      return true;
    } catch (e) {
      console.error("[Trading] Error de red al agregar al inventario:", e);
      setPlayerMessage(
        "Se compró el objeto, pero falló la actualización del inventario."
      );
      return false;
    }
  };

  const removeItemFromPlayerInventory = async (objetoIdNum) => {
    if (!personajeId || !objetoIdNum) return false;
    try {
      const url = `${API_BASE}/personaje/${personajeId}/objetos/${objetoIdNum}/quitar`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: buildHeaders(),
        },
        8000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[Trading] Error al quitar del inventario:", data);
        setMerchantMessage(
          data?.error ||
            data?.message ||
            "Se vendió el objeto, pero no se pudo quitar del inventario."
        );
        return false;
      }
      const pj =
        (data &&
          (data.personaje ||
            data.pj ||
            data.player ||
            (data.data && data.data.personaje))) ||
        null;
      if (pj) setPersonajeFull(pj);
      return true;
    } catch (e) {
      console.error("[Trading] Error de red al quitar del inventario:", e);
      setMerchantMessage(
        "Se vendió el objeto, pero falló la actualización del inventario."
      );
      return false;
    }
  };

  // =========================
  //   POLLING PERSONAJE (oro / inventario en vivo)
  // =========================
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    if (!personajeId || !isOpen) {
      return () => {
        cancelled = true;
        if (intervalId) clearInterval(intervalId);
      };
    }

    const load = async () => {
      try {
        if (cancelled) return;

        setErrorPj(null);
        const url = `${API_BASE}/personaje/${personajeId}`;

        const res = await fetch(url, {
          headers: buildHeaders(),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error(
            "[Trading] Error HTTP personaje",
            res.status,
            res.statusText,
            txt
          );
          if (!cancelled) {
            setErrorPj(
              res.status === 401
                ? "No autenticado. Vuelve a iniciar sesión."
                : `HTTP ${res.status}: Error en respuesta`
            );
          }
          return;
        }

        const data = await res.json().catch(() => null);
        const pj = (data && (data.personaje || data.data || data)) || null;

        if (!cancelled && pj) {
          setPersonajeFull(pj);
          setErrorPj(null);
        }
      } catch (e) {
        console.error("[Trading] Error cargando personaje (poll):", e);
        if (!cancelled) {
          setErrorPj(e?.message || "Error desconocido");
        }
      }
    };

    load();
    intervalId = setInterval(load, 2000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [personajeId, isOpen, jwtToken]);

  // =========================
  //   POLLING DEL MERCADER (para otros jugadores)
  // =========================
  const mercaderIdFromState =
    mercaderState.id ??
    mercaderState.mercaderId ??
    mercaderState.mercader_id ??
    null;

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    if (!mercaderIdFromState || !isOpen) {
      return () => {
        cancelled = true;
        if (intervalId) clearInterval(intervalId);
      };
    }

    const loadMercader = async () => {
      try {
        if (cancelled) return;

        const url = `${API_BASE}/mercaderes/${mercaderIdFromState}`;
        const res = await fetch(url, {
          headers: buildHeaders(),
        });

        if (!res.ok) return;

        const data = await res.json().catch(() => null);
        if (!data || cancelled) return;

        if (data.mercader) setMercaderState(data.mercader);
        if (Array.isArray(data.inventario)) {
          setMerchantInventoryLocal(data.inventario);
        }
      } catch (e) {
        console.error("[Trading] Error cargando mercader (poll):", e);
      }
    };

    loadMercader();
    intervalId = setInterval(loadMercader, 2000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [mercaderIdFromState, isOpen, jwtToken]);

  // =========================
  //   CERRAR CON ESC
  // =========================
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" || event.key === "Esc") {
        onClose();
        setHoverMerchant(null);
        setHoverPlayer(null);
        setMerchantMessage("");
        setPlayerMessage("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const pjSource = personajeFull || personaje || {};
  const mercaderData = mercaderState || {};

  // =========================
  //   DERIVADOS DEL PJ / MERCADER / CIUDAD
  // =========================
  const nombrePersonaje = capitalizeFirst(pjSource.nombre || "Sin nombre");
  const oroJugador = pjSource.oro ?? pjSource.Oro ?? 0;

  const nombreMercader = capitalizeFirst(
    mercaderData.nombre || "Mercader sin nombre"
  );
  const oroMercader = mercaderData.oro ?? 0;
  const mercaderId =
    mercaderData.id ??
    mercaderData.mercaderId ??
    mercaderData.mercader_id ??
    null;

  const oroIcon = findTipoIcon("Oro");

  const ciudadImageSrc = useMemo(
    () => findImage(cityImages, ciudadNombre),
    [ciudadNombre]
  );

  const mercaderSpriteSrc = useMemo(
    () => findImage(merchantImages, nombreMercader),
    [nombreMercader]
  );

  // =========================
  //   INVENTARIO JUGADOR / MERCADER
  // =========================
  const playerMappedItems = useMemo(() => {
    const sourceItems =
      (personajeFull && Array.isArray(personajeFull.inventario)
        ? personajeFull.inventario
        : items) || [];

    return sourceItems
      .map((o, idx) => mapBackendItem(o, idx, "player"))
      .filter(Boolean);
  }, [personajeFull, items]);

  const effectiveMerchantInventory =
    merchantInventoryLocal ??
    mercaderData.inventario ??
    mercaderInventario ??
    [];

  const merchantMappedItems = useMemo(
    () =>
      (effectiveMerchantInventory || [])
        .map((o, idx) => mapBackendItem(o, idx, "merchant"))
        .filter(Boolean),
    [effectiveMerchantInventory]
  );

  const filteredPlayerItems = useMemo(
    () =>
      playerMappedItems.filter((it) =>
        playerFilter ? it.categoria === playerFilter : true
      ),
    [playerMappedItems, playerFilter]
  );

  const filteredMerchantItems = useMemo(
    () =>
      merchantMappedItems.filter((it) =>
        merchantFilter ? it.categoria === merchantFilter : true
      ),
    [merchantMappedItems, merchantFilter]
  );

  // =========================
  //   TOOLTIP DETALLES
  // =========================
  const renderHoverDetails = (hoverInfo, message) => {
    if (!hoverInfo || !hoverInfo.item) {
      if (message) {
        return (
          <div className="inventory-details-content">
            <div className="inventory-tooltip-desc">{message}</div>
          </div>
        );
      }

      return (
        <div className="inventory-details-empty">
          Pasa el cursor sobre un objeto para ver sus detalles.
        </div>
      );
    }

    const item = hoverInfo.item;
    const tipoLower = String(item.tipo || "").toLowerCase();
    const isArma = tipoLower === "arma";
    const isArmadura = tipoLower === "armadura";
    const isPocion = tipoLower === "poción" || tipoLower === "pocion";
    const isSuministro = tipoLower === "suministro";
    const isRecurso = tipoLower === "recurso";

    const danoIcon = item.tipoDanio ? findTipoIcon(item.tipoDanio) : null;

    return (
      <div className="inventory-details-content">
        <div className="inventory-tooltip-name">{item.nombre}</div>

        {message && (
          <div className="inventory-tooltip-desc">{message}</div>
        )}

        {item.descripcion && (
          <div className="inventory-tooltip-desc">
            {item.descripcion}
          </div>
        )}

        {isArma && (
          <>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">Tipo:</span>
              <span className="inventory-tooltip-value">
                Arma {item.armaTipo || ""}
              </span>
            </div>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">Daño:</span>
              <span className="inventory-tooltip-value">
                {item.danio || "-"}
              </span>
            </div>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">
                Tipo de daño:
              </span>
              <span className="inventory-tooltip-value inventory-tooltip-damage">
                {danoIcon && (
                  <img
                    className="inventory-tooltip-damage-icon"
                    src={danoIcon}
                    alt={item.tipoDanio}
                  />
                )}
                {item.tipoDanio || "-"}
              </span>
            </div>
          </>
        )}

        {isArmadura && (
          <>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">Tipo:</span>
              <span className="inventory-tooltip-value">
                Armadura {item.armaduraTipo || ""}
              </span>
            </div>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">
                Def. física:
              </span>
              <span className="inventory-tooltip-value">
                {item.defensaFisica ?? 0}
              </span>
            </div>
            <div className="inventory-tooltip-row">
              <span className="inventory-tooltip-label">
                Def. mágica:
              </span>
              <span className="inventory-tooltip-value">
                {item.defensaMagica ?? 0}
              </span>
            </div>
          </>
        )}

        {(isPocion || isSuministro || isRecurso) && !item.descripcion && (
          <div className="inventory-tooltip-desc">
            Sin descripción.
          </div>
        )}

        <div className="inventory-tooltip-row">
          <span className="inventory-tooltip-label">Precio:</span>
          <span className="inventory-tooltip-value">
            {item.precioOro ?? 0} oro
          </span>
        </div>
      </div>
    );
  };

  // =========================
  //   HANDLERS COMERCIO
  // =========================

  // Comprar al mercader
  const handleBuyFromMerchant = async (item) => {
    console.log("[Trading] CLICK COMPRAR", {
      item,
      backendId: item?.backendId,
      personajeId,
      mercaderId,
    });

    if (!personajeId || !mercaderId || !item) {
      setPlayerMessage("No se puede completar la compra (datos incompletos).");
      return;
    }
    if (isTrading) return;

    const objetoIdNum = Number(item.backendId ?? item.id);
    const personajeIdNum = Number(personajeId);

    if (
      !objetoIdNum ||
      Number.isNaN(objetoIdNum) ||
      !personajeIdNum ||
      Number.isNaN(personajeIdNum)
    ) {
      console.error("[Trading] IDs inválidos para comprar:", {
        objetoIdNum,
        personajeIdNum,
        rawItem: item,
      });
      setPlayerMessage(
        "No se pudo determinar el ID del objeto o del personaje."
      );
      return;
    }

    const precio = item.precioOro ?? 0;
    const oroActual = oroJugador ?? 0;

    if (oroActual < precio) {
      setPlayerMessage("No tienes suficiente oro para comprar este objeto.");
      return;
    }

    try {
      setIsTrading(true);
      setPlayerMessage("");
      setMerchantMessage("");

      const bodyPayload = {
        objeto_id: objetoIdNum,
        personaje_id: personajeIdNum,
      };

      const url = `${API_BASE}/mercaderes/${mercaderId}/comprar`;
      console.log("[Trading] PUT COMPRAR", url, bodyPayload);

      const res = await fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: buildHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(bodyPayload),
        },
        8000
      );

      const data = await res.json().catch(() => null);
      console.log("[Trading] RESPUESTA COMPRAR", res.status, data);

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (res.status === 401
            ? "No autenticado. Vuelve a iniciar sesión."
            : `No se ha podido comprar el objeto. (HTTP ${res.status})`);
        setPlayerMessage(msg);
        return;
      }

      const merc =
        (data &&
          (data.mercader ||
            data.merchant ||
            data.merch ||
            (data.data && data.data.mercader))) ||
        null;
      const inv =
        (data && (data.inventario || data.mercaderInventario)) ||
        (merc && merc.inventario) ||
        null;

      if (merc) setMercaderState(merc);
      if (Array.isArray(inv)) setMerchantInventoryLocal(inv);

      await addItemToPlayerInventory(objetoIdNum);

      reloadPersonaje();
      reloadMercader(mercaderId);

      setPlayerMessage(
        data?.message ||
          `Has comprado ${item.nombre || "un objeto"} por ${precio} oro.`
      );
    } catch (e) {
      console.error("[Trading] Error al comprar objeto:", e);

      if (e.name === "AbortError") {
        setPlayerMessage("El servidor tardó demasiado en responder (timeout).");
      } else {
        setPlayerMessage(
          `Error de red al comprar el objeto: ${e.message || e.toString()}`
        );
      }
    } finally {
      setIsTrading(false);
    }
  };

  // Vender al mercader
  const handleSellToMerchant = async (item) => {
    console.log("[Trading] CLICK VENDER", {
      item,
      backendId: item?.backendId,
      personajeId,
      mercaderId,
    });

    if (!personajeId || !mercaderId || !item) {
      setMerchantMessage("No se puede completar la venta (datos incompletos).");
      return;
    }
    if (isTrading) return;

    const objetoIdNum = Number(item.backendId ?? item.id);
    const personajeIdNum = Number(personajeId);

    if (
      !objetoIdNum ||
      Number.isNaN(objetoIdNum) ||
      !personajeIdNum ||
      Number.isNaN(personajeIdNum)
    ) {
      console.error("[Trading] IDs inválidos para vender:", {
        objetoIdNum,
        personajeIdNum,
        rawItem: item,
      });
      setMerchantMessage(
        "No se pudo determinar el ID del objeto o del personaje."
      );
      return;
    }

    const pjNow = personajeFull || personaje || {};
    if (isItemEquipped(item, pjNow)) {
      setMerchantMessage("No puedes vender un objeto equipado.");
      return;
    }

    try {
      setIsTrading(true);
      setPlayerMessage("");
      setMerchantMessage("");

      const bodyPayload = {
        objeto_id: objetoIdNum,
        personaje_id: personajeIdNum,
      };

      const url = `${API_BASE}/mercaderes/${mercaderId}/vender`;
      console.log("[Trading] PUT VENDER", url, bodyPayload);

      const res = await fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: buildHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(bodyPayload),
        },
        8000
      );

      const data = await res.json().catch(() => null);
      console.log("[Trading] RESPUESTA VENDER", res.status, data);

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (res.status === 401
            ? "No autenticado. Vuelve a iniciar sesión."
            : `No se ha podido vender el objeto. (HTTP ${res.status})`);

        setMerchantMessage(msg);
        return;
      }

      const precio = data?.precioPagado ?? item.precioOro ?? 0;

      const merc =
        (data &&
          (data.mercader ||
            data.merchant ||
            data.merch ||
            (data.data && data.data.mercader))) ||
        null;
      const inv =
        (data && (data.inventario || data.mercaderInventario)) ||
        (merc && merc.inventario) ||
        null;

      if (merc) setMercaderState(merc);
      if (Array.isArray(inv)) setMerchantInventoryLocal(inv);

      await removeItemFromPlayerInventory(objetoIdNum);

      reloadPersonaje();
      reloadMercader(mercaderId);

      setMerchantMessage(
        data?.message ||
          `El mercader ha comprado ${item.nombre || "un objeto"} por ${precio} oro.`
      );
    } catch (e) {
      console.error("[Trading] Error al vender objeto:", e);
      if (e.name === "AbortError") {
        setMerchantMessage(
          "El servidor tardó demasiado en responder (timeout)."
        );
      } else {
        setMerchantMessage(
          `Error de red al vender el objeto: ${e.message || e.toString()}`
        );
      }
    } finally {
      setIsTrading(false);
    }
  };

  // =========================
  //   OVERLAY HANDLERS
  // =========================
  const overlayClassName = `inventory-overlay${
    isOpen ? "" : " inventory-hidden"
  }`;

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
      setHoverMerchant(null);
      setHoverPlayer(null);
      setMerchantMessage("");
      setPlayerMessage("");
    }
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  // =========================
  //   RENDER
  // =========================
  return (
    <div
      id="trading-overlay"
      className={overlayClassName}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="inventory-modal trading-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
      >
        <div className="trading-layout">
          {/* IZQUIERDA: COMERCIANTE */}
          <section className="trading-column trading-column--left">
            <header className="trading-header">
              <div className="trading-name">
                {nombreMercader || "Sin mercader"}
              </div>
              <div className="trading-gold">
                {oroIcon && (
                  <img
                    className="trading-gold-icon"
                    src={oroIcon}
                    alt="Oro"
                  />
                )}
                <span className="trading-gold-amount">
                  {oroMercader ?? 0}
                </span>
              </div>
            </header>

            <div className="inventory-right-bottom trading-inventory">
              <div className="inventory-filters">
                {FILTERS.map((f) => {
                  const iconTipo = findTipoIcon(f.iconKey);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={
                        "filter-btn" +
                        (merchantFilter === f.id ? " is-active" : "")
                      }
                      onClick={() => {
                        setMerchantFilter(f.id);
                        setHoverMerchant(null);
                        setMerchantMessage("");
                      }}
                    >
                      {iconTipo && (
                        <img
                          className="filter-icon"
                          src={iconTipo}
                          alt={f.label}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="inventory-grid-wrapper">
                <div className="inventory-grid">
                  {filteredMerchantItems.length === 0 && (
                    <div className="inventory-empty-text">
                      El mercader no tiene objetos de este tipo
                      o no se ha cargado su inventario.
                    </div>
                  )}
                  {filteredMerchantItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="inventory-slot"
                      data-type={item.categoria}
                      title={item.nombre}
                      onClick={() => handleBuyFromMerchant(item)}
                      onMouseEnter={() => {
                        setHoverMerchant({ item });
                        setHoverPlayer(null);
                      }}
                      onMouseLeave={() => setHoverMerchant(null)}
                      disabled={isTrading}
                    >
                      {item.icon && (
                        <div className="inventory-slot-icon">
                          <img src={item.icon} alt={item.nombre} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel de detalles SOLO comerciante */}
              <div className="inventory-details-panel trading-details-panel">
                {renderHoverDetails(hoverMerchant, merchantMessage)}
              </div>
            </div>
          </section>

          {/* CENTRO: CIUDAD + SPRITE MERCADER */}
          <section className="trading-center">
            <div className="trading-city-wrapper">
              {ciudadImageSrc ? (
                <img
                  className="trading-city-image"
                  src={ciudadImageSrc}
                  alt={ciudadNombre || "Ciudad"}
                />
              ) : (
                <div className="trading-city-fallback">
                  <span className="trading-city-fallback-title">
                    {ciudadNombre || "Ciudad desconocida"}
                  </span>
                </div>
              )}

              {mercaderSpriteSrc && (
                <div className="trading-merchant-sprite">
                  <img
                    src={mercaderSpriteSrc}
                    alt={nombreMercader}
                  />
                </div>
              )}
            </div>
          </section>

          {/* DERECHA: JUGADOR */}
          <section className="trading-column trading-column--right">
            <header className="trading-header">
              <div className="trading-name">
                {nombrePersonaje || "Sin nombre"}
              </div>
              <div className="trading-gold">
                {oroIcon && (
                  <img
                    className="trading-gold-icon"
                    src={oroIcon}
                    alt="Oro"
                  />
                )}
                <span className="trading-gold-amount">
                  {oroJugador ?? 0}
                </span>
              </div>
            </header>

            <div className="inventory-right-bottom trading-inventory">
              <div className="inventory-filters">
                {FILTERS.map((f) => {
                  const iconTipo = findTipoIcon(f.iconKey);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={
                        "filter-btn" +
                        (playerFilter === f.id ? " is-active" : "")
                      }
                      onClick={() => {
                        setPlayerFilter(f.id);
                        setHoverPlayer(null);
                        setPlayerMessage("");
                      }}
                    >
                      {iconTipo && (
                        <img
                          className="filter-icon"
                          src={iconTipo}
                          alt={f.label}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="inventory-grid-wrapper">
                <div className="inventory-grid">
                  {filteredPlayerItems.length === 0 && (
                    <div className="inventory-empty-text">
                      No tienes objetos de este tipo
                      o no se ha cargado tu inventario.
                    </div>
                  )}
                  {filteredPlayerItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="inventory-slot"
                      data-type={item.categoria}
                      title={item.nombre}
                      onClick={() => handleSellToMerchant(item)}
                      onMouseEnter={() => {
                        setHoverPlayer({ item });
                        setHoverMerchant(null);
                      }}
                      onMouseLeave={() => setHoverPlayer(null)}
                      disabled={isTrading}
                    >
                      {item.icon && (
                        <div className="inventory-slot-icon">
                          <img src={item.icon} alt={item.nombre} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {errorPj && (
                <div className="inventory-error-text trading-error">
                  {errorPj}
                </div>
              )}

              {/* Panel de detalles SOLO jugador */}
              <div className="inventory-details-panel trading-details-panel">
                {renderHoverDetails(hoverPlayer, playerMessage)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}