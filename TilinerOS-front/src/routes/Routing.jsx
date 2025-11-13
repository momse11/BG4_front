//maneja rutas de otros archivos, para organizarlas

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from '../landing/Landing-Page'
import LandingPublic from '../landing/LandingPublic'
import Login from '../auth/Login'
import SignIn from '../auth/SignIn'
import CrearPartida from "../game/CrearPartida";
import PartidaView from "../game/PartidaView"; 
import Lobby from '../partida/Lobby'
import ProtectedRoute from './ProtectedRoute'

export default function Routing() {
  return (
    <BrowserRouter>
      <Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<LandingPublic />} />
  <Route path="/landing" element={<Landing />} />
  <Route path="/sign-in" element={<SignIn />} />
  <Route path="/crear-partida" element={<ProtectedRoute><CrearPartida /></ProtectedRoute>} />
  <Route path="/partida/:id" element={<ProtectedRoute><PartidaView /></ProtectedRoute>} />
  <Route path="/partida/:id/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}