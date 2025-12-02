import { useMemo, useState, useEffect } from "react";
import "../../assets/styles/inventory.css";

// Solo imágenes
const mapImages = import.meta.glob(
  "/src/assets/mapas/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);
const characterImages = import.meta.glob(
  "/src/assets/personajes/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);
const objetoImages = import.meta.glob(
  "/src/assets/objetos/*.{png,jpg,jpeg,gif,webp,svg}",
  { eager: true }
);
const tipoIcons = import.meta.glob(
  "/src/assets/recursos/*.{png,jpg,jpeg,gif,webp,svg}",
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

// =========================
//   XP igual que backend
// =========================
const XP_BASE = 200;
const XP_GROWTH = 1.5;
const XP_MAX_LEVEL = 20;

function xpThresholdForLevel(level) {
  if (level <= 1) return 0;
  const lvl = Math.min(level, XP_MAX_LEVEL);
  return XP_BASE * (Math.pow(XP_GROWTH, lvl - 1) - 1);
}

function computeXpProgress(experiencia = 0, nivel = 1) {
  const clampedLevel = Math.max(1, Math.min(nivel, XP_MAX_LEVEL));

  const next =
    clampedLevel >= XP_MAX_LEVEL
      ? experiencia
      : xpThresholdForLevel(clampedLevel + 1);

  const neededTotal = Math.max(1, next);
  const rawPct = neededTotal > 0 ? experiencia / neededTotal : 0;
  const pct =
    clampedLevel >= XP_MAX_LEVEL
      ? 100
      : Math.max(0, Math.min(100, Math.round(rawPct * 100)));

  return {
    current: experiencia,
    needed: next,
    pct,
  };
}

// =========================
//   Recursos / PA igual que backend
// =========================
function recursosPorNivel(nivel) {
  if (nivel <= 2) return 1;
  if (nivel <= 4) return 2;
  if (nivel <= 6) return 3;
  if (nivel <= 8) return 4;
  if (nivel <= 10) return 5;
  return 6;
}

function puntosAccionPorNivel(nivel) {
  const pa = { n1: 0, n2: 0, n3: 0, n4: 0 };
  if (nivel >= 1) pa.n1 = 0;
  if (nivel >= 3) pa.n1 = 1;
  if (nivel >= 4) pa.n1 = 2;
  if (nivel >= 5) pa.n1 = 3;
  if (nivel >= 6) pa.n1 = 4;
  if (nivel >= 6) pa.n2 = 1;
  if (nivel >= 7) pa.n2 = 2;
  if (nivel >= 8) pa.n2 = 3;
  if (nivel >= 9) pa.n3 = 1;
  if (nivel >= 10) pa.n3 = 2;
  if (nivel >= 11) pa.n3 = 2;
  if (nivel >= 12) pa.n4 = 1;
  return pa;
}

function capitalizeFirst(s) {
  const str = String(s || "").trim();
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatSigned(v) {
  if (v == null || Number.isNaN(Number(v))) return "0";
  const n = Number(v);
  return (n >= 0 ? "+" : "") + n;
}

function normalizeStr(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSubtypeAllowedFrontend(subtype, allowedList) {
  if (!subtype) return true;
  if (!allowedList || !allowedList.length) return true;
  const subN = normalizeStr(subtype);
  return allowedList.some((a) => normalizeStr(a) === subN);
}

function sameIdFrontend(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

// Filtros con iconos concretos
const FILTERS = [
  { id: "armas", label: "Armas", iconKey: "Arma" },
  { id: "armadura", label: "Armadura", iconKey: "Armadura" },
  { id: "tesoros", label: "Tesoros", iconKey: "Tesoro" },
  { id: "comida", label: "Comida", iconKey: "Comida" },
  { id: "pociones", label: "Pociones", iconKey: "Poción" },
];

export default function Inventory({
  personaje, // snapshot WS
  personajeId, // ID backend
  mapaNombre,
  items = [],
  isOpen = false,
  onClose = () => {},
  teamMembers = [],
}) {
  const [activeFilter, setActiveFilter] = useState("armas");
  const [personajeFull, setPersonajeFull] = useState(null);
  const [errorPj, setErrorPj] = useState(null);

  const [selectedItem, setSelectedItem] = useState(null);
  const [actionMode, setActionMode] = useState("default"); // "default" | "give"
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Info del objeto que se está hovereando (inventario o equipamiento)
  // kind = "inv" | "arma" | "armadura"
  const [hoverInfo, setHoverInfo] = useState(null);

  // =========================
  //   CARGAR PERSONAJE REAL + POLLING mientras el inventario esté abierto
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

    const API_BASE = (
      import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
    ).replace(/\/$/, "");

    const load = async () => {
      try {
        if (cancelled) return;

        setErrorPj(null);
        const url = `${API_BASE}/personaje/${personajeId}`;
        console.debug("[Inventory] GET (poll)", url);

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error(
            "[Inventory] Error HTTP",
            res.status,
            res.statusText,
            txt
          );
          if (!cancelled) {
            setErrorPj(`HTTP ${res.status}: Error en respuesta`);
          }
          return;
        }

        const data = await res.json().catch(() => null);
        const pj = (data && (data.personaje || data.data || data)) || null;

        if (!cancelled) {
          setPersonajeFull(pj);
          setErrorPj(null);
        }
      } catch (e) {
        console.error("[Inventory] Error cargando personaje (poll):", e);
        if (!cancelled) {
          setErrorPj(e?.message || "Error desconocido");
        }
      }
    };

    // primer fetch inmediato al abrir
    load();
    // luego polling cada 4 segundos
    intervalId = setInterval(load, 4000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [personajeId, isOpen]);

  const pjSource = personajeFull || personaje || {};

  // =========================
  //   DERIVADOS DEL PJ
  // =========================
  const nombrePersonaje = capitalizeFirst(pjSource.nombre || "Sin nombre");
  const nivel = pjSource.nivel ?? personaje?.nivel ?? 1;
  const experiencia = pjSource.experiencia ?? personaje?.experiencia ?? 0;

  const raza = capitalizeFirst(pjSource.raza || "—");
  const subraza = capitalizeFirst(pjSource.subraza || "—");
  const clase = capitalizeFirst(pjSource.clase || "—");
  const subclase = capitalizeFirst(pjSource.subclase || "—");
  const origen = capitalizeFirst(pjSource.origen || "Sin origen");
  const alineamiento = capitalizeFirst(
    pjSource.alineamiento || "Sin alineamiento"
  );

  const xp = computeXpProgress(experiencia, nivel);

  const hpMax = pjSource.puntosGolpe ?? personaje?.puntosGolpe ?? 0;
  const hpActual =
    pjSource.hpActual != null
      ? pjSource.hpActual
      : personaje?.hpActual != null
      ? personaje.hpActual
      : hpMax;
  const hpPct =
    hpMax > 0 ? Math.max(0, Math.min(100, (hpActual / hpMax) * 100)) : 0;

  // Stats para remarcar la(s) máxima(s)
  const rawStats = [
    { key: "STR", field: "fuerza", value: pjSource.fuerza },
    { key: "DEX", field: "destreza", value: pjSource.destreza },
    { key: "CON", field: "constitucion", value: pjSource.constitucion },
    { key: "INT", field: "inteligencia", value: pjSource.inteligencia },
    { key: "WIS", field: "sabiduria", value: pjSource.sabiduria },
    { key: "CHA", field: "carisma", value: pjSource.carisma },
  ];

  const maxStatValue = rawStats.reduce((max, s) => {
    const n = Number(s.value);
    if (Number.isNaN(n)) return max;
    return n > max ? n : max;
  }, -Infinity);

  const stats = rawStats.map((s) => ({
    ...s,
    isMax:
      !Number.isNaN(Number(s.value)) &&
      Number(s.value) === maxStatValue &&
      maxStatValue !== -Infinity,
  }));

  // Recursos y puntos de acción
  const recursoNombre = pjSource.nombreRecurso || "";
  const recursoCantidad = pjSource.recurso ?? 0;
  const recursoEsperado = recursosPorNivel(nivel);

  const recursoIcon = recursoNombre ? findTipoIcon(recursoNombre) : null;

  const paEsperados = puntosAccionPorNivel(nivel);

  const puntosAccion = [
    {
      nivelKey: 1,
      label: "Nivel 1",
      cantidad: pjSource.puntosAccionNivel1 ?? 0,
      esperado: paEsperados.n1,
    },
    {
      nivelKey: 2,
      label: "Nivel 2",
      cantidad: pjSource.puntosAccionNivel2 ?? 0,
      esperado: paEsperados.n2,
    },
    {
      nivelKey: 3,
      label: "Nivel 3",
      cantidad: pjSource.puntosAccionNivel3 ?? 0,
      esperado: paEsperados.n3,
    },
    {
      nivelKey: 4,
      label: "Nivel 4",
      cantidad: pjSource.puntosAccionNivel4 ?? 0,
      esperado: paEsperados.n4,
    },
  ].map((pa) => ({
    ...pa,
    icon: findTipoIcon(pa.label),
  }));

  // ORO del personaje
  const oroCantidad = pjSource.oro ?? pjSource.Oro ?? 0;
  const oroIcon = findTipoIcon("Oro");

  // EQUIP arma / armadura
  const armaEquip =
    Array.isArray(pjSource.equipArma) && pjSource.equipArma.length > 0
      ? pjSource.equipArma[0]
      : null;
  const armaduraEquip =
    Array.isArray(pjSource.equipArmadura) && pjSource.equipArmadura.length > 0
      ? pjSource.equipArmadura[0]
      : null;

  const armaIcon = armaEquip?.nombre ? findObjetoIcon(armaEquip.nombre) : null;
  const armaduraIcon = armaduraEquip?.nombre
    ? findObjetoIcon(armaduraEquip.nombre)
    : null;

  // =========================
  //   IMÁGENES
  // =========================
  const mapImageSrc = useMemo(
    () => findImage(mapImages, mapaNombre),
    [mapaNombre]
  );
  const characterImageSrc = useMemo(
    () => findImage(characterImages, pjSource?.nombre),
    [pjSource?.nombre]
  );

  // =========================
  //   INVENTARIO
  // =========================
  const mappedItems = useMemo(() => {
    const sourceItems =
      (personajeFull && Array.isArray(personajeFull.inventario)
        ? personajeFull.inventario
        : items) || [];

    return sourceItems
      .map((o, idx) => {
        const tipoRaw = String(o.tipo || "").trim();

        // Categorías estrictas según tipo
        // "Arma"       -> armas
        // "Armadura"   -> armadura
        // "Poción"     -> pociones
        // "Suministro" -> comida
        // "Recurso"    -> tesoros
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
            // cualquier otro tipo NO se muestra en el inventario
            return null;
        }

        const icon = findObjetoIcon(o.nombre);

        return {
          id: o.id ?? idx,
          backendId: o.id ?? o.nombre ?? null,
          nombre: o.nombre || "Sin nombre",
          categoria,
          icon,
          tipo: o.tipo || "",
          descripcion: o.descripcion || "",
          danio: o.Danio || null,
          tipoDanio: o.TipoDanio || null,
          defensaFisica: o.defensaFisica ?? 0,
          defensaMagica: o.defensaMagica ?? 0,
          precioOro: o.precioOro ?? 0,
          armaTipo: o.armaTipo ?? o.ArmaTipo ?? null,
          armaduraTipo: o.armaduraTipo ?? o.ArmaduraTipo ?? null,
          instrumentoTipo: o.instrumentoTipo ?? o.InstrumentoTipo ?? null,
          escudoTipo: o.escudoTipo ?? o.EscudoTipo ?? null,
          amuletoTipo: o.amuletoTipo ?? o.AmuletoTipo ?? null,
        };
      })
      .filter(Boolean);
  }, [personajeFull, items]);

  const filteredItems = useMemo(
    () =>
      mappedItems.filter((it) =>
        activeFilter ? it.categoria === activeFilter : true
      ),
    [mappedItems, activeFilter]
  );

  // =========================
  //   EQUIP LOGIC (front)
  // =========================
  function isItemAlreadyEquipped(item, pj) {
    if (!item || !pj) return false;
    const targetId = item.backendId ?? item.id;
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
        if (o.id != null && targetId != null)
          return sameIdFrontend(o.id, targetId);
        if (item.nombre && o.nombre)
          return cleanKey(o.nombre) === cleanKey(item.nombre);
        return false;
      });
    });
  }

  function getEquipInfo(item, pj) {
    if (!item || !pj)
      return { canEquip: false, isEquipable: false };

    const tipoLower = String(item.tipo || "").toLowerCase();
    const armas = pj.armas || [];
    const armaduras = pj.armaduras || [];
    const escudos = pj.escudos || [];
    const instrumentos = pj.instrumentos || [];

    let basicEquipable = false;
    let subtypeAllowed = true;

    switch (tipoLower) {
      case "arma":
        basicEquipable = true;
        subtypeAllowed = isSubtypeAllowedFrontend(item.armaTipo, armas);
        break;
      case "armadura":
        basicEquipable = true;
        subtypeAllowed = isSubtypeAllowedFrontend(item.armaduraTipo, armaduras);
        break;
      case "escudo":
        basicEquipable = true;
        subtypeAllowed = isSubtypeAllowedFrontend(item.escudoTipo, escudos);
        break;
      case "instrumento":
        basicEquipable = true;
        subtypeAllowed = isSubtypeAllowedFrontend(
          item.instrumentoTipo,
          instrumentos
        );
        break;
      case "amuleto":
      case "casco":
      case "capa":
      case "guantes":
      case "botas":
        basicEquipable = true;
        break;
      default:
        basicEquipable = false;
    }

    if (!basicEquipable) {
      return {
        canEquip: false,
        isEquipable: false,
      };
    }

    if (!subtypeAllowed) {
      return {
        canEquip: false,
        isEquipable: true,
      };
    }

    const alreadyEquipped = isItemAlreadyEquipped(item, pj);
    if (alreadyEquipped) {
      return {
        canEquip: false,
        isEquipable: true,
      };
    }

    return { canEquip: true, isEquipable: true };
  }

  const equipInfo = selectedItem ? getEquipInfo(selectedItem, pjSource) : null;
  const isSelectedItemEquipped =
    selectedItem && isItemAlreadyEquipped(selectedItem, pjSource);

  // =========================
  //   OVERLAY HANDLERS
  // =========================
  const overlayClassName = `inventory-overlay${
    isOpen ? "" : " inventory-hidden"
  }`;

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      if (selectedItem) {
        setSelectedItem(null);
        setActionMode("default");
        setActionError(null);
        setHoverInfo(null);
        return;
      }
      onClose();
      setHoverInfo(null);
    }
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  // =========================
  //  ACTIONS: DAR Y EQUIPAR
  // =========================
  const handleItemClick = (item, event) => {
    event.preventDefault();

    if (selectedItem && selectedItem.id === item.id) {
      setSelectedItem(null);
      setActionMode("default");
      setActionError(null);
      return;
    }

    setSelectedItem(item);
    setActionMode("default");
    setActionError(null);
  };

  const handleGiveItemTo = async (targetId) => {
    if (!selectedItem || !selectedItem.backendId || !personajeId || !targetId)
      return;
    if (sameIdFrontend(targetId, personajeId)) return;

    try {
      setIsActionLoading(true);
      setActionError(null);

      const API_BASE = (
        import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
      ).replace(/\/$/, "");

      const objetoId = selectedItem.backendId;

      // 1) Agregar al objetivo
      {
        const url = `${API_BASE}/personaje/${targetId}/objetos/${objetoId}/agregar`;
        console.debug("[Inventory] DAR OBJETO → AGREGAR", url);
        const res = await fetch(url, {
          method: "PUT",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            txt || `Error al agregar objeto al personaje ${targetId}`
          );
        }
      }

      // 2) Quitar del inventario actual y actualizar personajeFull
      {
        const url = `${API_BASE}/personaje/${personajeId}/objetos/${objetoId}/quitar`;
        console.debug("[Inventory] DAR OBJETO → QUITAR", url);
        const res = await fetch(url, {
          method: "PUT",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            txt || "Error al quitar el objeto de tu inventario"
          );
        }
        const data = await res.json().catch(() => null);
        const pj = (data && (data.personaje || data.data || data)) || null;
        setPersonajeFull(pj);
      }

      setSelectedItem(null);
      setActionMode("default");
    } catch (e) {
      console.error("[Inventory] Error dando objeto:", e);
      setActionError(e?.message || "Error al transferir el objeto.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEquipItem = async () => {
    if (!selectedItem || !selectedItem.backendId || !personajeId) return;

    try {
      setIsActionLoading(true);
      setActionError(null);

      const API_BASE = (
        import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
      ).replace(/\/$/, "");

      const objetoId = selectedItem.backendId;
      const url = `${API_BASE}/personaje/${personajeId}/equipar/${objetoId}`;
      console.debug("[Inventory] EQUIPAR OBJETO", url);

      const res = await fetch(url, {
        method: "PUT",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Error al equipar el objeto");
      }

      const data = await res.json().catch(() => null);
      const pj = (data && (data.personaje || data.data || data)) || null;
      setPersonajeFull(pj);

      setSelectedItem(null);
      setActionMode("default");
    } catch (e) {
      console.error("[Inventory] Error equipando objeto:", e);
      setActionError(e?.message || "Error al equipar el objeto.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const otherTeamMembers = (teamMembers || []).filter(
    (m) => !sameIdFrontend(m.id, personajeId)
  );

  // =========================
  //   RENDER DETALLES ABAJO
  // =========================
  const renderHoverDetails = () => {
    if (!hoverInfo || !hoverInfo.item) {
      return (
        <div className="inventory-details-empty">
          Pasa el cursor sobre un objeto para ver sus detalles.
        </div>
      );
    }

    const { kind, item } = hoverInfo;

    if (kind === "inv") {
      const tipoLower = String(item.tipo || "").toLowerCase();
      const isArma = tipoLower === "arma";
      const isArmadura = tipoLower === "armadura";
      const isPocion =
        tipoLower === "poción" || tipoLower === "pocion";
      const isSuministro = tipoLower === "suministro";
      const isRecurso = tipoLower === "recurso";

      const danoIcon = item.tipoDanio
        ? findTipoIcon(item.tipoDanio)
        : null;

      return (
        <div className="inventory-details-content">
          <div className="inventory-tooltip-name">{item.nombre}</div>

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

          {(isPocion || isSuministro || isRecurso) &&
            !item.descripcion && (
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
    }

    if (kind === "arma") {
      const arma = item;
      const danoIcon = arma.TipoDanio
        ? findTipoIcon(arma.TipoDanio)
        : null;

      return (
        <div className="inventory-details-content">
          <div className="inventory-tooltip-name">{arma.nombre}</div>

          {arma.descripcion && (
            <div className="inventory-tooltip-desc">
              {arma.descripcion}
            </div>
          )}

          <div className="inventory-tooltip-row">
            <span className="inventory-tooltip-label">Daño:</span>
            <span className="inventory-tooltip-value">
              {arma.Danio || "-"}
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
                  alt={arma.TipoDanio}
                />
              )}
              {arma.TipoDanio || "-"}
            </span>
          </div>

          <div className="inventory-tooltip-row">
            <span className="inventory-tooltip-label">Precio:</span>
            <span className="inventory-tooltip-value">
              {arma.precioOro ?? 0} oro
            </span>
          </div>
        </div>
      );
    }

    if (kind === "armadura") {
      const armadura = item;

      return (
        <div className="inventory-details-content">
          <div className="inventory-tooltip-name">
            {armadura.nombre}
          </div>

          {armadura.descripcion && (
            <div className="inventory-tooltip-desc">
              {armadura.descripcion}
            </div>
          )}

          <div className="inventory-tooltip-row">
            <span className="inventory-tooltip-label">
              Def. física:
            </span>
            <span className="inventory-tooltip-value">
              {armadura.defensaFisica ?? 0}
            </span>
          </div>
          <div className="inventory-tooltip-row">
            <span className="inventory-tooltip-label">
              Def. mágica:
            </span>
            <span className="inventory-tooltip-value">
              {armadura.defensaMagica ?? 0}
            </span>
          </div>

          <div className="inventory-tooltip-row">
            <span className="inventory-tooltip-label">Precio:</span>
            <span className="inventory-tooltip-value">
              {armadura.precioOro ?? 0} oro
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  // =========================
  //   RENDER
  // =========================
  return (
    <div
      id="inventory-overlay"
      className={overlayClassName}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
      >
        {/* Backdrop interno para cerrar el menú de acciones */}
        {selectedItem && (
          <div
            className="inventory-actions-backdrop"
            onMouseDown={() => {
              setSelectedItem(null);
              setActionMode("default");
              setActionError(null);
              setHoverInfo(null);
            }}
          />
        )}

        <div className="inventory-layout">
          {/* ─────────────── IZQUIERDA ─────────────── */}
          <section className="inventory-left">
            <div className="inventory-hero-block">
              {/* Encabezado ENCIMA de la imagen */}
              <div className="inventory-character-header-above">
                <h2 className="inventory-character-name">
                  {nombrePersonaje} - Nv. {nivel}
                </h2>
                <div className="inventory-character-meta-above">
                  <div>
                    {raza}
                    {subraza && subraza !== "—" ? ` (${subraza})` : ""}
                  </div>
                  <div>
                    {clase}
                    {subclase && subclase !== "—" ? ` / ${subclase}` : " / —"}
                  </div>
                  <div>{origen || "Sin origen"}</div>
                  <div>{alineamiento}</div>
                </div>
              </div>

              {/* inner: mapa + barras + panel equip */}
              <div className="inventory-hero-inner">
                <div className="inventory-hero-main">
                  {/* Columna: mapa + barras */}
                  <div className="inventory-map-and-bars">
                    <div className="inventory-map-wrapper">
                      {mapImageSrc && (
                        <img
                          className="inventory-map-image"
                          src={mapImageSrc}
                          alt={mapaNombre || "Mapa actual"}
                        />
                      )}

                      {/* personaje centrado con el mapa */}
                      <div className="inventory-character-portrait">
                        {characterImageSrc && (
                          <img src={characterImageSrc} alt={nombrePersonaje} />
                        )}
                      </div>
                    </div>

                    {/* Barras justo debajo del mapa, mismo ancho */}
                    <div className="inventory-hero-bars">
                      <div className="inventory-bar-group">
                        <div className="inventory-bar-text">
                          <span className="inventory-bar-title">
                            Experiencia
                          </span>
                          <span className="inventory-bar-numbers">
                            {xp.current.toFixed(0)} / {xp.needed.toFixed(0)}
                          </span>
                        </div>
                        <div className="inventory-bar inventory-bar-xp">
                          <div
                            className="inventory-bar-fill"
                            style={{ width: `${xp.pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="inventory-bar-group">
                        <div className="inventory-bar-text">
                          <span className="inventory-bar-title">Vida</span>
                          <span className="inventory-bar-numbers">
                            {hpActual} / {hpMax}
                          </span>
                        </div>
                        <div className="inventory-bar inventory-bar-hp">
                          <div
                            className="inventory-bar-fill"
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel de arma/armadura + recursos a la DERECHA */}
                  <div className="inventory-equip-panel">
                    <div className="inventory-equip-slots">
                      {/* Arma equipada */}
                      <div
                        className="inventory-equip-slot"
                        onMouseEnter={() =>
                          armaEquip &&
                          setHoverInfo({ kind: "arma", item: armaEquip })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      >
                        {armaIcon && (
                          <div className="inventory-slot-icon">
                            <img
                              src={armaIcon}
                              alt={armaEquip?.nombre || "Arma equipada"}
                            />
                          </div>
                        )}
                      </div>

                      {/* Armadura equipada */}
                      <div
                        className="inventory-equip-slot"
                        onMouseEnter={() =>
                          armaduraEquip &&
                          setHoverInfo({
                            kind: "armadura",
                            item: armaduraEquip,
                          })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      >
                        {armaduraIcon && (
                          <div className="inventory-slot-icon">
                            <img
                              src={armaduraIcon}
                              alt={
                                armaduraEquip?.nombre || "Armadura equipada"
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="inventory-equip-resources">
                      {/* ORO */}
                      <div className="inventory-res-line">
                        {oroIcon && (
                          <img
                            className="inventory-resource-icon"
                            src={oroIcon}
                            alt="Oro"
                          />
                        )}
                        <div className="inventory-resource-text">
                          <div className="inventory-resource-count">
                            ${oroCantidad}
                          </div>
                          <div className="inventory-resource-label">Oro</div>
                        </div>
                      </div>

                      {/* Recurso principal */}
                      {recursoNombre && (
                        <div className="inventory-res-line">
                          {recursoIcon && (
                            <img
                              className="inventory-resource-icon"
                              src={recursoIcon}
                              alt={recursoNombre}
                            />
                          )}
                          <div className="inventory-resource-text">
                            <div className="inventory-resource-count">
                              {recursoCantidad}/{recursoEsperado}
                            </div>
                            <div className="inventory-resource-label">
                              {recursoNombre}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Puntos de acción */}
                      {puntosAccion.map((pa) => (
                        <div key={pa.nivelKey} className="inventory-res-line">
                          {pa.icon && (
                            <img
                              className="inventory-resource-icon"
                              src={pa.icon}
                              alt={pa.label}
                            />
                          )}
                          <div className="inventory-resource-text">
                            <div className="inventory-resource-count">
                              {pa.cantidad}/{pa.esperado}
                            </div>
                            <div className="inventory-resource-label">
                              {pa.label}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─────────────── DERECHA ─────────────── */}
          <section className="inventory-right">
            {/* parte superior: stats + físico/arcano/misc */}
            <div className="inventory-right-top">
              <div className="inventory-stats-grid">
                {stats.map((s) => (
                  <div
                    key={s.key}
                    className={
                      "stat-block" + (s.isMax ? " stat-block--max" : "")
                    }
                  >
                    <span className="stat-label">{s.key}</span>
                    <span className="stat-value">
                      {s.value != null ? s.value : "-"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="inventory-phys-arcane-misc">
                {/* Físico */}
                <div className="inventory-phys-block">
                  <span className="inventory-section-title">Físico</span>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MA:</span>
                    <span className="inventory-line-number">
                      {formatSigned(pjSource.modAtkFisico ?? 0)}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MD:</span>
                    <span className="inventory-line-number">
                      {formatSigned(pjSource.modDanoFisico ?? 0)}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MS:</span>
                    <span className="inventory-line-number">
                      {formatSigned(
                        pjSource.modTiradaSalvacionFisica ?? 0
                      )}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">CA:</span>
                    <span className="inventory-line-number">
                      {pjSource.caFisica ?? 0}
                    </span>
                  </div>
                </div>

                {/* Arcano */}
                <div className="inventory-phys-block">
                  <span className="inventory-section-title">Arcano</span>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MA:</span>
                    <span className="inventory-line-number">
                      {formatSigned(pjSource.modAtkMagico ?? 0)}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MD:</span>
                    <span className="inventory-line-number">
                      {formatSigned(pjSource.modDanoMagico ?? 0)}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">MS:</span>
                    <span className="inventory-line-number">
                      {formatSigned(
                        pjSource.modTiradaSalvacionMagica ?? 0
                      )}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">CA:</span>
                    <span className="inventory-line-number">
                      {pjSource.caMagica ?? 0}
                    </span>
                  </div>
                </div>

                {/* Misc */}
                <div className="inventory-phys-block">
                  <span className="inventory-section-title">Misc</span>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">Vel:</span>
                    <span className="inventory-line-number">
                      {pjSource.velocidad ?? 0}
                    </span>
                  </div>
                  <div className="inventory-line-vertical">
                    <span className="inventory-line-tag">Ini:</span>
                    <span className="inventory-line-number">
                      {formatSigned(pjSource.modIniciativa ?? 0)}
                    </span>
                  </div>
                </div>

                {errorPj && (
                  <div className="inventory-error-text">{errorPj}</div>
                )}
              </div>
            </div>

            {/* parte inferior: filtros + contenedor objetos + panel detalle */}
            <div className="inventory-right-bottom">
              <div className="inventory-filters">
                {FILTERS.map((f) => {
                  const iconTipo = findTipoIcon(f.iconKey);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={
                        "filter-btn" +
                        (activeFilter === f.id ? " is-active" : "")
                      }
                      onClick={() => setActiveFilter(f.id)}
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
                <div className="inventory-grid" id="inventory-grid">
                  {filteredItems.length === 0 && (
                    <div className="inventory-empty-text">
                      No tienes objetos de este tipo.
                    </div>
                  )}
                  {filteredItems.map((item) => {
                    const isSelected =
                      selectedItem && selectedItem.id === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          "inventory-slot" +
                          (isSelected ? " inventory-slot--selected" : "")
                        }
                        data-type={item.categoria}
                        title={item.nombre}
                        onClick={(e) => handleItemClick(item, e)}
                        onMouseEnter={() =>
                          setHoverInfo({ kind: "inv", item })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      >
                        {item.icon && (
                          <div className="inventory-slot-icon">
                            <img src={item.icon} alt={item.nombre} />
                          </div>
                        )}

                        {/* Pop-up de acciones (por encima de otros slots) */}
                        {isSelected && (
                          <div
                            className="inventory-item-actions-card inventory-item-actions-card--inline"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {actionMode === "default" && (
                              <div className="inventory-item-actions-row-buttons inventory-item-actions-row-buttons--column">
                                <button
                                  type="button"
                                  className="inventory-action-btn inventory-action-btn--full"
                                  disabled={
                                    isActionLoading || isSelectedItemEquipped
                                  }
                                  onClick={() => {
                                    if (
                                      isActionLoading ||
                                      isSelectedItemEquipped
                                    )
                                      return;
                                    setActionMode("give");
                                    setActionError(null);
                                  }}
                                >
                                  Dar
                                </button>

                                {equipInfo && equipInfo.isEquipable && (
                                  <button
                                    type="button"
                                    className="inventory-action-btn inventory-action-btn--full"
                                    disabled={
                                      isActionLoading ||
                                      !equipInfo.canEquip
                                    }
                                    onClick={handleEquipItem}
                                  >
                                    Equipar
                                  </button>
                                )}
                              </div>
                            )}

                            {actionMode === "give" && (
                              <div className="inventory-item-actions-row-buttons inventory-item-actions-row-buttons--column">
                                {otherTeamMembers.length > 0 ? (
                                  otherTeamMembers.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className="inventory-action-btn inventory-action-btn--full"
                                      disabled={isActionLoading}
                                      onClick={() => handleGiveItemTo(m.id)}
                                    >
                                      {m.nombre || `PJ #${m.id}`}
                                    </button>
                                  ))
                                ) : (
                                  <span className="inventory-item-actions-empty">
                                    No hay compañeros.
                                  </span>
                                )}
                              </div>
                            )}

                            {actionError && (
                              <div className="inventory-action-error">
                                {actionError}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Panel inferior de detalles */}
              <div className="inventory-details-panel">
                {renderHoverDetails()}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}