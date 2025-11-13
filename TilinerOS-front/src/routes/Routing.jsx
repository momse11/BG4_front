//maneja rutas de otros archivos, para organizarlas

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from '../landing/Landing-Page'
import Login from '../auth/Login'
import SignUp from '../auth/SignUp'
import CrearPartida from "../game/CrearPartida";
import Lobby from "../partida/Lobby";
import PartidaIndex from '../game/PartidaIndex'
import LandingPublic from '../landing/LandingPublic'
import PartidaEmpezada from '../partida/PartidaEmpezada'

export default function Routing() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/partidas" element={<PartidaIndex />} />
        <Route path="/" element={<LandingPublic />} />
        <Route path="/login" element={<Login />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/crear-partida" element={<CrearPartida />} />
        <Route path="/partida/:id" element={<Lobby />} />
        <Route path="/partida/:id/empezada" element={<PartidaEmpezada />} />
      </Routes>
    </BrowserRouter>
  )
}