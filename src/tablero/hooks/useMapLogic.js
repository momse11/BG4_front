import { useEffect, useState } from "react";
import { getMapa } from "../services/mapService";

const retratos = import.meta.glob(
  "/src/assets/tablero/retratos/*.{png,jpg,jpeg}",
  { eager: true }
);

const spriteFiles = import.meta.glob(
  "/src/assets/tablero/sprites/*.{png,jpg,jpeg,gif}",
  { eager: true }
);

function getPortrait(name) {
  const clean = name.toLowerCase();
  for (const p in retratos) {
    const file = p.split("/").pop().split(".")[0].toLowerCase();
    if (file === clean) return retratos[p].default;
  }
  return null;
}

function getSprite(name) {
  const clean = name.toLowerCase();
  for (const p in spriteFiles) {
    const file = p.split("/").pop().split(".")[0].toLowerCase();
    if (file === clean) return spriteFiles[p].default;
  }
  return null;
}

const d20 = () => Math.floor(Math.random() * 20) + 1;

function findStart(casillas) {
  return casillas.find((c) => c.tipo === "Descanso") || casillas[0];
}

export function useMapLogic({ mapaId, personajesIds }) {
  const [mapa, setMapa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState([]);
  const [pos, setPos] = useState({ x: 1, y: 1 });

  useEffect(() => {
    async function load() {
      try {
        const m = (await getMapa(mapaId)).data;
        setMapa(m);

        const actores = [];

        for (const id of personajesIds) {
          const r = await fetch(`http://localhost:3000/api/v1/personaje/${id}`);
          const json = await r.json();
          const pj = json.personaje;

          pj.portrait = getPortrait(pj.nombre);
          pj.sprite = getSprite(pj.nombre);

          actores.push(pj);
        }

        const lista = actores.map((pj) => ({
          actor: pj,
          iniciativa: d20() + Number(pj.modIniciativa ?? 0),
        }));

        lista.sort((a, b) => b.iniciativa - a.iniciativa);

        setOrder(lista);

        const start = findStart(m.casillas);
        setPos({ x: start.x, y: start.y });

      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mapaId, personajesIds]);

  return {
    loading,
    mapa,
    casillas: mapa?.casillas || [],
    pos,
    order,
  };
}