import "./App.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SortingState } from "@tanstack/react-table";

import DataGrid, {
  type ColumnDef,
  type DataGridPaginationModel,
  type DataGridRef,
} from "./components/";
import {
  allEmployees,
  DEPTS,
  ROLES,
  STATUSES,
  type EmployeeRow,
} from "./test/data-test";

type EmployeeListQuery = {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  globalFilter: string;
};

type EmployeeListResponse = {
  pageNumber: number;
  pageSize: number;
  data: EmployeeRow[];
  totalRecord: number;
};

const fetchEmployees = (
  query: EmployeeListQuery,
): Promise<EmployeeListResponse> => {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      let nextRows = [...allEmployees];

      if (query.globalFilter) {
        const keyword = query.globalFilter.toLowerCase();
        nextRows = nextRows.filter((row) =>
          Object.values(row).some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(keyword),
          ),
        );
      }

      if (query.sorting[0]) {
        const activeSort = query.sorting[0];

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

      const totalRecords = nextRows.length;
      const start = query.pageIndex * query.pageSize;
      const end = start + query.pageSize;

      resolve({
        pageNumber: Math.max(1, Math.ceil(totalRecords / query.pageSize || 1)),
        pageSize: query.pageSize,
        data: nextRows.slice(start, end),
        totalRecord: totalRecords,
      });
    }, 500);
  });
};

const employeeColumns: ColumnDef<EmployeeRow>[] = [
  // {
  //   cell: "checkBox",
  //   pinned: "left",
  //   width: 52,
  // },
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
    width: 230,
  },
  {
    id: "dept",
    label: "Phòng ban",
    sortable: true,
    filterable: true,
    align: "center",
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
    width: 250,
    align: "center",
    // pinned: "right",
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
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<DataGridPaginationModel>({
    pageIndex: 0,
    pageSize: 20,
    pageSizeOptions: [20, 50, 80],
  });
  const [pageRows, setPageRows] = useState<EmployeeRow[]>([]);
  const [responseMeta, setResponseMeta] = useState<
    Pick<EmployeeListResponse, "pageNumber" | "pageSize" | "totalRecord">
  >({
    pageNumber: 1,
    pageSize: 20,
    totalRecord: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const requestModel = useMemo(
    () => ({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sorting,
      globalFilter,
    }),
    [globalFilter, pagination.pageIndex, pagination.pageSize, sorting],
  );

  const paginationModel = useMemo(
    () => ({
      ...pagination,
      pageSize: responseMeta.pageSize,
      pageCount: responseMeta.pageNumber,
      totalRows: responseMeta.totalRecord,
    }),
    [pagination, responseMeta],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    fetchEmployees(requestModel).then((response) => {
      if (!active) {
        return;
      }

      setPageRows(response.data);
      setResponseMeta({
        pageNumber: response.pageNumber,
        pageSize: response.pageSize,
        totalRecord: response.totalRecord,
      });
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [requestModel]);

  useEffect(() => {
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }));
  }, [globalFilter, sorting]);

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
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
      >
        <button
          onClick={() =>
            gridRef.current?.api.setColumnsVisible(["dept", "role"], false)
          }
          type="button"
        >
          Ẩn Phòng ban + Vai trò
        </button>
        <button
          onClick={() =>
            gridRef.current?.api.setColumnsVisible(["dept", "role"], true)
          }
          type="button"
        >
          Hiện Phòng ban + Vai trò
        </button>
        <button
          onClick={() =>
            gridRef.current?.api.setColumnsVisible(["salary"], false)
          }
          type="button"
        >
          Ẩn cột lương
        </button>
        <button
          onClick={() =>
            gridRef.current?.api.setColumnsVisible(["salary"], true)
          }
          type="button"
        >
          Hiện cột lương
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Tìm kiếm bên ngoài grid..."
          value={globalFilter}
          onChange={(event) =>
            gridRef.current?.api.setGlobalFilter(event.target.value)
          }
          style={{
            width: "100%",
            maxWidth: 320,
            height: 36,
            padding: "0 12px",
            border: "1px solid #d7e7fb",
            borderRadius: 8,
            outline: "none",
          }}
        />
      </div>
      <DataGrid<EmployeeRow>
        ref={gridRef}
        columns={employeeColumns}
        data={pageRows}
        contentHeight={600}
        enableColumnFilters={false}
        globalFilter={globalFilter}
        isLoading={isLoading}
        serverSide
        pagination={paginationModel}
        sorting={sorting}
        getRowId={(row) => row.id}
        onGlobalFilterChange={setGlobalFilter}
        onPaginationChange={(e) => {
          setPagination(e);
        }}
        onRowClick={(row) => console.log("row click", row)}
        onRowDoubleClick={(row) => console.log("row double click", row)}
        onSortingChange={setSorting}
      />
    </>
  );
}

export default App;
