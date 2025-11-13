//maneja rutas de otros archivos, para organizarlas

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from '../landing/Landing-Page'
import Login from '../auth/Login'
import SignIn from '../auth/SignIn'
import CrearPartida from "../game/CrearPartida";
import PartidaView from "../game/PartidaView"; 

export default function Routing() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/crear-partida" element={<CrearPartida />} />
        <Route path="/partida/:id" element={<PartidaView />} />
      </Routes>
    </BrowserRouter>
  )
}