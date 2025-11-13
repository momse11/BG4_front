//maneja rutas de otros archivos, para organizarlas

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from '../landing/Landing-Page'
import LandingPublic from '../landing/LandingPublic'
import Login from '../auth/Login'
import SignUp from '../auth/SignUp'
import CrearPartida from "../game/CrearPartida";
import Lobby from '../partida/Lobby'
import ProtectedRoute from './ProtectedRoute'
import PartidaIndex from "../game/PartidaIndex"; 

export default function Routing() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LandingPublic />} />
        <Route path="/landing" element={<Landing />} />
  <Route path="/sign-up" element={<SignUp />} />
  <Route path="/crear-partida" element={<CrearPartida />} />
  <Route path="/partida/:id" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
  <Route path="/partida/:id/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
        <Route path="/partidas" element={<PartidaIndex />} />
      </Routes>
    </BrowserRouter>
  )
}