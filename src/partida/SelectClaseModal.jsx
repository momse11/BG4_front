import { useEffect, useState } from 'react'
import { getClases } from '../utils/api'

export default function SelectClaseModal({ onClose, onSelect }) {
  const [clases, setClases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const safeGetClases = typeof getClases === 'function' ? getClases : async () => []

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await safeGetClases()
        if (!mounted) return
        if (!Array.isArray(data)) {
          console.warn('getClases returned non-array:', data)
          setClases([])
        } else {
          setClases(data)
        }
      } catch (e) {
        console.error('Error fetching clases', e)
        setLoadError(e?.message || String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (loadError) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 400 }}>
          <h3>Error cargando clases</h3>
          <div style={{ color: 'red' }}>{loadError}</div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button onClick={() => (typeof onClose === 'function' ? onClose() : null)}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 700, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Seleccionar Clase</h3>
        {loading ? <p>Cargando...</p> : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(!clases || clases.length === 0) && <p>No hay clases disponibles</p>}
            {Array.isArray(clases) && clases.map((c) => (
              <button 
                key={String(c)} 
                onClick={() => (typeof onSelect === 'function' ? onSelect(c) : console.warn('onSelect is not a function', onSelect))} 
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
                onMouseEnter={(e) => { try { e.currentTarget.style.background = '#e8e8e8' } catch (er) {} }}
                onMouseLeave={(e) => { try { e.currentTarget.style.background = '#f9f9f9' } catch (er) {} }}
              >
                {String(c)}
              </button>
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
