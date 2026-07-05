import { createTheme } from '@mui/material/styles';

// Clean, minimal light theme (Brandox-style): white surfaces, neutral grays,
// hairline borders, restrained navy accent. No colored backgrounds.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1F4E79' },      // brix navy — accent only (buttons/links)
    secondary: { main: '#334155' },
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e6e8ec',
    success: { main: '#16a34a' },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    action: { hover: '#f4f6f9', selected: '#eef2f7' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    h6: { fontWeight: 800, letterSpacing: '-.2px' },
    subtitle1: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: '#ffffff', color: '#0f172a' } } },
  },
});
