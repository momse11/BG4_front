// src/partida/SelectPersonajeModal.jsx
import { useEffect, useState } from 'react'
import { getPersonajesByClase as _getPersonajesByClase } from '../utils/api'

/**
 * props:
 * - clase: string
 * - onClose: function           -> cerrar este modal
 * - onBackToClase: function     -> cerrar este modal y abrir el de clase
 * - onSelect: function(personajeId | nombre)
 * - takenPersonajeIds?: string[]
 */
export default function SelectPersonajeModal({
  clase,
  onClose,
  onBackToClase,
  onSelect,
  takenPersonajeIds = []
}) {
  const [personajes, setPersonajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const safeGetPersonajesByClase =
    typeof _getPersonajesByClase === 'function' ? _getPersonajesByClase : async () => []

  useEffect(() => {
    let mounted = true
    if (!clase) {
      setPersonajes([])
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    ;(async () => {
      try {
        const data = await safeGetPersonajesByClase(clase)
        if (!mounted) return
        if (!Array.isArray(data)) {
          console.warn('getPersonajesByClase returned non-array:', data)
          setPersonajes([])
        } else {
          const seen = new Set()
          const uniq = []
          data.forEach((p) => {
            const key = String(p?.id ?? p?.nombre ?? '')
            if (!seen.has(key)) {
              seen.add(key)
              uniq.push(p)
            }
          })
          setPersonajes(uniq)
        }
      } catch (e) {
        console.error('Error fetching personajes', e)
        setLoadError(e?.message || String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [clase])

  const handleClose = () => {
    if (typeof onClose === 'function') onClose()
  }

  const handleBackToClaseClick = () => {
    if (typeof onBackToClase === 'function') {
      onBackToClase()
    } else {
      handleClose()
    }
  }

  // 🔹 Normalizamos ids de personajes ya tomados
  const takenIds = Array.isArray(takenPersonajeIds)
    ? takenPersonajeIds.map((v) => String(v))
    : []

  // 🔹 Solo mostramos personajes que NO están tomados, máximo 3
  const personajesToShow = (personajes || [])
    .filter((p) => {
      const key = String(p?.id ?? p?.nombre)
      return !takenIds.includes(key)
    })
    .slice(0, 3)

  const handleSelect = (p) => {
    const key = String(p.id ?? p.nombre)
    // defensa extra por si acaso
    if (takenIds.includes(key)) return
    if (typeof onSelect === 'function') {
      onSelect(p.id ?? p.nombre)
    }
  }

  const getPortraitSrc = (p) => {
    const nombre = p?.nombre ? String(p.nombre) : 'Ninguno'
    try {
      const url = new URL(
        `../assets/personajes/${nombre}.png`,
        import.meta.url
      ).href
      return url
    } catch (e) {
      try {
        const fallback = new URL(
          '../assets/personajes/Ninguno.png',
          import.meta.url
        ).href
        return fallback
      } catch {
        return ''
      }
    }
  }

  const getDamageIconSrc = (tipo) => {
    if (!tipo) return ''
    const safeName = String(tipo)
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')

    try {
      const url = new URL(
        `../assets/daño/${safeName}.png`,
        import.meta.url
      ).href
      return url
    } catch {
      return ''
    }
  }

  const renderDamageRow = (label, list) => {
    if (!Array.isArray(list)) return null

    const clean = list
      .map((t) => String(t).trim())
      .filter(Boolean)

    if (clean.length === 0) return null

    return (
      <div className="character-tooltip-damage-row">
        <span className="character-tooltip-damage-label">
          {label}:
        </span>
        <div className="character-tooltip-damage-icons">
          {clean.map((tipo) => (
            <div
              key={tipo}
              className="damage-icon-wrap"
              title={tipo}
            >
              <img src={getDamageIconSrc(tipo)} alt={tipo} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderStatsLine = (p) => {
    const {
      fuerza,
      destreza,
      constitucion,
      inteligencia,
      sabiduria,
      carisma
    } = p

    if (
      fuerza == null &&
      destreza == null &&
      constitucion == null &&
      inteligencia == null &&
      sabiduria == null &&
      carisma == null
    ) {
      return null
    }

    return (
      <div className="character-tooltip-stats">
        <p>STR {fuerza ?? '-'}</p>
        <p>DES {destreza ?? '-'}</p>
        <p>CON {constitucion ?? '-'}</p>
        <p>INT {inteligencia ?? '-'}</p>
        <p>SAB {sabiduria ?? '-'}</p>
        <p>CAR {carisma ?? '-'}</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="lobby-modal-overlay" onClick={handleClose}>
        <div
          className="lobby-modal character-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="character-modal-title">
            Error cargando personajes — {clase}
          </h2>
          <p className="character-modal-error">{loadError}</p>
          <button
            type="button"
            className="pixel-button character-back-button"
            onClick={handleBackToClaseClick}
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-modal-overlay" onClick={handleClose}>
      <div
        className="lobby-modal character-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="character-modal-title">Selecciona personaje</h2>

        {loading ? (
          <p className="character-modal-loading">Cargando...</p>
        ) : personajesToShow.length === 0 ? (
          <p className="character-modal-loading">
            No hay personajes disponibles para esta clase
          </p>
        ) : (
          <div className="character-row">
            {personajesToShow.map((p, index) => (
              <button
                key={p.id ?? p.nombre ?? index}
                type="button"
                className={
                  'character-card character-card-' + index
                }
                onClick={() => handleSelect(p)}
              >
                <div className="character-image-wrap">
                  <img src={getPortraitSrc(p)} alt={p.nombre} />
                </div>

                <div className="character-tooltip">
                  <p><strong>Nombre:</strong> {p.nombre}</p>

                  <p>
                    <strong>Raza:</strong>{' '}
                    {p.raza || '-'}
                    {p.subraza ? ` ${p.subraza}` : ''}
                  </p>

                  <p>
                    <strong>Subclase:</strong>{' '}
                    {p.subclase || '-'}
                  </p>

                  <p>
                    <strong>Velocidad:</strong>{' '}
                    {p.velocidad ?? '-'}
                  </p>

                  <p>
                    <strong>Origen:</strong>{' '}
                    {p.origen || '-'}
                  </p>

                  <p>
                    <strong>Alineamiento:</strong>{' '}
                    {p.alineamiento || '-'}
                  </p>

                  <p className="character-tooltip-desc">
                    {p.descripcion && p.descripcion.trim()
                      ? p.descripcion
                      : 'Sin descripción'}
                  </p>

                  {renderDamageRow('Debilidad', p.debilidad)}
                  {renderDamageRow('Resistencia', p.resistencia)}
                  {renderDamageRow('Inmunidad', p.inmunidad)}

                  {renderStatsLine(p)}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="pixel-button character-back-button"
          onClick={handleBackToClaseClick}
        >
          Volver
        </button>
      </div>
    </div>
  )
}