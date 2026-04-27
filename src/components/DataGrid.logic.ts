import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  DataGridCellRenderParams,
  DataGridApi,
  DataGridPaginationModel,
  DataGridProps,
  DataGridTransaction,
  DataGridTransactionResult,
  GridRow,
} from "./DataGrid.types";

const VIETNAMESE_COLLATOR = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

const compareCellValues = (left: unknown, right: unknown): number => {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return -1;
  }
  if (right == null) {
    return 1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return VIETNAMESE_COLLATOR.compare(String(left), String(right));
};

const formatCellValue = (
  value: unknown,
  valueFormatter?: string | ((value: unknown) => string),
) => {
  if (typeof valueFormatter === "function") {
    return valueFormatter(value);
  }
  if (typeof valueFormatter === "string") {
    return valueFormatter;
  }
  return String(value ?? "");
};

const getValueByFieldPath = (row: GridRow, fieldPath: string): unknown => {
  if (!fieldPath) {
    return undefined;
  }

  if (Object.hasOwn(row, fieldPath)) {
    return row[fieldPath];
  }

  return fieldPath
    .split(".")
    .reduce<unknown>((currentValue, segment) => {
      if (currentValue === null || currentValue === undefined) {
        return undefined;
      }
      if (typeof currentValue !== "object") {
        return undefined;
      }
      return (currentValue as Record<string, unknown>)[segment];
    }, row);
};

const resolveCellExtraProps = <T extends GridRow>(
  cellProps:
    | Record<string, unknown>
    | ((params: DataGridCellRenderParams<T>) => Record<string, unknown>)
    | undefined,
  params: DataGridCellRenderParams<T>,
) => {
  if (!cellProps) {
    return {};
  }
  if (typeof cellProps === "function") {
    return cellProps(params);
  }
  return cellProps;
};

const resolveColumnId = <T extends GridRow>(
  column: ColumnDef<T>,
  index: number,
) => {
  if ("field" in column && column.field) {
    return String(column.field);
  }
  return `__checkbox_${index}`;
};

const createTanStackColumns = <T extends GridRow>(
  columns: ColumnDef<T>[],
  wrapText: boolean,
  options: {
    isRowSelected: (row: T) => boolean;
    toggleRowSelected: (row: T, checked: boolean) => void;
  },
): TanStackColumnDef<T>[] => {
  return columns.map((column, index) => {
    const columnId = resolveColumnId(column, index);

    if (column.cell === "checkBox") {
      return {
        id: columnId,
        header: column.headerName ?? "",
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
          enableSummary: column.enableSummary ?? false,
          hasCheckbox: true,
          wrapText: wrapText || (column.wrapText ?? false),
        },
      } satisfies TanStackColumnDef<T>;
    }

    return {
      id: columnId,
      accessorFn: (row) => getValueByFieldPath(row, String(column.field)),
      header: column.headerName,
      cell: ({ row }) => {
        const value = getValueByFieldPath(row.original, String(column.field));
        const cellParams: DataGridCellRenderParams<T> = {
          row: row.original,
          value,
          field: String(column.field),
          rowIndex: row.index,
        };

        if (column.renderCell) {
          return column.renderCell(cellParams);
        }

        if (column.cellComponent) {
          const CellComponent = column.cellComponent;
          const extraProps = resolveCellExtraProps(column.cellProps, cellParams);

          return createElement(CellComponent, {
            ...extraProps,
            ...cellParams,
          });
        }

        if (column.cell) {
          return column.cell(row.original);
        }
        return formatCellValue(value, column.valueFormatter);
      },
      enableSorting: column.sortable ?? false,
      sortingFn: (rowA, rowB, colId) =>
        compareCellValues(rowA.getValue(colId), rowB.getValue(colId)),
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
        enableSummary: column.enableSummary ?? false,
        filterOptions: column.options,
        filterType: column.filterType,
        hasCheckbox: false,
        wrapText: wrapText || (column.wrapText ?? false),
      },
    } satisfies TanStackColumnDef<T>;
  });
};

type DataSummaryColumn<T extends GridRow> = Exclude<
  ColumnDef<T>,
  { cell: "checkBox" }
