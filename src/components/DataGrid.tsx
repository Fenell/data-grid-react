import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  ChangeEvent,
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import type {
  Column,
  ColumnDef as TanStackColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  PaginationState,
  RowData as TanStackRowData,
  RowSelectionState,
  SortingState,
  Table,
  Updater,
  VisibilityState,
} from "@tanstack/react-table";

import styles from "./DataGrid.module.css";

const cx = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(" ");

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

export type DataGridServerPaginationProps = {
  manualPagination?: boolean;
  manualSorting?: boolean;
  manualFiltering?: boolean;
  pagination?: PaginationState;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  globalFilter?: string;
  defaultPagination?: PaginationState;
  onPaginationChange?: (updater: Updater<PaginationState>) => void;
  onSortingChange?: (updater: Updater<SortingState>) => void;
  onColumnFiltersChange?: (updater: Updater<ColumnFiltersState>) => void;
  onGlobalFilterChange?: (value: string) => void;
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
    pageSizeOptions?: number[];
    emptyMessage?: string;
    getRowId?: (row: T) => string | number;
    onDataSourceChange?: (rows: T[]) => void;
    onRowClick?: (row: T) => void;
    onRowDoubleClick?: (row: T) => void;
  };

function resolveColumnId<T extends GridRow>(
  column: ColumnDef<T>,
  index: number,
) {
  if ("id" in column && column.id) {
    return String(column.id);
  }
  return `__checkbox_${index}`;
}

function createTanStackColumns<T extends GridRow>(
  columns: ColumnDef<T>[],
  options: {
    isRowSelected: (row: T) => boolean;
    toggleRowSelected: (row: T, checked: boolean) => void;
  },
): TanStackColumnDef<T>[] {
  return columns.map((column, index) => {
    const columnId = resolveColumnId(column, index);

    if (column.cell === "checkBox") {
      return {
        id: columnId,
        header: column.label ?? "Chọn",
        cell: ({ row }) =>
          createElement("input", {
            "aria-label": `Select row ${row.id}`,
            className: "grid-checkbox-input",
            checked: options.isRowSelected(row.original),
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              options.toggleRowSelected(
                row.original,
                event.currentTarget.checked,
              );
            },
            onDoubleClick: (event: MouseEvent<HTMLInputElement>) =>
              event.stopPropagation(),
            onClick: (event: MouseEvent<HTMLInputElement>) =>
              event.stopPropagation(),
            onMouseDown: (event: MouseEvent<HTMLInputElement>) =>
              event.stopPropagation(),
            onPointerDown: (event: PointerEvent<HTMLInputElement>) =>
              event.stopPropagation(),
            type: "checkbox",
          }),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: column.enableHiding ?? false,
        enablePinning: column.enablePinning ?? true,
        enableResizing: column.enableResizing ?? true,
        size: column.width ?? 52,
        minSize: column.minWidth ?? 44,
        maxSize: column.maxWidth,
        meta: {
          align: column.align ?? "center",
          hasCheckbox: true,
        },
      } satisfies TanStackColumnDef<T>;
    }

    return {
      id: columnId,
      accessorFn: (row) => row[column.id],
      header: column.label,
      cell: ({ row }) => {
        if (column.cell) {
          return column.cell(row.original);
        }
        const value = row.original[column.id];
        return String(value ?? "");
      },
      enableSorting: column.sortable ?? false,
      enableColumnFilter: column.filterable ?? false,
      enableHiding: column.enableHiding ?? true,
      enablePinning: column.enablePinning ?? true,
      enableResizing: column.enableResizing ?? true,
      size: column.width,
      minSize: column.minWidth ?? 90,
      maxSize: column.maxWidth,
      filterFn:
        column.filterType === "select"
          ? (row, colId, filterValue) => {
              if (!filterValue) {
                return true;
              }
              return String(row.getValue(colId)) === String(filterValue);
            }
          : (row, colId, filterValue) => {
              if (!filterValue) {
                return true;
              }
              return String(row.getValue(colId))
                .toLowerCase()
                .includes(String(filterValue).toLowerCase());
            },
      meta: {
        align: column.align,
        filterOptions: column.options,
        filterType: column.filterType,
        hasCheckbox: false,
      },
    } satisfies TanStackColumnDef<T>;
  });
}

