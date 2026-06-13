import { useAtom } from 'jotai';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExploreIcon from '@mui/icons-material/Explore';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useNavigate, useLocation } from 'react-router-dom';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';
import { themeAtom } from '../../state/atoms';
import { EnumTheme } from '../../types';

const NAV = [
  { path: '/',        icon: <FolderOpenIcon fontSize="small" />,  label: 'My Publishes' },
  { path: '/publish', icon: <CloudUploadIcon fontSize="small" />, label: 'Publish'      },
  { path: '/explore', icon: <ExploreIcon fontSize="small" />,     label: 'Explore'      },
];

export function TopBar() {
  const c = useColors();
  const [theme, setTheme] = useAtom(themeAtom);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: tokens.spacing.topBarHeight,
        bgcolor: c.surface,
        borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        display: 'flex', alignItems: 'center',
        px: 2, gap: 0.5, zIndex: 100,
      }}
    >
      <Box sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1rem', color: c.textPrimary, letterSpacing: '-0.01em', mr: 'auto' }}>
        Publish
      </Box>

      {NAV.map(({ path, icon, label }) => {
        const active = location.pathname === path;
        return (
          <Tooltip key={path} title={label} placement="bottom">
            <IconButton
              onClick={() => navigate(path)}
              sx={{
                borderRadius: `${tokens.shape.radius}px`,
                minWidth: 44, minHeight: 44,
                color: active ? c.accent : c.textSecondary,
                '&:hover': { color: c.accent, bgcolor: c.borderLight },
                transition: '0.15s ease',
              }}
            >
              {icon}
            </IconButton>
          </Tooltip>
        );
      })}

      <Tooltip title={theme === EnumTheme.DARK ? 'Light mode' : 'Dark mode'} placement="bottom">
        <IconButton
          onClick={() => setTheme(t => t === EnumTheme.DARK ? EnumTheme.LIGHT : EnumTheme.DARK)}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            minWidth: 44, minHeight: 44,
            color: c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.15s ease',
          }}
        >
          {theme === EnumTheme.DARK ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
