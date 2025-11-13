import { useEffect, useState } from 'react'
import { getClases } from '../utils/api'

export default function SelectClaseModal({ onClose, onSelect }) {
  const [clases, setClases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        const data = await getClases()
        if (!mounted) return
        setClases(data)
      } catch (e) {
        console.error('Error fetching clases', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 700, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Seleccionar Clase</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {clases.length === 0 && <p>No hay clases disponibles</p>}
            {clases.map((c) => (
              <button 
                key={c} 
                onClick={() => onSelect(c)} 
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: 6, 
                  border: '2px solid #ddd',
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e8e8e8'}
                onMouseLeave={(e) => e.target.style.background = '#f9f9f9'}
              >
                {c}
              </button>
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
