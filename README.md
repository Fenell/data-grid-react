# DataGrid Module

Copy entire `Grid` folder into another project, then install dependency:

```bash
npm i @tanstack/react-table
```

## Public Entry

Import from the folder root:

```ts
import DataGrid, { type ColumnDef, type DataGridRef } from "./Grid";
```

## Required Files

- `DataGrid.tsx` - main component
- `DataGrid.module.css` - styles
- `index.ts` - module entry exports

## Basic Usage

```tsx
const gridRef = useRef<DataGridRef<Row>>(null);

<DataGrid<Row>
  ref={gridRef}
  columns={columns}
  data={rows}
  getRowId={(row) => row.id}
/>;
```

## Transaction API

```ts
const result = gridRef.current?.api.applyTransaction({
  add: [newRow],
  update: [updatedRow],
  remove: [removedRow],
});
```

## Checkbox Column (minimal)

```ts
const columns: ColumnDef<Row>[] = [
  { cell: "checkBox", pinned: "left", width: 52 },
  { id: "name", label: "Name" },
];
```
