import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Logo from '../assets/Logo.png';
import Portada from '../assets/Portada.png';
import '../assets/styles/landing.css';

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
          >
            <h2 className="pixel-modal-title">Instrucciones</h2>
            <div className="pixel-modal-body">
              <p>• Crea una cuenta o inicia sesión.</p>
              <p>• Únete a una partida existente o crea una nueva.</p>
              <p>• En tu turno, mueve tus unidades e interactúa con el mapa.</p>
              <p>• El objetivo exacto depende de la partida / modo de juego.</p>
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
              <p>TilinerOS es un proyecto académico de juego de aventura por turnos.</p>
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