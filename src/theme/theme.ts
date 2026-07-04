import { createTheme } from '@mui/material/styles';
import {
  getColorTokens,
  lightColors,
  darkColors,
  tokens,
  type AppThemeMode,
  type ColorTokens,
  type UiStyle,
} from './tokens';

export function createAppTheme({
  mode,
  uiStyle,
  colors,
}: {
  mode: AppThemeMode;
  uiStyle: UiStyle;
  colors: ColorTokens;
}) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.accent,
        dark: colors.accentStrong,
        contrastText: colors.accentContrast,
      },
      error: { main: colors.danger },
      success: { main: colors.success },
      background: {
        default: colors.pageBg,
        paper: colors.surface,
      },
      text: {
        primary: colors.text,
        secondary: colors.textSecondary,
      },
      divider: uiStyle === 'classic' ? colors.border : colors.borderLight,
    },
    typography: {
      fontFamily: colors.fontFamily,
      h1: { fontSize: '2.5rem', fontWeight: tokens.typography.weightBlack },
      h2: { fontSize: '2rem', fontWeight: tokens.typography.weightBold },
      h3: { fontSize: '1.5rem', fontWeight: tokens.typography.weightBold },
      h4: { fontSize: '1.25rem', fontWeight: tokens.typography.weightBold },
      h5: { fontSize: '1rem', fontWeight: tokens.typography.weightMedium },
      h6: { fontSize: '0.875rem', fontWeight: tokens.typography.weightMedium },
      body1: { fontSize: '1rem', fontWeight: tokens.typography.weightRegular, lineHeight: 1.45 },
      body2: { fontSize: '0.875rem', fontWeight: tokens.typography.weightRegular, lineHeight: 1.35 },
      caption: {
        fontSize: '0.75rem',
        letterSpacing: uiStyle === 'classic' ? 0 : '0.08em',
        textTransform: uiStyle === 'classic' ? 'none' : 'uppercase',
      },
      button: {
        textTransform: uiStyle === 'classic' ? 'none' : 'uppercase',
        fontWeight: tokens.typography.weightBold,
        letterSpacing: uiStyle === 'classic' ? 0 : '0.08em',
      },
    },
    spacing: 8,
    shape: { borderRadius: uiStyle === 'classic' ? tokens.shape.radiusMd : tokens.shape.radius },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.pageBg,
            color: colors.text,
            fontFamily: colors.fontFamily,
          },
          '#root': {
            minHeight: '100vh',
            backgroundColor: colors.pageBg,
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
      MuiPopover: { styleOverrides: { paper: { backgroundImage: 'none' } } },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: colors.surface,
            borderColor: uiStyle === 'classic' ? colors.border : colors.borderLight,
            boxShadow: uiStyle === 'classic' ? colors.shadowCard : 'none',
          },
        },
      },
      MuiTooltip: { defaultProps: { PopperProps: { disablePortal: true } } },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: uiStyle === 'classic' ? 'none' : 'uppercase',
            letterSpacing: uiStyle === 'classic' ? 0 : '0.08em',
            fontWeight: tokens.typography.weightBold,
          },
        },
      },
    },
  });
}

export const lightTheme = createAppTheme({
  mode: 'light',
  uiStyle: 'modern',
  colors: getColorTokens('light', 'modern', 'green'),
});

export const darkTheme = createAppTheme({
  mode: 'dark',
  uiStyle: 'modern',
  colors: getColorTokens('dark', 'modern', 'green'),
});

export { lightColors, darkColors };
