import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CSSProperties, MouseEvent, ReactElement, Ref } from "react";
import { flexRender } from "@tanstack/react-table";
import type {
  Column,
  RowSelectionState,
  SortingState,
  Table,
} from "@tanstack/react-table";

import styles from "./DataGrid.module.css";
import { useDataGridController } from "./DataGrid.logic";
import type {
  ColumnAlign,
  DataGridProps,
  DataGridRef,
  GridRow,
} from "./DataGrid.types";
import Spinner from "./Spinner/Spinner";

const cx = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(" ");

function getAlignClassName(align: ColumnAlign | undefined) {
  if (align === "center") {
    return styles.alignCenter;
  }
  if (align === "right") {
    return styles.alignRight;
  }
  return styles.alignLeft;
}

const getPinnedColumnStyles = <T extends GridRow>(
  column: Column<T>,
  isHeader = false,
): CSSProperties => {
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
};

const SortIcon = ({ direction }: { direction: false | "asc" | "desc" }) => {
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
};

const DataGridTable = <T extends GridRow>({
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
}) => {
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
      <div className={styles.scrollContent}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            {/* <div className={styles.loadingCard}>Đang tải...</div> */}
            <div className={styles.loadingCard}>
              <Spinner />
            </div>
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
                  const pinnedStyles = getPinnedColumnStyles(
                    header.column,
                    true,
                  );
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

                  const handleSortClick = (
                    event: MouseEvent<HTMLDivElement>,
                  ) => {
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
                              className={cx(
                                styles.headerContent,
                                alignClassName,
                              )}
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
                                  onMouseDown={(event) =>
                                    event.stopPropagation()
                                  }
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
                  const pinnedStyles = getPinnedColumnStyles(
                    header.column,
                    true,
                  );
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
    </div>
  );
};

const DataGridInner = <T extends GridRow>(
  props: DataGridProps<T>,
  ref: Ref<DataGridRef<T>>,
) => {
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false);
  const pageSizeMenuRef = useRef<HTMLDivElement>(null);
  const {
    api,
    canPaginate,
    paginationState,
    resolvedRowCount,
    rowSelection,
    rows,
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

  useEffect(() => {
    if (!pageSizeMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        pageSizeMenuRef.current &&
        !pageSizeMenuRef.current.contains(event.target as Node)
      ) {
        setPageSizeMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pageSizeMenuOpen]);

  return (
    <div className={styles.wrap} style={{ width: props.width ?? "100%" }}>
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
          <div className={styles.pageSelectWrap} ref={pageSizeMenuRef}>
            {pageSizeMenuOpen && (
              <div className={styles.pageSelectMenu} role="listbox">
                {(props.pageSizeOptions ?? [5, 10, 20, 50]).map((size) => (
                  <div
                    key={size}
                    className={cx(
                      styles.pageSelectOption,
                      paginationState.pageSize === size &&
                        styles.pageSelectOptionActive,
                    )}
                    role="option"
                    aria-selected={paginationState.pageSize === size}
                    onClick={() => {
                      setPageSize(size);
                      setPageSizeMenuOpen(false);
                    }}
                  >
                    {size}
                  </div>
                ))}
              </div>
            )}

            <button
              className={cx(styles.pageSelect, styles.pageSelectTrigger)}
              onClick={() => setPageSizeMenuOpen((current) => !current)}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={pageSizeMenuOpen}
            >
              <span>{paginationState.pageSize}</span>
              <span
                className={cx(
                  styles.pageSelectChevron,
                  pageSizeMenuOpen && styles.pageSelectChevronOpen,
                )}
                aria-hidden="true"
              >
                <svg
                  className=" text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M18.425 10.271C19.499 8.967 18.57 7 16.88 7H7.12c-1.69 0-2.618 1.967-1.544 3.271l4.881 5.927a2 2 0 0 0 3.088 0l4.88-5.927Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </button>
          </div>

          <span className={styles.pageInfo}>
            {resolvedRowCount === 0
              ? "0-0 of 0"
              : `${paginationState.pageIndex * paginationState.pageSize + 1}-${Math.min(
                  (paginationState.pageIndex + 1) * paginationState.pageSize,
                  resolvedRowCount,
                )} of ${resolvedRowCount}`}
          </span>

          <div className={styles.paginationControls}>
            <div className={styles.pageButtonGroup}>
              <button
                className={styles.pageButton}
                disabled={paginationState.pageIndex <= 0}
                onClick={() => setPageIndex(0)}
                type="button"
              >
                <svg
                  className="text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="m17 16-4-4 4-4m-6 8-4-4 4-4"
                  />
                </svg>
              </button>
              <button
                className={styles.pageButton}
                disabled={paginationState.pageIndex <= 0}
                onClick={() =>
                  setPageIndex(Math.max(paginationState.pageIndex - 1, 0))
                }
                type="button"
              >
                <svg
                  className="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="m14 8-4 4 4 4"
                  />
                </svg>
              </button>
              <span className={styles.pageIndicator}>
                Trang {paginationState.pageIndex + 1} /{" "}
                {Math.max(table.getPageCount(), 1)}
              </span>
              <button
                className={styles.pageButton}
                disabled={
                  paginationState.pageIndex >=
                  Math.max(table.getPageCount() - 1, 0)
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
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="m10 16 4-4-4-4"
                  />
                </svg>
              </button>
              <button
                className={styles.pageButton}
                disabled={
                  paginationState.pageIndex >=
                  Math.max(table.getPageCount() - 1, 0)
                }
                onClick={() =>
                  setPageIndex(Math.max(table.getPageCount() - 1, 0))
                }
                type="button"
              >
                <svg
                  className="text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="m7 16 4-4-4-4m6 8 4-4-4-4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DataGrid = forwardRef(DataGridInner) as <T extends GridRow>(
  props: DataGridProps<T> & { ref?: Ref<DataGridRef<T>> },
) => ReactElement;

export default DataGrid;
