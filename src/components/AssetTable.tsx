import { Box, Chip } from '@mui/material';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { DataGridPro, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid-pro';
import type { Asset } from '../lib/types';

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u || '');

export function AssetTable({ assets, selected, onSelectionChange, onOpen }: {
  assets: Asset[];
  selected: Set<string>;
  onSelectionChange: (ids: string[]) => void;
  onOpen: (a: Asset) => void;
}) {
  const columns: GridColDef<Asset>[] = [
    {
      field: 'thumb', headerName: '', width: 58, sortable: false, filterable: false, disableColumnMenu: true,
      renderCell: (p) => (
        <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {p.row.thumbnailUrl
            ? <Box component="img" src={p.row.thumbnailUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : (isPdf(p.row.url) ? <FileText size={18} opacity={0.5} /> : <ImageIcon size={18} opacity={0.5} />)}
        </Box>
      ),
    },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 200, valueGetter: (_v, row) => row.title || row.filename || '' },
    { field: 'type', headerName: 'Type', width: 120 },
    { field: 'brand', headerName: 'Brand', width: 110 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" variant="outlined" label={p.row.status} color={p.row.status === 'approved' ? 'success' : p.row.status === 'archived' ? 'default' : 'warning'} />,
    },
    {
      field: 'tags', headerName: 'Tags', flex: 1, minWidth: 160, sortable: false,
      valueGetter: (_v, row) => row.tags.map((t) => t.name).join(', '),
    },
    {
      field: 'updated_at', headerName: 'Updated', width: 130,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleDateString() : ''),
    },
  ];

  return (
    <Box sx={{ height: 640, width: '100%' }}>
      <DataGridPro
        rows={assets}
        columns={columns}
        getRowId={(r) => r.id}
        rowHeight={52}
        checkboxSelection
        disableRowSelectionOnClick
        onRowClick={(p) => onOpen(p.row)}
        rowSelectionModel={[...selected] as GridRowSelectionModel}
        onRowSelectionModelChange={(m) => onSelectionChange((m as (string | number)[]).map(String))}
        pagination
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 3,
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafbfc' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
      />
    </Box>
  );
}
