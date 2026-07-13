import { Calendar, Clapperboard, Home, User } from 'lucide-react';

import { NavLink } from 'react-router-dom';



const tabs = [

  { to: '/', label: 'Início', icon: Home },

  { to: '/schedule', label: 'Agenda', icon: Calendar },

  { to: '/library', label: 'Watch List', icon: Clapperboard },

  { to: '/profile', label: 'Perfil', icon: User },

];



export function TabBar() {

  return (

    <nav className="tab-bar" aria-label="Navegação principal">

      {tabs.map(({ to, label, icon: Icon }) => (

        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>

          {({ isActive }) => (

            <>

              <Icon size={22} strokeWidth={1.6} fill={isActive ? 'currentColor' : 'none'} />

              <span>{label}</span>

            </>

          )}

        </NavLink>

      ))}

    </nav>

  );

}


