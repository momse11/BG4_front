import React from 'react'
import '../assets/styles/landing.css'
import teamData from './data/team.json'
import stackData from './data/stack.json'

export default function LandingPublic() {
  return (
    <div>
      <header className="site-header">
        <div className="container">
          <a className="logo" href="/">TilinerOS</a>
          <nav className="nav">
            <a href="#caracteristicas">Características</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#nosotros">Nosotros</a>
            <a className="btn" href="#empezar">Empezar</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <h1>TilinerOS — Aventuras en línea</h1>
            <p className="muted">Plataforma de juego por turnos con mapas, combates y economías. Únete y juega con tus amigos.</p>
            <p className="cta"><a href="#" className="btn large">Crear cuenta</a> <a href="#" className="link">Entrar</a></p>
          </div>
        </section>

        <section id="caracteristicas" className="features">
          <div className="container">
            <h2>Qué ofrecemos</h2>
            <ul>
              <li>Partidas por turnos y combates tácticos</li>
              <li>Mapas personalizables y casillas dinámicas</li>
              <li>Sistema social: amigos, chat y mensajes</li>
              <li>API pública documentada en <a href="/docs">/docs</a></li>
            </ul>
          </div>
        </section>

        <section id="como-funciona" className="how-it-works">
          <div className="container">
            <h2>Cómo funciona</h2>
            <ol>
              <li>Regístrate o inicia sesión.</li>
              <li>Únete a una partida o crea la tuya.</li>
              <li>Usa el mapa, mueve tus personajes y realiza acciones por turno.</li>
            </ol>
          </div>
        </section>

        <section id="nosotros" className="about-section">
          <div className="container">
            <h2 className="section-title">Nuestro Equipo</h2>
            <div className="cards-grid team-grid">
              {teamData.map((m, i) => (
                <article className="team-card" key={i}>
                  <div className="avatar" aria-hidden="true">{m.initials}</div>
                  <h3>{m.name}</h3>
                  <p className="role">{m.role}</p>
                  <p className="skills">{m.skills}</p>
                </article>
              ))}
            </div>

            <h2 className="section-title">Stack Tecnológico</h2>
            <div className="cards-grid stack-grid">
              {stackData.map((s, i) => (
                <div className="tech-card" key={i}>
                  <h4>{s.title}</h4>
                  <span className="chip">{s.chip}</span>
                  <p>{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="empezar" className="foot-cta">
          <div className="container">
            <h2>Listo para jugar?</h2>
            <p><a className="btn large" href="#">Comenzar ahora</a></p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <small>© TilinerOS — Proyecto académico. API: <a href="/api/v1/health">/api/v1/health</a></small>
        </div>
      </footer>
    </div>
  )
}
