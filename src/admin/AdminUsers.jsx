import { useEffect, useState } from 'react';
import { getAdminUsers, deleteUserAdmin } from '../utils/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Eliminar usuario?')) return;
    try {
      await deleteUserAdmin(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (e) {
      alert(e?.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <p>Cargando usuarios...</p>;
  return (
    <div>
      <h3>Usuarios</h3>
      <table className="admin-table">
        <thead><tr><th>ID</th><th>username</th><th>email</th><th>Acciones</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <button className="pixel-button" onClick={() => handleDelete(u.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}