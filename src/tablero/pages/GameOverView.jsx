import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/styles/GameOverView.css';

/**
 * GameOverView - Pantalla que se muestra cuando todos los aliados mueren en combate
 * Se muestra antes de redirigir al landing
 */
export default function GameOverView({ partidaNombre, onContinue }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Countdown de 10 segundos
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      // Redirigir al landing
      navigate('/');
    }
  };

  return (
    <div className="game-over-overlay">
      <div className="game-over-container">
        <div className="game-over-skull">☠️</div>
        
        <h1 className="game-over-title">GAME OVER</h1>
        
        <div className="game-over-message">
          <p className="game-over-text">
            Todos los aliados han caído en combate
          </p>
          {partidaNombre && (
            <p className="game-over-partida">
              Partida: <strong>{partidaNombre}</strong>
            </p>
          )}
          <p className="game-over-subtext">
            La partida ha sido eliminada
          </p>
        </div>

        <div className="game-over-actions">
          <button 
            className="game-over-button"
            onClick={handleContinue}
          >
            Volver al inicio ({countdown}s)
          </button>
        </div>

        <div className="game-over-quote">
          <em>"En la oscuridad más profunda, hasta los héroes caen..."</em>
        </div>
      </div>
    </div>
  );
}
