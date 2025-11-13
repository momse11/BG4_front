import { useEffect, useState } from 'react'
import { getRazas } from '../utils/api'

export default function SelectRazaModal({ onClose, onSelect }) {
  const [razas, setRazas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        const data = await getRazas()
        if (!mounted) return
        setRazas(data)
      } catch (e) {
        console.error('Error fetching razas', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Seleccionar raza</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {razas.length === 0 && <p>No hay razas disponibles</p>}
            {razas.map((r) => (
              <button key={r} onClick={() => onSelect(r)} style={{ padding: '10px 16px', borderRadius: 6 }}>{r}</button>
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
