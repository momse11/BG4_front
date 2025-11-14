import { useEffect, useState } from 'react'
import { getPersonajesByRaza } from '../utils/api'

export default function SelectPersonajeModal({ raza, onClose, onSelect }) {
  const [personajes, setPersonajes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        const data = await getPersonajesByRaza(raza)
        if (!mounted) return
        setPersonajes(data)
      } catch (e) {
        console.error('Error fetching personajes', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [raza])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 800, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Personajes — {raza}</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {personajes.length === 0 && <p>No hay personajes para esta raza</p>}
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
