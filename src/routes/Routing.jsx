import { Routes, Route } from 'react-router-dom';
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

export default function Routing() {
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

        {/* MAPA — Vista del tablero */}
        <Route
          path="/partida/:partidaId/mapa/:mapaId"
          element={
            <ProtectedRoute>
              <MapViewWrapper />
            </ProtectedRoute>
          }
        />

      </Routes>
  );
}