import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Logo from '../assets/Logo.png';
import Portada from '../assets/Portada.png';
import '../assets/styles/landing.css';

// Tiles especiales
import JefeTile from '../assets/tablero/Jefe.gif';
import CofreTile from '../assets/tablero/Cofre.png';
import FogataTile from '../assets/tablero/Fogata.gif';
import CartelTile from '../assets/tablero/Cartel.png';

export default function LandingPixel() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const handleLogin = () => {
    navigate('/login');      // ajusta si tu ruta es distinta
  };

  const handleRegister = () => {
    navigate('/sign-up');    // o '/register'
  };

  return (
    <div className="landing-pixel-root">
      {/* Contenedor del mismo color que el fondo, solo para centrar */}
      <div className="landing-pixel-frame">
        {/* Logo arriba */}
        <img src={Logo} alt="Logo TilinerOS" className="landing-logo" />

        {/* Portada al centro */}
        <img src={Portada} alt="Portada TilinerOS" className="landing-portada" />

        {/* Botones abajo */}
        <div className="landing-button-column">
          <button className="pixel-button" onClick={handleLogin}>
            Iniciar sesión
          </button>

          <button className="pixel-button" onClick={handleRegister}>
            Registrarse
          </button>

          <button
            className="pixel-button"
            onClick={() => setShowInstructions(true)}
          >
            Instrucciones
          </button>

          <button
            className="pixel-button"
            onClick={() => setShowAbout(true)}
          >
            Nosotros
          </button>
        </div>
      </div>

      {/* Modal Instrucciones */}
      {showInstructions && (
        <div
          className="pixel-modal-overlay"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="pixel-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <h2 className="pixel-modal-title">Cómo Jugar:</h2>
            <div className="pixel-modal-body">
              <h3>Objetivo del Juego:</h3>
              <p>
                BG4 es un juego de aventura por turnos para 4 jugadores. Juntos exploran
                8 mapas y deben derrotar al jefe de cada uno para avanzar. Si vencen a
                los 8 jefes en orden, completan la campaña.
              </p>

              <h3>Formación del Equipo:</h3>
              <p>
                Cada partida se juega con <strong>exactamente 4 personas</strong>. Quien crea la
                partida espera a que el resto se una y elija su personaje. Hay 36
                personajes distintos, con clases y habilidades propias. Cuando los 4
                marcan que están listos, el creador puede iniciar el juego.
              </p>

              <h3>Movimiento y Exploración:</h3>
              <p>
                La party se mueve junta por el mapa, por turnos. El orden de acción depende
                de la <strong>iniciativa y velocidad</strong> de cada personaje. En tu turno eliges
                casillas adyacentes para avanzar y, a medida que exploran, pueden aparecer
                combates, cofres, recursos y zonas especiales.
              </p>

              <h3>Tipos de Casillas:</h3>
              <p>En el mapa hay casillas especiales que ayudan o ponen en riesgo al equipo:</p>

              <div style={{ marginY: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '3px', borderLeft: '4px solid #4A6931' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <img src={JefeTile} alt="Jefe" style={{ maxWidth: '60px', minWidth: '60px', imageRendering: 'pixelated' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>Casilla Jefe</h4>
                    <p style={{ margin: '0', fontSize: '0.65rem' }}>
                      Activa la pelea contra el jefe del mapa. Son enemigos duros y únicos.
                      Si lo derrotan, desbloquean el siguiente mapa. Este es el objetivo
                      principal de cada zona.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginY: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '3px', borderLeft: '4px solid #4A6931' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <img src={CofreTile} alt="Cofre" style={{ maxWidth: '60px', minWidth: '60px', imageRendering: 'pixelated' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>Casilla Cofre</h4>
                    <p style={{ margin: '0', fontSize: '0.65rem' }}>
                      Entrega botín útil: armas, armaduras, pociones y otros objetos. Abrir
                      cofres es clave para mejorar al grupo antes de enfrentarse a enemigos
                      más fuertes.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginY: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '3px', borderLeft: '4px solid #4A6931' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <img src={FogataTile} alt="Descanso" style={{ maxWidth: '60px', minWidth: '60px', imageRendering: 'pixelated' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>Casilla Descanso</h4>
                    <p style={{ margin: '0', fontSize: '0.65rem' }}>
                      Es una zona segura donde todo el equipo recupera su vida al máximo.
                      Úsenlas antes de peleas difíciles o cuando el grupo esté muy dañado.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginY: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '3px', borderLeft: '4px solid #4A6931' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <img src={CartelTile} alt="Comercio" style={{ maxWidth: '60px', minWidth: '60px', imageRendering: 'pixelated' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>Casilla Comercio</h4>
                    <p style={{ margin: '0', fontSize: '0.65rem' }}>
                      Permite hablar con comerciantes para <strong>comprar</strong> armas, armaduras
                      y pociones o <strong>vender</strong> lo que no necesiten. Aquí encontrarán
                      mejor equipo para seguir avanzando.
                    </p>
                  </div>
                </div>
              </div>

              <h3>Objetos:</h3>
              <p>
                A lo largo de la aventura van a encontrar distintos tipos de objetos. Cada uno
                cumple un rol importante para que el grupo sobreviva y avance:
              </p>
              <ul>
                <li>
                  <strong>Armas:</strong> mejoran tu ataque principal y el daño que haces en combate.
                </li>
                <li>
                  <strong>Armaduras:</strong> aumentan tu Clase de Armadura (CA), ayudando a recibir menos daño.
                </li>
                <li>
                  <strong>Tesoros:</strong> sirven principalmente para venderlos y conseguir recursos en las zonas de comercio.
                </li>
                <li>
                  <strong>Pociones:</strong> se usan para curar, imponer efectos, eliminar estados negativos o dañar enemigos, según el tipo.
                </li>
                <li>
                  <strong>Comida:</strong> recupera recursos de los personajes, como energía o puntos para habilidades especiales.
                </li>
              </ul>

              <p>
                Administrar bien estos objetos es clave: vendan lo que no usen, equipen las mejores armas y armaduras, y guarden pociones y comida para los momentos críticos.
              </p>

              <h3>Combates:</h3>
              <p>
                Cuando encuentran enemigos, se abre un combate por turnos. Cada personaje actúa según su iniciativa (quién es más rápido).
              </p>
              <p>Turno:</p>
              <ul>
                <li><strong>Atacar:</strong> usas tu arma equipada y sumas tu modificador. Si superas la defensa del enemigo, le haces daño.</li>
                <li><strong>Usar una habilidad:</strong> cada clase y subclase tiene poderes especiales que gastan recursos propios.</li>
                <li><strong>Usar un objeto:</strong> pociones para curarte o obtener ventajas.</li>
              </ul>
              <p>
                El daño depende del arma, tus atributos y el tipo de enemigo. Cuando tu vida llega a 0, caes. Si todo el equipo cae, es game over.
              </p>
            </div>
            <button
              className="pixel-button pixel-modal-close"
              onClick={() => setShowInstructions(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Nosotros */}
      {showAbout && (
        <div
          className="pixel-modal-overlay"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="pixel-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pixel-modal-title">Nosotros</h2>
            <div className="pixel-modal-body">
              <p>
                BG4 nació como un proyecto académico inspirado en juegos como Baldur&apos;s Gate 3,
                Octopath Traveler y, sobre todo, Dungeons &amp; Dragons. Nos apasiona el desarrollo de
                videojuegos y este proyecto fue la excusa perfecta para aprender, experimentar y
                crear nuestro propio mundo.
              </p>
              <p>
                Aunque no pudimos pulir cada detalle tanto como nos habría gustado, disfrutamos mucho
                el proceso: diseñamos 36 personajes, más de 100 objetos y habilidades, además de una
                campaña con 8 mapas llenos de encuentros. También gozamos un montón creando los
                assets y soñando con que este proyecto pudiera ganar.
              </p>
              <p>Equipo:</p>
              <p>• Karla Rivero — Frontend</p>
              <p>• Montserrat Contreras — Backend</p>
            </div>
            <button
              className="pixel-button pixel-modal-close"
              onClick={() => setShowAbout(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}