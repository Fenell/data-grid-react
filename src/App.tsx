import "./App.css";
import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { SortingState } from "@tanstack/react-table";

import DataGrid, { type ColumnDef, type DataGridRef } from "./components/";
import {
  allEmployees,
  DEPTS,
  ROLES,
  STATUSES,
  type EmployeeRow,
} from "./test/data-test";

type RowActionEvent = {
  actionKey: string;
  row: EmployeeRow;
};

type RowActionButtonCellProps = {
  actionKey: string;
  buttonLabel: string;
  row: EmployeeRow;
  onAction: (event: RowActionEvent) => void;
};

function RowActionButtonCell({
  actionKey,
  buttonLabel,
  row,
  onAction,
}: RowActionButtonCellProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAction({
      actionKey,
      row,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={(event) => event.stopPropagation()}
      style={{
        border: "none",
        borderRadius: 999,
        background: "#e9f5ff",
        color: "#0f4c81",
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {buttonLabel}
    </button>
  );
}

const createEmployeeColumns = (
  onCellAction: (event: RowActionEvent) => void,
): ColumnDef<EmployeeRow>[] => [
  {
    cell: "checkBox",
    pinned: "left",
    width: 52,
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
    width: 230,
  },
  {
    id: "dept",
    label: "Phòng ban Mai tuấn",
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
    enableSummary: true,
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
    width: 100,
    align: "center",
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
    id: "actions",
    label: "Hành động",
    width: 130,
    align: "center",
    pinned: "right",
    cell: (row) => (
      <RowActionButtonCell
        row={row}
        actionKey="open-profile"
        buttonLabel="Xem hồ sơ"
        onAction={onCellAction}
      />
    ),
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
  const [lastAction, setLastAction] = useState<RowActionEvent | null>(null);

  const handleCellAction = (event: RowActionEvent) => {
    setLastAction(event);
    console.log("cell custom action", event);
  };

  const employeeColumns = createEmployeeColumns(handleCellAction);

  return (
    <>
      <button
        onClick={() => {
          const firstRow = allEmployees[0];
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
        style={{
          marginBottom: 12,
          border: "1px solid #d7e7fb",
          borderRadius: 8,
          padding: "8px 12px",
          background: "#f8fbff",
          fontSize: 13,
        }}
      >
        {lastAction
          ? `Cell action: ${lastAction.actionKey} | row id: ${lastAction.row.id} | name: ${lastAction.row.name}`
          : "Chưa có sự kiện từ custom cell"}
      </div>

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
        data={allEmployees}
        contentHeight={500}
        enableColumnFilters={false}
        globalFilter={globalFilter}
        serverSide={false}
        pageSizeOptions={[20, 50, 100]}
        showSummary={true}
        sorting={sorting}
        getRowId={(row) => row.id}
        onGlobalFilterChange={setGlobalFilter}
        onRowClick={(row) => console.log("row click", row)}
        onRowDoubleClick={(row) => console.log("row double click", row)}
        onSortingChange={setSorting}
      />
    </>
  );
}

export default App;
