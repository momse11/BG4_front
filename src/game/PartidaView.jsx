import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "../auth/AuthProvider";
import {  usePartidaWS } from "../utils/ws";

export default function Partida() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { jugadores } = usePartidaWS(id, { id: user.id, username: user.username });

  return (
    <div>
      <h2>Partida #{id}</h2>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {jugadores.map(j => (
          <div key={j.id || j.username} style={{ border: '1px solid black', padding: '10px' }}>
            <p><strong>{j.username}</strong></p>
            <p>ID: {j.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
