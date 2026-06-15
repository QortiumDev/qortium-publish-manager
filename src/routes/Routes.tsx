import { createHashRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { MyUploadsPage } from '../pages/MyUploadsPage';
import { PublishPage } from '../pages/PublishPage';
import { ExplorePage } from '../pages/ExplorePage';
import { useIframe } from '../hooks/useIframeListener';

function Layout() {
  const navigate = useNavigate();
  const applied = useRef(false);
  useIframe();

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const route = new URLSearchParams(window.location.search).get('_route');
    if (route) navigate(route, { replace: true });
  }, [navigate]);

  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,        element: <MyUploadsPage /> },
      { path: 'publish',    element: <PublishPage />   },
      { path: 'explore',    element: <ExplorePage />   },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
