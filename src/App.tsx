import "./App.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

import DataGrid, { type ColumnDef, type DataGridRef } from "./components/";

type EmployeeRow = {
  id: number;
  name: string;
  dept: string;
  role: string;
  salary: number;
  progress: number;
  status: "active" | "inactive" | "pending";
  isVip: boolean;
  joined: string;
};

const NAMES = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Minh Châu",
  "Phạm Quốc Dũng",
  "Hoàng Thị Én",
  "Đỗ Văn Phúc",
  "Bùi Thị Giang",
  "Vũ Hữu Hùng",
  "Ngô Thị Ích",
  "Đinh Văn Khoa",
  "Lý Thị Lan",
  "Trương Văn Mạnh",
  "Phan Thị Ngọc",
  "Cao Văn Ổn",
  "Dương Thị Phượng",
  "Hồ Văn Quân",
  "Võ Thị Rạng",
  "Đặng Văn Sơn",
  "Tô Thị Tuyết",
  "Mai Văn Uy",
  "Lưu Thị Vân",
  "Chu Văn Xuyên",
  "Quách Thị Yến",
  "Kiều Văn Zũng",
  "Mạc Thị Ánh",
] as const;

const DEPTS = [
  "Kỹ thuật",
  "Marketing",
  "Kinh doanh",
  "Nhân sự",
  "Tài chính",
] as const;
const ROLES = ["Nhân viên", "Trưởng nhóm", "Quản lý", "Giám đốc"] as const;
const STATUSES = ["active", "inactive", "pending"] as const;
const allEmployees: EmployeeRow[] = Array.from({ length: 80 }, (_, index) => ({
  id: index + 1,
  name:
    NAMES[index % NAMES.length] +
    (index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 2}` : ""),
  dept: DEPTS[index % DEPTS.length],
  role: ROLES[index % ROLES.length],
  salary: Math.round(((25 + Math.random() * 75) * 1e6) / 1e6) * 1e6,
  progress: Math.round(30 + Math.random() * 70),
  status: STATUSES[index % STATUSES.length],
  isVip: index % 7 === 0,
  joined: `${2019 + Math.floor(index / 20)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
}));

const employeeColumns: ColumnDef<EmployeeRow>[] = [
  {
    cell: "checkBox",
    pinned: "left",
    width: 52,
    enableHiding: false,
  },
  {
    id: "id",
    label: "ID",
    sortable: true,
    width: 80,
    align: "center",
    hide: true,
  },
  {
    id: "name",
    label: "Họ tên",
    sortable: true,
    width: 240,
  },
  {
    id: "dept",
    label: "Phòng ban",
    sortable: true,
    filterable: true,
    filterType: "select",
    options: ["", ...DEPTS],
    width: 150,
  },
  {
    id: "role",
    label: "Vai trò",
    sortable: true,
    filterable: true,
    filterType: "select",
    options: ["", ...ROLES],
    width: 150,
  },
  {
    id: "salary",
    label: "Lương (VNĐ)",
    sortable: true,
    width: 150,
    align: "right",
    cell: (row) => (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {row.salary.toLocaleString("vi-VN")}đ
      </span>
    ),
  },
  {
    id: "progress",
    label: "Tiến độ",
    sortable: true,
    width: 170,
    align: "center",
    cell: (row) => {
      const color =
        row.progress >= 70
          ? "#1D9E75"
          : row.progress >= 40
            ? "#378ADD"
            : "#E24B4A";

      return (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "block",
              minWidth: 60,
              flex: 1,
              overflow: "hidden",
              height: 6,
              borderRadius: 3,
              background: "#E6F1FB",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${row.progress}%`,
                height: "100%",
                borderRadius: 3,
                background: color,
              }}
            />
          </span>
          <span style={{ minWidth: 28, fontSize: 12 }}>{row.progress}%</span>
        </span>
      );
    },
  },
  {
    id: "status",
    label: "Trạng thái",
    sortable: true,
    filterable: true,
    filterType: "select",
    options: ["", ...STATUSES],
    width: 130,
    align: "center",
    pinned: "right",
    cell: (row) => {
      const palette =
        row.status === "active"
          ? { label: "Hoạt động", bg: "#EAF3DE", color: "#3B6D11" }
          : row.status === "inactive"
            ? { label: "Tạm dừng", bg: "#F1EFE8", color: "#5F5E5A" }
            : { label: "Chờ duyệt", bg: "#FAEEDA", color: "#854F0B" };

      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 9px",
            borderRadius: 10,
            background: palette.bg,
            color: palette.color,
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {palette.label}
        </span>
      );
    },
  },
  {
    id: "joined",
    label: "Ngày vào",
    sortable: true,
    width: 120,
    align: "center",
    hide: true,
  },
];

function App() {
  const gridRef = useRef<DataGridRef<EmployeeRow>>(null);
  const [dataSource, setDataSource] = useState<EmployeeRow[]>(allEmployees);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [pageRows, setPageRows] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const processedRows = useMemo(() => {
    let nextRows = [...dataSource];

    if (globalFilter) {
      const query = globalFilter.toLowerCase();
      nextRows = nextRows.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        ),
      );
    }

    columnFilters.forEach((filter) => {
      const value = String(filter.value ?? "").toLowerCase();
      if (!value) {
        return;
      }

      nextRows = nextRows.filter((row) => {
        const cellValue = row[filter.id as keyof EmployeeRow];
        return String(cellValue ?? "")
          .toLowerCase()
          .includes(value);
      });
    });

    if (sorting[0]) {
      const activeSort = sorting[0];

      nextRows.sort((a, b) => {
        const aValue = a[activeSort.id as keyof EmployeeRow];
        const bValue = b[activeSort.id as keyof EmployeeRow];
        const comparison =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue ?? "").localeCompare(String(bValue ?? ""), "vi");

        return activeSort.desc ? -comparison : comparison;
      });
    }

    return nextRows;
  }, [columnFilters, dataSource, globalFilter, sorting]);

  const pageCount = useMemo(
    () => Math.ceil(processedRows.length / pagination.pageSize),
    [pagination.pageSize, processedRows.length],
  );

  useEffect(() => {
    setIsLoading(true);

    const timer = window.setTimeout(() => {
      const start = pagination.pageIndex * pagination.pageSize;
      const end = start + pagination.pageSize;
      setPageRows(processedRows.slice(start, end));
      setIsLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pagination, processedRows]);

  useEffect(() => {
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }));
  }, [columnFilters, globalFilter, sorting]);

  return (
    <>
      <button
        onClick={() => {
          const firstRow = pageRows[0];
          if (!firstRow) {
            return;
          }

          const res = gridRef.current?.api.applyTransaction({
            update: [
              {
                ...firstRow,
                salary: firstRow.salary + 1_000_000,
              },
            ],
          });
          console.log("transaction result", res);
        }}
        style={{ marginBottom: 8, marginRight: 8 }}
        type="button"
      >
        applyTransaction update dòng đầu
      </button>
      <button
        onClick={() => {
          console.log(
            "selected rows",
            gridRef.current?.api.getSelectedRows() ?? [],
          );
        }}
        style={{ marginBottom: 8 }}
        type="button"
      >
        Lấy dòng đã chọn
      </button>
      <DataGrid<EmployeeRow>
        ref={gridRef}
        columns={employeeColumns}
        data={pageRows}
        enableGlobalFilter
        enableColumnFilters={false}
        enableColumnVisibility
        enablePinning
        enableResize={true}
        enableSort
        enablePagination
        columnFilters={columnFilters}
        globalFilter={globalFilter}
        isLoading={isLoading}
        manualFiltering
        manualPagination
        manualSorting
        pageCount={pageCount}
        pageSizeOptions={[5, 10, 20, 50]}
        pagination={pagination}
        rowCount={processedRows.length}
        sorting={sorting}
        getRowId={(row) => row.id}
        onDataSourceChange={setDataSource}
        onColumnFiltersChange={setColumnFilters}
        onGlobalFilterChange={setGlobalFilter}
        onPaginationChange={setPagination}
        onRowClick={(row) => console.log("row click", row)}
        onRowDoubleClick={(row) => console.log("row double click", row)}
        onSortingChange={setSorting}
      />
    </>
  );
}

export default App;
