import { createHashRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { MyUploadsPage } from '../pages/MyUploadsPage';
import { ExplorePage } from '../pages/ExplorePage';
import { ListsPage } from '../pages/ListsPage';
import { useIframe } from '../hooks/useIframeListener';

const _startRoute = new URLSearchParams(window.location.search).get('_route');
if (_startRoute) window.location.hash = _startRoute;

function Layout() {
  useIframe();

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
      { index: true,          element: <MyUploadsPage /> },
      { path: 'explore',      element: <ExplorePage />   },
      { path: 'lists',        element: <Navigate to="following" replace /> },
      { path: 'lists/:tab',   element: <ListsPage />     },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
