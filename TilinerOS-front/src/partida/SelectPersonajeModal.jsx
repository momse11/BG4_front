import { useEffect, useState } from 'react'
import { getPersonajesByClase as _getPersonajesByClase } from '../utils/api'

export default function SelectPersonajeModal({ clase, onClose, onSelect }) {
  const [personajes, setPersonajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const safeGetPersonajesByClase = typeof _getPersonajesByClase === 'function' ? _getPersonajesByClase : async () => []

  useEffect(() => {
    let mounted = true
    if (!clase) {
      setPersonajes([])
      setLoading(false)
      return () => { mounted = false }
    }
    ;(async () => {
        try {
        const data = await safeGetPersonajesByClase(clase)
        console.debug('[SelectPersonajeModal] fetched personajes for clase', clase, data)
        if (!mounted) return
        if (!Array.isArray(data)) {
          console.warn('getPersonajesByClase returned non-array:', data)
          setPersonajes([])
        } else {
          // dedupe personajes by id or nombre to avoid duplicate cards
          const seen = new Set()
          const uniq = []
          data.forEach((p) => {
            const key = String(p?.id ?? p?.nombre ?? '')
            if (!seen.has(key)) { seen.add(key); uniq.push(p) }
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
    return () => { mounted = false }
  }, [clase])

  if (loadError) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 600 }}>
          <h3>Error cargando personajes — {clase}</h3>
          <div style={{ color: 'red' }}>{loadError}</div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button onClick={() => (typeof onClose === 'function' ? onClose() : null)}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 800, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Personajes — {clase}</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {(!personajes || personajes.length === 0) && <p>No hay personajes para esta clase</p>}
            {Array.isArray(personajes) && personajes.map((p) => (
              <div key={p.id ?? p.nombre} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p?.sprite ? <img src={p.sprite} alt={p.nombre} style={{ maxHeight: '100%', maxWidth: '100%' }} /> : <div style={{ padding: 8 }}>{p.nombre}</div>}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: '600' }}>{p.nombre}</div>
                  <div style={{ fontSize: 12 }}>{p.clase}</div>
                  <button style={{ marginTop: 8 }} onClick={() => (typeof onSelect === 'function' ? onSelect(p.id ?? p.nombre) : console.warn('onSelect not function', onSelect))}>Seleccionar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={() => (typeof onClose === 'function' ? onClose() : null)}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
