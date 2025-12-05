import { useState } from 'react';
import AdminUsers from './AdminUsers';
import AdminPartidas from './AdminPartidas';
import { logoutAdmin } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/');
  };

  return (
    <div className="landing-pixel-root">
      <div className="auth-card">
        <h2 className="auth-title">Panel de Admin</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <button className="pixel-button" onClick={() => setTab('users')}>Usuarios</button>
          <button className="pixel-button" onClick={() => setTab('partidas')}>Partidas</button>
          <button className="pixel-button" onClick={handleLogout}>Cerrar admin</button>
        </div>
        <div>
          {tab === 'users' ? <AdminUsers /> : <AdminPartidas />}
        </div>
      </div>
    </div>
  );
}