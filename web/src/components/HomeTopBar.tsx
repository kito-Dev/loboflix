import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { LogoWordmark } from './Logo';
import { useApp } from '../context/AppContext';
import { initials } from '../utils/movie';

function getUserName() {
  try {
    const raw = localStorage.getItem('loboflix_user');
    if (raw) return JSON.parse(raw).name as string;
  } catch {
    /* ignore */
  }
  return 'Você';
}

export function HomeTopBar() {
  const { openAddFilm } = useApp();

  return (
    <header className="home-hero__topbar">
      <LogoWordmark />
      <div className="top-bar__actions">
        <button type="button" className="icon-btn-plain" onClick={openAddFilm} aria-label="Buscar">
          <Search size={22} strokeWidth={1.6} />
        </button>
        <Link className="avatar-chip" to="/profile" aria-label="Perfil">
          {initials(getUserName())}
        </Link>
      </div>
    </header>
  );
}
