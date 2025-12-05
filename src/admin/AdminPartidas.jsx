import { useEffect, useState } from 'react';
import api from '../utils/api';

export default function AdminPartidas() {
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/partidas');
      setPartidas(r.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Eliminar partida?')) return;
    try {
      await api.delete(`/partidas/${id}`);
      setPartidas(partidas.filter(p => p.id !== id));
    } catch (e) {
      alert(e?.response?.data?.error || 'Error eliminando partida');
    }
  };

  if (loading) return <p>Cargando partidas...</p>;
  return (
    <div>
      <h3>Partidas</h3>
      <table className="admin-table">
        <thead><tr><th>ID</th><th>Creador</th><th>Privado</th><th>Acciones</th></tr></thead>
        <tbody>
          {partidas.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.creador_id}</td>
              <td>{p.privado ? 'Sí' : 'No'}</td>
              <td>
                <button className="pixel-button" onClick={() => handleDelete(p.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}