>;

const getInitialColumnPinning = <T extends GridRow>(
  columns: ColumnDef<T>[],
): ColumnPinningState => {
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
};

const getInitialColumnVisibility = <T extends GridRow>(
  columns: ColumnDef<T>[],
): VisibilityState => {
  return Object.fromEntries(
    columns.map((column, index) => [
      resolveColumnId(column, index),
      !column.hide,
    ]),
  );
};

export const useDataGridController = <T extends GridRow>({
  columns,
  data,
  enableGlobalFilter = false,
  enableColumnFilters = false,
  enableColumnVisibility = true,
  enablePinning = false,
  enableResize = false,
  enableSort = false,
  enablePagination = true,
  showSummary = false,
  wrapText = false,
  serverSide = false,
  pagination,
  sorting,
  columnFilters,
  globalFilter: controlledGlobalFilter,
  defaultPagination,
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  onGlobalFilterChange,
  pageSizeOptions = [5, 10, 20, 50],
  getRowId,
  onDataSourceChange,
}: DataGridProps<T>) => {
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => getInitialColumnVisibility(columns),
  );
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() =>
    getInitialColumnPinning(columns),
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [localRows, setLocalRows] = useState<T[]>(data);
  const [internalPagination, setInternalPagination] =
    useState<DataGridPaginationModel>(
      defaultPagination ?? {
        pageIndex: 0,
        pageSize: pageSizeOptions[0] ?? 10,
        pageSizeOptions,
      },
    );

  const resolveRowId = useCallback(
    (row: T) => String(getRowId ? getRowId(row) : row.id),
    [getRowId],
  );
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

  useEffect(() => {
    setColumnVisibility(getInitialColumnVisibility(columns));
    setColumnPinning(getInitialColumnPinning(columns));
  }, [columns]);

  const tanStackColumns = useMemo(
    () =>
      createTanStackColumns(columns, wrapText, {
        isRowSelected,
        toggleRowSelected,
      }),
    [columns, rowSelection, wrapText],
  );
  const paginationModel = pagination ?? internalPagination;
  const paginationState: PaginationState = {
    pageIndex: paginationModel.pageIndex,
    pageSize: paginationModel.pageSize,
  };
  const sortingState = sorting ?? internalSorting;
  const columnFiltersState = columnFilters ?? internalColumnFilters;
  const globalFilterState = controlledGlobalFilter ?? internalGlobalFilter;
  const resolvedPageSizeOptions =
    paginationModel.pageSizeOptions ?? pageSizeOptions;
  const resolvedServerRowCount = paginationModel.totalRows;
  const resolvedServerPageCount = paginationModel.pageCount;
  const resolvedServerSummary = paginationModel.summary;

  const handlePaginationChange = (
    updater:
      | DataGridPaginationModel
      | ((old: DataGridPaginationModel) => DataGridPaginationModel),
  ) => {
    const nextUpdater = typeof updater === "function" ? updater : () => updater;

    if (pagination === undefined) {
      setInternalPagination(updater);
    }
    onPaginationChange?.((current) => {
      const base = current ?? {
        pageIndex: 0,
        pageSize: resolvedPageSizeOptions[0] ?? 10,
        pageSizeOptions: resolvedPageSizeOptions,
        totalRows: resolvedServerRowCount,
        pageCount: resolvedServerPageCount,
      };
      const next = nextUpdater(base);

      return {
        ...base,
        ...next,
        pageSizeOptions: next.pageSizeOptions ?? base.pageSizeOptions,
        totalRows: next.totalRows ?? base.totalRows,
        pageCount: next.pageCount ?? base.pageCount,
      };
    });
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
    manualFiltering: serverSide,
    manualPagination: serverSide,
    manualSorting: serverSide,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel:
      !serverSide && (enableGlobalFilter || enableColumnFilters)
        ? getFilteredRowModel()
        : undefined,
    getPaginationRowModel:
      !serverSide && enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel:
      !serverSide && enableSort ? getSortedRowModel() : undefined,
    getRowId: (row) => String(getRowId ? getRowId(row) : row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      Object.values(row.original).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(String(filterValue ?? "").toLowerCase()),
      ),
    rowCount: resolvedServerRowCount,
    pageCount: resolvedServerPageCount,
    columnResizeMode: "onChange",
    autoResetPageIndex: false,
  });

  const localRowsRef = useRef(localRows);
  const tableRef = useRef(table);
  const onDataSourceChangeRef = useRef(onDataSourceChange);

  useEffect(() => {
    localRowsRef.current = localRows;
  }, [localRows]);

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    onDataSourceChangeRef.current = onDataSourceChange;
  }, [onDataSourceChange]);

  const applyTransaction = useCallback((
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

    const currentRows = localRowsRef.current;

    let nextRows = currentRows.filter((row) => {
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

    localRowsRef.current = nextRows;
    setLocalRows(nextRows);
    onDataSourceChangeRef.current?.(nextRows);

    return {
      add: addItems,
      remove: removedRows,
      update: updatedRows,
    };
  }, [resolveRowId]);

  const rows = table.getRowModel().rows;
  const resolvedRowCount = serverSide
    ? (resolvedServerRowCount ?? localRows.length)
    : table.getFilteredRowModel().rows.length;
  const resolvedPageCount = serverSide
    ? (resolvedServerPageCount ?? table.getPageCount())
    : table.getPageCount();
  const canPaginate = enablePagination && table.getPageCount() > 0;
  const summaryColumns = useMemo(
    () =>
      columns
        .map((column, index) =>
          column.cell === "checkBox"
            ? null
            : {
                column: column as DataSummaryColumn<T>,
                index,
              },
        )
        .filter(
          (item): item is { column: DataSummaryColumn<T>; index: number } =>
            !!item && !!item.column.enableSummary,
        ),
    [columns],
  );

  const summaryByColumnId = useMemo(() => {
    if (!showSummary) {
      return undefined;
    }

    if (serverSide) {
      if (!resolvedServerSummary) {
        return undefined;
      }

      const mappedSummary = Object.fromEntries(
        summaryColumns.map(({ column, index }) => [
          resolveColumnId(column, index),
          resolvedServerSummary[resolveColumnId(column, index)],
        ]),
      );

      return mappedSummary;
    }

    const summary: Record<string, number> = {};

    summaryColumns.forEach(({ column, index }) => {
      const columnId = resolveColumnId(column, index);
      let hasNumericValue = false;
      let total = 0;
      const fieldId = column.field;

      localRows.forEach((row) => {
        const value = getValueByFieldPath(row, String(fieldId));
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return;
        }

        hasNumericValue = true;
        total += value;
      });

      if (hasNumericValue) {
        summary[columnId] = total;
      }
    });

    return summary;
  }, [
    localRows,
    resolvedServerSummary,
    serverSide,
    showSummary,
    summaryColumns,
  ]);

  const api = useMemo<DataGridApi<T>>(() => ({
    applyTransaction,
    clearSelectedRows: () => {
      tableRef.current.toggleAllRowsSelected(false);
    },
    getSelectedRowIds: () =>
      Object.entries(tableRef.current.getState().rowSelection)
        .filter(([, isSelected]) => Boolean(isSelected))
        .map(([rowId]) => rowId),
    getSelectedRows: () =>
      tableRef.current.getSelectedRowModel().flatRows.map((row) => row.original),
    setGlobalFilter: (value: string) => {
      tableRef.current.setGlobalFilter(value);
    },
    setColumnsVisible: (keys, visible) => {
      keys.forEach((key) => {
        const column =
          typeof key === "string"
            ? tableRef.current.getColumn(key)
            : tableRef.current.getColumn(key.id);

        if (!column || !column.getCanHide()) {
          return;
        }

        column.toggleVisibility(visible);
      });
    },
  }), [applyTransaction]);

  return {
    api,
    canPaginate,
    paginationModel: {
      ...paginationModel,
      pageIndex: paginationState.pageIndex,
      pageSize: paginationState.pageSize,
      pageSizeOptions: resolvedPageSizeOptions,
      totalRows: resolvedRowCount,
      pageCount: resolvedPageCount,
    },
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
    summaryByColumnId,
    table,
    toggleRowSelected,
  };
};