function getInitialColumnPinning<T extends GridRow>(
  columns: ColumnDef<T>[],
): ColumnPinningState {
  const columnList = columns;
  return {
    left: columnList
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.pinned === "left")
      .map(({ column, index }) => resolveColumnId(column, index)),
    right: columnList
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.pinned === "right")
      .map(({ column, index }) => resolveColumnId(column, index)),
  };
}

function getInitialColumnVisibility<T extends GridRow>(
  columns: ColumnDef<T>[],
): VisibilityState {
  return Object.fromEntries(
    columns.map((column, index) => [
      resolveColumnId(column, index),
      !column.hide,
    ]),
  );
}

function getAlignClassName(align: ColumnAlign | undefined) {
  if (align === "center") {
    return styles.alignCenter;
  }
  if (align === "right") {
    return styles.alignRight;
  }
  return styles.alignLeft;
}

function getPinnedColumnStyles<T extends GridRow>(
  column: Column<T>,
  isHeader = false,
): CSSProperties {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return {};
  }
  return {
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: "sticky",
    zIndex: isHeader ? 4 : 1,
  };
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (!direction) {
    return null;
  }
  return (
    <span
      className={cx(styles.sortIcon, styles.sortIconActive)}
      aria-hidden="true"
    >
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

function DataGridTable<T extends GridRow>({
  contentHeight,
  emptyMessage,
  enableColumnFilters,
  enableResize,
  isLoading,
  onRowClick,
  onRowDoubleClick,
  rowSelection,
  rows,
  sorting,
  table,
  toggleRowSelected,
}: {
  contentHeight?: CSSProperties["height"];
  emptyMessage: string;
  enableColumnFilters: boolean;
  enableResize: boolean;
  isLoading: boolean;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  rowSelection: RowSelectionState;
  rows: ReturnType<Table<T>["getRowModel"]>["rows"];
  sorting: SortingState;
  table: Table<T>;
  toggleRowSelected: (row: T, checked: boolean) => void;
}) {
  const headers = table.getHeaderGroups();
  const leafHeaders = table.getLeafHeaders();
  const visiblePageRowIds = rows.map((row) => row.id);
  const isAllPageRowsSelected =
    visiblePageRowIds.length > 0 &&
    visiblePageRowIds.every((rowId) => Boolean(rowSelection[String(rowId)]));

  return (
    <div
      className={styles.scroll}
      style={
        contentHeight
          ? {
              height: contentHeight,
              overflowY: "auto",
            }
          : undefined
      }
    >
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>Đang tải...</div>
        </div>
      )}

      <table className={styles.table} style={{ width: table.getTotalSize() }}>
        <thead>
          {headers.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const alignClassName = getAlignClassName(
                  header.column.columnDef.meta?.align,
                );
                const pinnedStyles = getPinnedColumnStyles(header.column, true);
                const hasCheckbox = header.column.columnDef.meta?.hasCheckbox;
                const canSort = header.column.getCanSort();
                const activeSort = sorting.find(
                  (item) => String(item.id) === String(header.column.id),
                );
                const sortedFromColumn = header.column.getIsSorted();
                const sortingDirection: false | "asc" | "desc" = activeSort
                  ? activeSort.desc
                    ? "desc"
                    : "asc"
                  : sortedFromColumn === "asc" || sortedFromColumn === "desc"
                    ? sortedFromColumn
                    : false;

                const handleSortClick = (event: MouseEvent<HTMLDivElement>) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "[data-grid-resize-handle='true']",
                    )
                  ) {
                    return;
                  }
                  if (!canSort) {
                    return;
                  }
                  const nextOrder = header.column.getNextSortingOrder();
                  if (!nextOrder) {
                    header.column.clearSorting();
                    return;
                  }
                  header.column.toggleSorting(nextOrder === "desc", false);
                };

                return (
                  <th
                    key={header.id}
                    className={cx(
                      styles.th,
                      alignClassName,
                      header.column.getIsPinned() && styles.thPinned,
                      header.column.getIsPinned() === "left" &&
                        styles.pinnedLeft,
                      header.column.getIsPinned() === "right" &&
                        styles.pinnedRight,
                      canSort && styles.thSortable,
                    )}
                    style={{
                      ...pinnedStyles,
                      width: header.getSize(),
                      minWidth: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          className={cx(
                            styles.headerClickTarget,
                            canSort && styles.headerClickTargetSortable,
                          )}
                          onClick={handleSortClick}
                        >
                          <span
                            className={cx(styles.headerContent, alignClassName)}
                          >
                            {hasCheckbox && (
                              <input
                                aria-label="Select all rows"
                                className={styles.checkboxInput}
                                checked={isAllPageRowsSelected}
                                onChange={(event) => {
                                  const checked = event.currentTarget.checked;
                                  rows.forEach((row) => {
                                    toggleRowSelected(row.original, checked);
                                  });
                                }}
                                onDoubleClick={(event) =>
                                  event.stopPropagation()
                                }
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) =>
                                  event.stopPropagation()
                                }
                                type="checkbox"
                              />
                            )}
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <SortIcon direction={sortingDirection} />
                          </span>
                        </div>
                        {enableResize && header.column.getCanResize() && (
                          <div
                            data-grid-resize-handle="true"
                            className={cx(
                              styles.resizeHandle,
                              header.column.getIsPinned() === "left" &&
                                styles.resizeHandlePinnedLeft,
                              header.column.getIsPinned() === "right" &&
                                styles.resizeHandlePinnedRight,
                            )}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              header.column.resetSize();
                            }}
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              header.getResizeHandler()(event);
                            }}
                            onTouchStart={(event) => {
                              event.stopPropagation();
                              header.getResizeHandler()(event);
                            }}
                          />
                        )}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}

          {enableColumnFilters && (
            <tr>
              {leafHeaders.map((header) => {
                const alignClassName = getAlignClassName(
                  header.column.columnDef.meta?.align,
                );
                const pinnedStyles = getPinnedColumnStyles(header.column, true);
                const filterType = header.column.columnDef.meta?.filterType;
                const filterOptions =
                  header.column.columnDef.meta?.filterOptions ?? [];
                const filterValue = (header.column.getFilterValue() ??
                  "") as string;

                return (
                  <th
                    key={`${header.id}-filter`}
                    className={cx(
                      styles.filterTh,
                      alignClassName,
                      header.column.getIsPinned() && styles.filterThPinned,
                      header.column.getIsPinned() === "left" &&
                        styles.pinnedLeft,
                      header.column.getIsPinned() === "right" &&
                        styles.pinnedRight,
                    )}
                    style={{
                      ...pinnedStyles,
                      width: header.getSize(),
                      minWidth: header.getSize(),
                    }}
                  >
                    {header.column.getCanFilter() ? (
                      filterType === "select" ? (
                        <select
                          className={styles.filterInput}
                          value={filterValue}
                          onChange={(event) =>
                            header.column.setFilterValue(event.target.value)
                          }
                        >
                          {filterOptions.map((option) => (
                            <option key={option} value={option}>
                              {option || "Tất cả"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={styles.filterInput}
                          type="text"
                          placeholder="Lọc..."
                          value={filterValue}
                          onChange={(event) =>
                            header.column.setFilterValue(event.target.value)
                          }
                        />
                      )
                    ) : null}
                  </th>
                );
              })}
            </tr>
          )}
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className={cx(styles.td, styles.emptyState)}
                colSpan={leafHeaders.length}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={cx(
                  rowSelection[String(row.id)] && styles.rowSelected,
                )}
                onClick={() => onRowClick?.(row.original)}
                onDoubleClick={() => onRowDoubleClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const alignClassName = getAlignClassName(
                    cell.column.columnDef.meta?.align,
                  );
                  const pinnedStyles = getPinnedColumnStyles(cell.column);

                  return (
                    <td
                      key={cell.id}
                      className={cx(
                        styles.td,
                        alignClassName,
                        cell.column.getIsPinned() && styles.tdPinned,
                        cell.column.getIsPinned() === "left" &&
                          styles.pinnedLeft,
                        cell.column.getIsPinned() === "right" &&
                          styles.pinnedRight,
                      )}
                      style={{
                        ...pinnedStyles,
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function useDataGridController<T extends GridRow>({
  columns,
  data,
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableColumnVisibility = true,
  enablePinning = true,
  enableResize = true,
  enableSort = true,
  enablePagination = true,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  pagination,
  sorting,
  columnFilters,
  globalFilter: controlledGlobalFilter,
  defaultPagination,
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  onGlobalFilterChange,
  rowCount,
  pageCount,
  pageSizeOptions = [5, 10, 20, 50],
  getRowId,
  onDataSourceChange,
}: DataGridProps<T>) {
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => getInitialColumnVisibility(columns),
  );
  const [columnPinning] = useState<ColumnPinningState>(() =>
    getInitialColumnPinning(columns),
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [localRows, setLocalRows] = useState<T[]>(data);
  const [internalPagination, setInternalPagination] = useState<PaginationState>(
    defaultPagination ?? { pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 },
  );

  const resolveRowId = (row: T) => String(getRowId ? getRowId(row) : row.id);
  const isRowSelected = (row: T) => Boolean(rowSelection[resolveRowId(row)]);
  const toggleRowSelected = (row: T, checked: boolean) => {
    const rowId = resolveRowId(row);
    setRowSelection((current) => {
      if (checked) {
        return {
          ...current,
          [rowId]: true,
        };
      }

      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  useEffect(() => {
    setLocalRows(data);
  }, [data]);

  const tanStackColumns = useMemo(
    () =>
      createTanStackColumns(columns, {
        isRowSelected,
        toggleRowSelected,
      }),
    [columns, rowSelection],
  );
  const paginationState = pagination ?? internalPagination;
  const sortingState = sorting ?? internalSorting;
  const columnFiltersState = columnFilters ?? internalColumnFilters;
  const globalFilterState = controlledGlobalFilter ?? internalGlobalFilter;

  const handlePaginationChange = (
    updater: PaginationState | ((old: PaginationState) => PaginationState),
  ) => {
    if (!pagination) {
      setInternalPagination(updater);
    }
    onPaginationChange?.(updater);
  };

  const handleSortingChange = (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => {
    if (!sorting) {
      setInternalSorting(updater);
    }
    onSortingChange?.(updater);
  };

  const handleColumnFiltersChange = (
    updater:
      | ColumnFiltersState
      | ((old: ColumnFiltersState) => ColumnFiltersState),
  ) => {
    if (!columnFilters) {
      setInternalColumnFilters(updater);
    }
    onColumnFiltersChange?.(updater);
  };

  const handleGlobalFilterChange = (value: string) => {
    if (controlledGlobalFilter === undefined) {
      setInternalGlobalFilter(value);
    }
    onGlobalFilterChange?.(value);
  };

  const table = useReactTable({
    columns: tanStackColumns,
    data: localRows,
    state: {
      columnFilters: columnFiltersState,
      columnPinning,
      columnVisibility,
      globalFilter: globalFilterState,
      pagination: paginationState,
      rowSelection,
      sorting: sortingState,
    },
    defaultColumn: {
      minSize: 90,
      size: 160,
    },
    enableColumnFilters,
    enableColumnPinning: enablePinning,
    enableColumnResizing: enableResize,
    enableGlobalFilter,
    enableHiding: enableColumnVisibility,
    enableRowSelection: columns.some((column) => column.cell === "checkBox"),
    enableSorting: enableSort,
    manualFiltering,
    manualPagination,
    manualSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel:
      !manualFiltering && (enableGlobalFilter || enableColumnFilters)
        ? getFilteredRowModel()
        : undefined,
    getPaginationRowModel:
      !manualPagination && enablePagination
        ? getPaginationRowModel()
        : undefined,
    getSortedRowModel:
      !manualSorting && enableSort ? getSortedRowModel() : undefined,
    getRowId: (row) => String(getRowId ? getRowId(row) : row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      Object.values(row.original).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(String(filterValue ?? "").toLowerCase()),
      ),
    rowCount,
    pageCount,
    columnResizeMode: "onChange",
    autoResetPageIndex: false,
  });

  const applyTransaction = (
    transaction: DataGridTransaction<T>,
  ): DataGridTransactionResult<T> => {
    const addItems = transaction.add ?? [];
    const updateItems = transaction.update ?? [];
    const removeItems = transaction.remove ?? [];

    const removeIdSet = new Set(removeItems.map((item) => resolveRowId(item)));
    const updateMap = new Map(
      updateItems.map((item) => [resolveRowId(item), item]),
    );

    const removedRows: T[] = [];
    const updatedRows: T[] = [];

    let nextRows = localRows.filter((row) => {
      const rowId = resolveRowId(row);
      if (removeIdSet.has(rowId)) {
        removedRows.push(row);
        return false;
      }
      return true;
    });

    nextRows = nextRows.map((row) => {
      const rowId = resolveRowId(row);
      const updated = updateMap.get(rowId);
      if (!updated) {
        return row;
      }
      updatedRows.push(updated);
      return updated;
    });

    if (addItems.length > 0) {
      nextRows = [...nextRows, ...addItems];
    }

    setLocalRows(nextRows);
    onDataSourceChange?.(nextRows);

    return {
      add: addItems,
      remove: removedRows,
      update: updatedRows,
    };
  };

  const rows = table.getRowModel().rows;
  const resolvedRowCount = manualPagination
    ? (rowCount ?? localRows.length)
    : table.getFilteredRowModel().rows.length;
  const canPaginate = enablePagination && table.getPageCount() > 0;

  const api: DataGridApi<T> = {
    applyTransaction,
    clearSelectedRows: () => {
      table.toggleAllRowsSelected(false);
    },
    getSelectedRowIds: () =>
      Object.entries(table.getState().rowSelection)
        .filter(([, isSelected]) => Boolean(isSelected))
        .map(([rowId]) => rowId),
    getSelectedRows: () =>
      table.getSelectedRowModel().flatRows.map((row) => row.original),
    setGlobalFilter: (value: string) => {
      table.setGlobalFilter(value);
    },
  };

  return {
    api,
    canPaginate,
    colMenuOpen,
    columnVisibility,
    globalFilterState,
    paginationState,
    resolvedRowCount,
    rowSelection,
    rows,
    setColMenuOpen,
    setColumnVisibility,
    setPageIndex: (pageIndex: number) =>
      handlePaginationChange((current) => ({
        ...current,
        pageIndex,
      })),
    setPageSize: (pageSize: number) =>
      handlePaginationChange((current) => ({
        ...current,
        pageIndex: 0,
        pageSize,
      })),
    sortingState,
    table,
    toggleRowSelected,
  };
}

function DataGridInner<T extends GridRow>(
  props: DataGridProps<T>,
  ref: Ref<DataGridRef<T>>,
) {
  const {
    api,
    canPaginate,
    colMenuOpen,
    columnVisibility,
    globalFilterState,
    paginationState,
    resolvedRowCount,
    rowSelection,
    rows,
    setColMenuOpen,
    setColumnVisibility,
    setPageIndex,
    setPageSize,
    sortingState,
    table,
    toggleRowSelected,
  } = useDataGridController(props);

  useImperativeHandle(
    ref,
    () => ({
      api,
    }),
    [api],
  );

  return (
    <div className={styles.wrap} style={{ width: props.width ?? "100%" }}>
      <div className={styles.toolbar}>
        {(props.enableGlobalFilter ?? true) && (
          <input
            className={styles.input}
            placeholder="Tìm kiếm toàn bộ..."
            value={globalFilterState}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        )}

        {(props.enableColumnVisibility ?? true) && (
          <div className={styles.colMenuWrap}>
            <button
              className={styles.button}
              onClick={() => setColMenuOpen((current) => !current)}
              type="button"
            >
              Hiện/ẩn cột ▾
            </button>
            {colMenuOpen && (
              <div
                className={styles.colMenu}
                onMouseLeave={() => setColMenuOpen(false)}
              >
                {table.getAllLeafColumns().map((column) => (
                  <label key={column.id} className={styles.colLabel}>
                    <input
                      type="checkbox"
                      checked={columnVisibility[column.id] ?? true}
                      disabled={!column.getCanHide()}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setColumnVisibility((current) => ({
                          ...current,
                          [column.id]: checked,
                        }));
                      }}
                    />
                    {String(column.columnDef.header)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <span className={styles.recordCount}>{resolvedRowCount} bản ghi</span>
      </div>

      <DataGridTable
        contentHeight={props.contentHeight}
        emptyMessage={props.emptyMessage ?? "Không có dữ liệu phù hợp"}
        enableColumnFilters={props.enableColumnFilters ?? true}
        enableResize={props.enableResize ?? true}
        isLoading={props.isLoading ?? false}
        onRowClick={props.onRowClick}
        onRowDoubleClick={props.onRowDoubleClick}
        rowSelection={rowSelection}
        rows={rows}
        sorting={sortingState}
        table={table}
        toggleRowSelected={toggleRowSelected}
      />

      {(props.enablePagination ?? true) && canPaginate && (
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            disabled={paginationState.pageIndex <= 0}
            onClick={() => setPageIndex(0)}
            type="button"
          >
            «
          </button>
          <button
            className={styles.pageButton}
            disabled={paginationState.pageIndex <= 0}
            onClick={() =>
              setPageIndex(Math.max(paginationState.pageIndex - 1, 0))
            }
            type="button"
          >
            ‹
          </button>

          <span className={styles.pageIndicator}>
            Trang {paginationState.pageIndex + 1} /{" "}
            {Math.max(table.getPageCount(), 1)}
          </span>

          <button
            className={styles.pageButton}
            disabled={
              paginationState.pageIndex >= Math.max(table.getPageCount() - 1, 0)
            }
            onClick={() =>
              setPageIndex(
                Math.min(
                  paginationState.pageIndex + 1,
                  Math.max(table.getPageCount() - 1, 0),
                ),
              )
            }
            type="button"
          >
            ›
          </button>
          <button
            className={styles.pageButton}
            disabled={
              paginationState.pageIndex >= Math.max(table.getPageCount() - 1, 0)
            }
            onClick={() => setPageIndex(Math.max(table.getPageCount() - 1, 0))}
            type="button"
          >
            »
          </button>

          <select
            className={styles.pageSelect}
            value={paginationState.pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {(props.pageSizeOptions ?? [5, 10, 20, 50]).map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>

          <span className={styles.pageInfo}>
            {resolvedRowCount === 0
              ? "0 / 0"
              : `${paginationState.pageIndex * paginationState.pageSize + 1}–${Math.min(
                  (paginationState.pageIndex + 1) * paginationState.pageSize,
                  resolvedRowCount,
                )} / ${resolvedRowCount}`}
          </span>
        </div>
      )}
    </div>
  );
}

const DataGrid = forwardRef(DataGridInner) as <T extends GridRow>(
  props: DataGridProps<T> & { ref?: Ref<DataGridRef<T>> },
) => ReactElement;

export default DataGrid;
