import { Box, Chip } from '@mui/material';
import { DataGridPro, type GridColDef, type GridRowParams, type GridRowSelectionModel } from '@mui/x-data-grid-pro';
import type { Asset } from '../lib/types';
import { mediaKind, MEDIA_META } from '../lib/media';

export function AssetTable({ assets, selected, onSelectionChange, onOpen, autoHeight }: {
  assets: Asset[];
  selected: Set<string>;
  onSelectionChange: (ids: string[]) => void;
  onOpen: (a: Asset) => void;
  autoHeight?: boolean;
}) {
  const columns: GridColDef<Asset>[] = [
    {
      field: 'thumb', headerName: '', width: 58, sortable: false, filterable: false, disableColumnMenu: true,
      renderCell: (p) => {
        const kind = mediaKind(p.row.content_type, p.row.filename);
        const KindIcon = MEDIA_META[kind].icon;
        return (
          <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {p.row.thumbnailUrl
              ? <Box component="img" src={p.row.thumbnailUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <KindIcon size={18} color={MEDIA_META[kind].color} />}
          </Box>
        );
      },
    },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 200, valueGetter: (_v, row) => row.title || row.filename || '' },
    {
      field: 'media', headerName: 'Media', width: 120, sortable: true,
      valueGetter: (_v, row) => mediaKind(row.content_type, row.filename),
      renderCell: (p) => {
        const kind = mediaKind(p.row.content_type, p.row.filename);
        return <Chip size="small" label={kind} sx={{ bgcolor: `${MEDIA_META[kind].color}22`, color: MEDIA_META[kind].color, fontWeight: 700 }} />;
      },
    },
    { field: 'type', headerName: 'Type', width: 120 },
    { field: 'brand', headerName: 'Brand', width: 110 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" variant="outlined" label={p.row.status} color={p.row.status === 'approved' ? 'success' : p.row.status === 'archived' ? 'default' : 'warning'} />,
    },
    { field: 'tags', headerName: 'Tags', flex: 1, minWidth: 160, sortable: false, valueGetter: (_v, row) => (row.tags || []).map((t) => t.name).join(', ') },
    { field: 'updated_at', headerName: 'Updated', width: 130, valueFormatter: (v) => (v ? new Date(v as string).toLocaleDateString() : '') },
  ];

  const grid = (
    <DataGridPro
      rows={assets}
      columns={columns}
      getRowId={(r) => r.id}
      rowHeight={52}
      checkboxSelection
      disableRowSelectionOnClick
      onRowClick={(p: GridRowParams<Asset>) => onOpen(p.row)}
      rowSelectionModel={[...selected] as GridRowSelectionModel}
      onRowSelectionModelChange={(m) => onSelectionChange((m as (string | number)[]).map(String))}
      autoHeight={autoHeight}
      pagination
      pageSizeOptions={[25, 50, 100]}
      initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 1,
        '& .MuiDataGrid-row': { cursor: 'pointer' },
        '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafbfc' },
        '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
      }}
    />
  );

  return autoHeight ? grid : <Box sx={{ height: 640, width: '100%' }}>{grid}</Box>;
}
