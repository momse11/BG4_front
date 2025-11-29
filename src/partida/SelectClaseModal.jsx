// src/components/SelectClaseModal.jsx
import Barbaro from '../assets/clases/Barbaro.png'
import Bardo from '../assets/clases/Bardo.png'
import Brujo from '../assets/clases/Brujo.png'
import Clerigo from '../assets/clases/Clerigo.png'
import Druida from '../assets/clases/Druida.png'
import Explorador from '../assets/clases/Explorador.png'
import Guerrero from '../assets/clases/Guerrero.png'
import Hechicero from '../assets/clases/Hechicero.png'
import Mago from '../assets/clases/Mago.png'
import Monje from '../assets/clases/Monje.png'
import Paladin from '../assets/clases/Paladin.png'
import Picaro from '../assets/clases/Picaro.png'

const CLASES = [
  { name: 'Bárbaro', img: Barbaro },
  { name: 'Bardo', img: Bardo },
  { name: 'Brujo', img: Brujo },
  { name: 'Clérigo', img: Clerigo },
  { name: 'Druida', img: Druida },
  { name: 'Explorador', img: Explorador },
  { name: 'Guerrero', img: Guerrero },
  { name: 'Hechicero', img: Hechicero },
  { name: 'Mago', img: Mago },
  { name: 'Monje', img: Monje },
  { name: 'Paladín', img: Paladin },
  { name: 'Pícaro', img: Picaro }
]

/**
 * props:
 * - onSelect(clase)
 * - onClose() -> cerrar SOLO el modal (no salir del lobby/partida)
 */
export default function SelectClaseModal({ onClose, onSelect }) {
  const handleSelect = (clase) => {
    if (typeof onSelect === 'function') {
      onSelect(clase)
    }
  }

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose()
    }
  }

  return (
    <div
      className="lobby-modal-overlay"
      onClick={handleClose}
    >
      <div
        className="lobby-modal class-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="class-modal-title">Selecciona una clase</h2>

        <div className="class-grid">
          {CLASES.map((c) => (
            <button
              key={c.name}
              type="button"
              className="class-button"
              onClick={() => handleSelect(c.name)}
            >
              <div className="class-button-img-wrap">
                <img src={c.img} alt={c.name} />
              </div>
              <span className="class-button-label">{c.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pixel-button class-close-button"
          onClick={handleClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}