import { createElement, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, MouseEvent, PointerEvent } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef as TanStackColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import type {
  ColumnDef,
  DataGridApi,
  DataGridProps,
  DataGridTransaction,
  DataGridTransactionResult,
  GridRow,
} from "./DataGrid.types";

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
  return {
    left: columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.pinned === "left")
      .map(({ column, index }) => resolveColumnId(column, index)),
    right: columns
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

export function useDataGridController<T extends GridRow>({
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
    setColumnsVisible: (keys, visible) => {
      keys.forEach((key) => {
        const column =
          typeof key === "string" ? table.getColumn(key) : table.getColumn(key.id);

        if (!column || !column.getCanHide()) {
          return;
        }

        column.toggleVisibility(visible);
      });
    },
  };

  return {
    api,
    canPaginate,
    paginationState,
    resolvedRowCount,
    rowSelection,
    rows,
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
