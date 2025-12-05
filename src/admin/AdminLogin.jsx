import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../utils/api';
import '../assets/styles/stylesheet.css';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await loginAdmin({ email, password });
      // redirect to admin panel
      navigate('/admin/panel');
    } catch (error) {
      const msg = error?.response?.data?.error || error.message || 'Error';
      setErr(msg);
    }
  };

  return (
    <div className="landing-pixel-root">
      <div className="auth-card">
        <h2 className="auth-title">Admin Login</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input className="auth-input" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="auth-input" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="pixel-button" type="submit">Entrar</button>
        </form>
        {err && <p className="auth-error">{err}</p>}
      </div>
    </div>
  );
}