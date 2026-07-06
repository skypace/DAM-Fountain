import { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ py: 8, px: 2, textAlign: 'center', color: 'text.secondary' }}>
      <Box sx={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'primary.main' }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" color="text.primary">{title}</Typography>
      {description && <Typography variant="body2" sx={{ maxWidth: 420 }}>{description}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  );
}

// Grid of shimmering placeholder cards for loading states.
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{
          borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden',
          '@media (prefers-reduced-motion: no-preference)': { animation: 'fountainPulse 1.4s ease-in-out infinite' },
          '@keyframes fountainPulse': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 0.85 } },
        }}>
          <Box sx={{ aspectRatio: '4 / 3', bgcolor: 'action.hover' }} />
          <Box sx={{ p: 1 }}>
            <Box sx={{ height: 12, width: '70%', bgcolor: 'action.hover', borderRadius: 1, mb: 0.75 }} />
            <Box sx={{ height: 10, width: '40%', bgcolor: 'action.hover', borderRadius: 1 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
