import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Landing from '../landing/Landing-Page';
import LandingPublic from '../landing/LandingPublic';
import Login from '../auth/Login';
import SignUp from '../auth/SignUp';
import CrearPartida from '../game/CrearPartida';
import Lobby from '../partida/Lobby';
import ProtectedRoute from './ProtectedRoute';
import PartidaIndex from '../game/PartidaIndex';
import PartidaEmpezada from '../partida/PartidaEmpezada';

// Página del mapa
import MapViewWrapper from '../tablero/pages/MapViewWrapper';
import CombatView from '../tablero/pages/CombatView';

export default function Routing() {
  const navigate = useNavigate();

  // DESACTIVADO: Ahora el combate se muestra como overlay, no como navegación
  // El evento 'show_combat_overlay' es manejado directamente por MapView
  // useEffect(() => {
  //   const handleNavigateToCombat = (event) => {
  //     try {
  //       const { path, combateId, partidaId, data } = event.detail || {};
  //       if (path) {
  //         console.log('[Routing] Navegando a combate:', path);
  //         navigate(path, { state: data });
  //       }
  //     } catch (e) {
  //       console.error('[Routing] Error navegando a combate:', e);
  //     }
  //   };
  //
  //   window.addEventListener('navigate_to_combat', handleNavigateToCombat);
  //   return () => window.removeEventListener('navigate_to_combat', handleNavigateToCombat);
  // }, [navigate]);

  return (
      <Routes>

        {/* Landing / Auth */}
        <Route path="/" element={<LandingPublic />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<SignUp />} />

        {/* Partidas */}
        <Route path="/crear-partida" element={<CrearPartida />} />
        <Route path="/partidas" element={<PartidaIndex />} />

        <Route
          path="/partida/:id"
          element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          }
        />

        {/* Ruta secundaria del lobby */}
        <Route
          path="/partida/:id/lobby"
          element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          }
        />

        {/* Partida empezada */}
        <Route
          path="/partida/:id/empezada"
          element={
            <ProtectedRoute>
              <PartidaEmpezada />
            </ProtectedRoute>
          }
        />

        {/* MAPA — Vista del tablero (incluye combate como overlay) */}
        <Route
          path="/partida/:partidaId/mapa/:mapaId"
          element={
            <ProtectedRoute>
              <MapViewWrapper />
            </ProtectedRoute>
          }
        />

        {/* REMOVIDO: Combate ahora es solo overlay dentro del mapa */}

      </Routes>
  );
}