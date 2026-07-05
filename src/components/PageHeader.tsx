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
    <Box sx={{ pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="flex-end" spacing={2} flexWrap="wrap" useFlexGap>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.4px' }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>
          )}
        </Box>
        {actions && <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
