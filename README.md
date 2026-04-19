# DataGrid

```bash
npm i @tanstack/react-table
```

```ts
import DataGrid, {
  type ColumnDef,
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
  { id: "name", label: "Họ tên", sortable: true, width: 220 },
  { id: "dept", label: "Phòng ban", sortable: true, width: 150 },
  {
    id: "salary",
    label: "Lương",
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
  { id: "name", label: "Họ tên", pinned: "left", width: 220 },
  { id: "status", label: "Trạng thái", pinned: "right", width: 160 }
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
  { id: "name", label: "Họ tên", sortable: true, width: 220 },
  { id: "salary", label: "Lương", sortable: true, align: "right", width: 140 }
];
```

```tsx
<DataGrid columns={columns} data={rows} enableSort />
```

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
