import { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAtom, useSetAtom } from 'jotai';
import { lightTheme, darkTheme } from './theme/theme';
import { lightColors, darkColors, applyAccent } from './theme/tokens';
import { ColorTokensContext } from './theme/ColorTokensContext';
import { themeAtom, accentAtom, accountAtom } from './state/atoms';
import { EnumTheme } from './types';
import { AppRoutes } from './routes/Routes';
import { getUserAccount } from './api/qortal';

export function App() {
  const [theme] = useAtom(themeAtom);
  const [accent] = useAtom(accentAtom);
  const setAccount = useSetAtom(accountAtom);

  const isDark = theme === EnumTheme.DARK;

  useEffect(() => {
    getUserAccount()
      .then(a => setAccount({ address: a.address, name: a.name }))
      .catch(() => {});
  }, [setAccount]);

  useEffect(() => {
    function onMessage(e: MessageEvent<unknown>) {
      if (
        (e.source === window.parent || e.source === window) &&
        typeof e.data === 'object' && e.data !== null &&
        (e.data as { action?: unknown }).action === 'SELECTED_ACCOUNT_CHANGED'
      ) {
        getUserAccount()
          .then(a => setAccount({ address: a.address, name: a.name }))
          .catch(() => {});
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setAccount]);

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <CssBaseline />
      <ColorTokensContext.Provider value={applyAccent(isDark ? darkColors : lightColors, accent)}>
        <AppRoutes />
      </ColorTokensContext.Provider>
    </ThemeProvider>
  );
}
