import { createTheme } from '@mui/material/styles';

// Fountain DAM — a clean, editorial light theme: white surfaces, soft neutral
// grays, hairline borders, layered shadows, and a restrained Brix-navy accent.
const navy = '#1F4E79';
const navyDark = '#173a5c';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: navy, dark: navyDark, contrastText: '#ffffff' },
    secondary: { main: '#334155' },
    background: { default: '#f7f8fa', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#667085' },
    divider: '#e7e9ee',
    success: { main: '#16a34a' },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    action: { hover: '#f4f6f9', selected: '#eaf0f7', focus: '#e2e8f0' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    h4: { fontWeight: 800, letterSpacing: 0, lineHeight: 1.15 },
    h5: { fontWeight: 800, letterSpacing: 0, lineHeight: 1.2 },
    h6: { fontWeight: 800, letterSpacing: 0, lineHeight: 1.25 },
    subtitle1: { fontWeight: 700, letterSpacing: 0 },
    subtitle2: { fontWeight: 700, letterSpacing: 0 },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.5 },
    caption: { letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: '#e7e9ee' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 16, minHeight: 38 },
        sizeSmall: { paddingInline: 12, minHeight: 32 },
        contained: { boxShadow: '0 1px 2px rgba(15,23,42,.08)', '&:hover': { boxShadow: '0 4px 12px rgba(31,78,121,.22)' } },
        outlined: { borderColor: '#dfe3ea', '&:hover': { borderColor: navy, backgroundColor: '#f4f6f9' } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600 },
        outlined: { borderColor: '#dfe3ea' },
        sizeSmall: { height: 22 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', borderColor: '#dfe3ea', color: '#667085', paddingInline: 12,
          '&.Mui-selected': { color: navy, backgroundColor: '#eaf0f7', '&:hover': { backgroundColor: '#e0e9f3' } },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: '#fff' },
        notchedOutline: { borderColor: '#dfe3ea' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#0f172a', fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '6px 10px' },
        arrow: { color: '#0f172a' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 8, border: '1px solid #e7e9ee', boxShadow: '0 12px 32px rgba(15,23,42,.14)' },
      },
    },
    MuiPopover: {
      styleOverrides: { paper: { borderRadius: 8, boxShadow: '0 12px 32px rgba(15,23,42,.14)' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 8, boxShadow: '0 24px 64px rgba(15,23,42,.24)' } },
    },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: '#ffffff', color: '#0f172a' } } },
  },
});
