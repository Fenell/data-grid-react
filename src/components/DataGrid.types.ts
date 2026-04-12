import type { CSSProperties, ReactNode } from "react";
import type {
  Column,
  ColumnFiltersState,
  PaginationState,
  RowData as TanStackRowData,
  SortingState,
  Updater,
} from "@tanstack/react-table";

export type GridRow = {
  id: number | string;
} & Record<string, unknown>;

export type ColumnId<T extends GridRow> = Extract<keyof T, string>;
export type ColumnFilterType = "select";
export type ColumnAlign = "left" | "center" | "right";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends TanStackRowData, TValue> {
    align?: ColumnAlign;
    filterType?: ColumnFilterType;
    filterOptions?: readonly string[];
    hasCheckbox?: boolean;
  }
}

type SharedColumnOptions = {
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  pinned?: "left" | "right";
  hide?: boolean;
  enableHiding?: boolean;
  enablePinning?: boolean;
  enableResizing?: boolean;
};

type DataColumnDef<T extends GridRow> = {
  id: ColumnId<T>;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: ColumnFilterType;
  options?: readonly string[];
  cell?: (row: T) => ReactNode;
} & SharedColumnOptions;

type CheckboxColumnDef = {
  cell: "checkBox";
  id?: string;
  label?: string;
} & SharedColumnOptions;

export type ColumnDef<T extends GridRow> = DataColumnDef<T> | CheckboxColumnDef;

export type DataGridFeatureFlags = {
  enableGlobalFilter?: boolean;
  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  enablePinning?: boolean;
  enableResize?: boolean;
  enableSort?: boolean;
  enablePagination?: boolean;
};

export type DataGridPaginationModel = PaginationState & {
  pageSizeOptions?: number[];
  totalRows?: number;
  pageCount?: number;
};

export type DataGridServerPaginationProps = {
  serverSide?: boolean;
  manualPagination?: boolean;
  manualSorting?: boolean;
  manualFiltering?: boolean;
  pagination?: DataGridPaginationModel;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  globalFilter?: string;
  defaultPagination?: DataGridPaginationModel;
  onPaginationChange?: (updater: Updater<DataGridPaginationModel>) => void;
  onSortingChange?: (updater: Updater<SortingState>) => void;
  onColumnFiltersChange?: (updater: Updater<ColumnFiltersState>) => void;
  onGlobalFilterChange?: (value: string) => void;
  pageSizeOptions?: number[];
  rowCount?: number;
  pageCount?: number;
  isLoading?: boolean;
};

export type DataGridTransaction<T extends GridRow> = {
  add?: T[];
  remove?: T[];
  update?: T[];
};

export type DataGridTransactionResult<T extends GridRow> = {
  add: T[];
  remove: T[];
  update: T[];
};

export type DataGridApi<T extends GridRow> = {
  applyTransaction: (
    transaction: DataGridTransaction<T>,
  ) => DataGridTransactionResult<T>;
  clearSelectedRows: () => void;
  getSelectedRowIds: () => string[];
  getSelectedRows: () => T[];
  setGlobalFilter: (value: string) => void;
  setColumnsVisible: (
    keys: Array<string | Column<T, unknown>>,
    visible: boolean,
  ) => void;
};

export type DataGridRef<T extends GridRow> = {
  api: DataGridApi<T>;
};

export type DataGridProps<T extends GridRow> = DataGridFeatureFlags &
  DataGridServerPaginationProps & {
    columns: ColumnDef<T>[];
    data: T[];
    width?: CSSProperties["width"];
    contentHeight?: CSSProperties["height"];
    emptyMessage?: string;
    getRowId?: (row: T) => string | number;
    onDataSourceChange?: (rows: T[]) => void;
    onRowClick?: (row: T) => void;
    onRowDoubleClick?: (row: T) => void;
  };
