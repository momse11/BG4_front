// src/components/SelectPersonajeModal.jsx
import { useEffect, useState } from 'react'
import { getPersonajesByClase as _getPersonajesByClase } from '../utils/api'

/**
 * props:
 * - clase: string
 * - onClose: function -> cerrar completamente el modal de personaje
 * - onBackToClase: function -> volver al modal de clases
 * - onSelect: function(personajeId | nombre)
 * - takenPersonajeIds?: array
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
    typeof _getPersonajesByClase === 'function'
      ? _getPersonajesByClase
      : async () => []

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

  const handleBackToClase = () => {
    if (typeof onBackToClase === 'function') {
      onBackToClase()
    } else {
      handleClose()
    }
  }

  const personajesToShow = (personajes || []).slice(0, 3)

  const takenIds = Array.isArray(takenPersonajeIds)
    ? takenPersonajeIds.map((v) => String(v))
    : []

  const handleSelect = (p) => {
    const key = String(p.id ?? p.nombre)
    if (takenIds.includes(key)) {
      return
    }
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
            onClick={handleBackToClase}
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
            No hay personajes para esta clase
          </p>
        ) : (
          <div className="character-row">
            {personajesToShow.map((p, index) => {
              const key = String(p.id ?? p.nombre)
              const isTaken = takenIds.includes(key)

              return (
                <button
                  key={p.id ?? p.nombre ?? index}
                  type="button"
                  className={
                    'character-card character-card-' +
                    index +
                    (isTaken ? ' character-card-taken' : '')
                  }
                  onClick={() => handleSelect(p)}
                  disabled={isTaken}
                >
                  <div className="character-image-wrap">
                    <img src={getPortraitSrc(p)} alt={p.nombre} />
                  </div>

                  <div className="character-tooltip">
                    <p>
                      <strong>Nombre:</strong> {p.nombre}
                    </p>
                    {p.raza && (
                      <p>
                        <strong>Raza:</strong> {p.raza}
                      </p>
                    )}
                    {p.clase && (
                      <p>
                        <strong>Clase:</strong> {p.clase}
                      </p>
                    )}
                    {p.descripcion && (
                      <p className="character-tooltip-desc">
                        {p.descripcion}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className="pixel-button character-back-button"
          onClick={handleBackToClase}
        >
          Volver
        </button>
      </div>
    </div>
  )
}