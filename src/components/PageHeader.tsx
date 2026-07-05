import { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

// Consistent page hero used across the app: subtle navy gradient panel with a
// title, optional subtitle, and a right-aligned actions slot.
export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        background: 'radial-gradient(120% 140% at 0% 0%, rgba(59,130,246,.16), transparent 55%), linear-gradient(180deg, #16233b, #1a2b47)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ letterSpacing: '-.2px' }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>
          )}
        </Box>
        {actions && <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
