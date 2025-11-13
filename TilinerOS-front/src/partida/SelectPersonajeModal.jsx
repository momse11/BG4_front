import { useEffect, useState } from 'react'
import { getPersonajesByClase } from '../utils/api'

export default function SelectPersonajeModal({ clase, onClose, onSelect }) {
  const [personajes, setPersonajes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        const data = await getPersonajesByClase(clase)
        if (!mounted) return
        setPersonajes(data)
      } catch (e) {
        console.error('Error fetching personajes', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [clase])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 800, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Personajes — {clase}</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {personajes.length === 0 && <p>No hay personajes para esta clase</p>}
            {personajes.map((p) => (
              <div key={p.id} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.sprite ? <img src={p.sprite} alt={p.nombre} style={{ maxHeight: '100%', maxWidth: '100%' }} /> : <div style={{ padding: 8 }}>{p.nombre}</div>}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: '600' }}>{p.nombre}</div>
                  <div style={{ fontSize: 12 }}>{p.clase}</div>
                  <button style={{ marginTop: 8 }} onClick={() => onSelect(p.id)}>Seleccionar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
