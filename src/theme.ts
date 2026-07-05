import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3B82F6' },
    secondary: { main: '#1F4E79' },
    background: { default: '#0F172A', paper: '#16233b' },
    text: { primary: '#E7ECF5', secondary: '#93A2be' },
    divider: '#26375a',
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
