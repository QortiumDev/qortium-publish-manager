import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { MyUploadsPage } from '../pages/MyUploadsPage';
import { PublishPage } from '../pages/PublishPage';
import { ExplorePage } from '../pages/ExplorePage';
import { useIframe } from '../hooks/useIframeListener';

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
      { index: true,        element: <MyUploadsPage /> },
      { path: 'publish',    element: <PublishPage />   },
      { path: 'explore',    element: <ExplorePage />   },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
