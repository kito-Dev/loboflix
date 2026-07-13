import { Outlet, useLocation } from 'react-router-dom';

import { AddFilmSheet } from './AddFilmSheet';

import { FAB } from './FAB';

import { TabBar } from './TabBar';

import { TrailerOverlay } from './TrailerOverlay';
import { WatchPromptOverlay } from './WatchPromptOverlay';



const FAB_ROUTES = ['/', '/schedule', '/library'];

const CHROMELESS_PREFIXES = ['/movies/', '/series/', '/profile/history', '/profile/settings', '/schedule/build'];



export function AppShell() {

  const location = useLocation();

  const hideChrome = CHROMELESS_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  const showFab = !hideChrome && FAB_ROUTES.includes(location.pathname);



  return (

    <div className={`app-shell${hideChrome ? ' app-shell--immersive' : ''}`}>

      <Outlet />



      {showFab ? <FAB /> : null}

      {!hideChrome ? <TabBar /> : null}

      <AddFilmSheet />

      <TrailerOverlay />
      <WatchPromptOverlay />

    </div>

  );

}


