# DataGrid

```bash
npm i @tanstack/react-table
```

```ts
import DataGrid, {
  type ColumnDef,
  type DataGridCellComponentProps,
  type DataGridPaginationModel,
  type DataGridRef,
} from "./components";
```

## Mẫu khai báo cột

```ts
type EmployeeRow = {
  id: string;
  name: string;
  dept: string;
  salary: number;
};

const columns: ColumnDef<EmployeeRow>[] = [
  { cell: "checkBox", pinned: "left", width: 52 },
  { field: "name", headerName: "Họ tên", sortable: true, width: 220 },
  { field: "dept", headerName: "Phòng ban", sortable: true, width: 150 },
  {
    field: "salary",
    headerName: "Lương",
    align: "right",
    width: 140,
    sortable: true,
    enableSummary: true, // bật tính tổng cho cột này
  },
];
```

## Ghim cột (Pinning)

- Ghim trái/phải ngay trong `coldef` bằng `pinned: "left" | "right"`.
- Bật/tắt tính năng bằng prop `enablePinning` (mặc định bật).

```ts
const columns: ColumnDef<EmployeeRow>[] = [
  { cell: "checkBox", pinned: "left", width: 52 },
  { field: "name", headerName: "Họ tên", pinned: "left", width: 220 },
  { field: "status", headerName: "Trạng thái", pinned: "right", width: 160 }
];
```

```tsx
<DataGrid columns={columns} data={rows} enablePinning />
```

## Sort

- Bật sort theo cột bằng `sortable: true` trong `coldef`.
- Bật/tắt tính năng sort toàn grid bằng `enableSort` (mặc định bật).

```ts
const columns: ColumnDef<EmployeeRow>[] = [
  { field: "name", headerName: "Họ tên", sortable: true, width: 220 },
  {
    field: "salary",
    headerName: "Lương",
    sortable: true,
    align: "right",
    width: 140,
  }
];
```

```tsx
<DataGrid columns={columns} data={rows} enableSort />
```

## Wrap text

- Bật toàn grid bằng `wrapText`.
- Hoặc bật theo từng cột bằng `wrapText: true` trong `coldef`.

```ts
const columns: ColumnDef<EmployeeRow>[] = [
  { field: "name", headerName: "Họ tên", width: 220, wrapText: true },
  { field: "dept", headerName: "Phòng ban", width: 150 }
];
```

```tsx
<DataGrid columns={columns} data={rows} wrapText />
```

## Show tooltip

- Bật bằng `showTooltip`.
- Khi nội dung cell vượt chiều rộng cột, cell sẽ hiển thị `...`; hover vào cell sẽ hiện tooltip full nội dung.

```tsx
<DataGrid columns={columns} data={rows} showTooltip />
```

## cellComponent (khuyến nghị)

Dùng `cellComponent` để khai báo cell custom theo kiểu config, tránh viết inline `cell: (row) => ...` trong mảng cột.

```tsx
type RowAction = {
  rowId: string;
};

type ActionCellProps = {
  onAction: (payload: RowAction) => void;
  label: string;
} & DataGridCellComponentProps<EmployeeRow>;

function ActionCell({ row, onAction, label }: ActionCellProps) {
  return (
    <button type="button" onClick={() => onAction({ rowId: String(row.id) })}>
      {label}
    </button>
  );
}

const columns: ColumnDef<EmployeeRow>[] = [
  {
    field: "actions",
    headerName: "Hành động",
    width: 140,
    align: "center",
    cellComponent: ActionCell,
    cellProps: {
      label: "Sửa",
      onAction: ({ rowId }) => console.log("edit row", rowId),
    },
  },
];
```

`cellProps` có thể là object hoặc function:

```ts
cellProps: ({ row }) => ({
  label: row.dept === "IT" ? "Chi tiết" : "Xem",
  onAction: ({ rowId }) => console.log(rowId),
});
```

## Thứ tự ưu tiên render cell

Grid render cell theo thứ tự:

1. `renderCell(params)`
2. `cellComponent + cellProps`
3. `cell(row)` (API cũ, tương thích ngược)
4. `valueFormatter`
5. render mặc định `String(value ?? "")`

## Client-side (`serverSide = false`)

Chỉ cần truyền `data` đầy đủ và `pageSizeOptions`, grid tự phân trang nội bộ.

```tsx
<DataGrid<EmployeeRow>
  columns={columns}
  data={rows}
  serverSide={false}
  pageSizeOptions={[20, 50, 80]}
  showSummary
  contentHeight={500}
/>
```

## Server-side (`serverSide = true`)

Truyền `data` theo trang hiện tại + `pagination` từ API.

API response mẫu:

```json
{
  "pageIndex": 0,
  "pageSize": 20,
  "pageCount": 10,
  "totalRows": 200,
  "summary": {
    "salary": 123456789
  },
  "data": [
    { "id": "1", "name": "Nguyen Van A", "dept": "IT", "salary": 25000000 },
    { "id": "2", "name": "Tran Thi B", "dept": "HR", "salary": 18000000 }
  ]
}
```

```tsx
const [pagination, setPagination] = useState<DataGridPaginationModel>({
  pageIndex: 0,
  pageSize: 20,
  pageSizeOptions: [20, 50, 80],
  pageCount: 10, // tổng số trang từ API
  totalRows: 200, // tổng số bản ghi từ API
  summary: {
    salary: 123456789, // map theo field id
  },
});

<DataGrid<EmployeeRow>
  columns={columns}
  data={pageRows}
  serverSide
  pagination={pagination}
  onPaginationChange={setPagination}
  showSummary
  contentHeight={500}
/>
```

## Ghi chú summary

- `showSummary = false` -> không tính và không hiển thị dòng tổng.
- `serverSide = false` -> tự cộng từ `data source` cho các cột có `enableSummary: true`.
- `serverSide = true` -> chỉ hiển thị giá trị tổng tại các cột có `enableSummary: true` và có dữ liệu trong `pagination.summary`.
