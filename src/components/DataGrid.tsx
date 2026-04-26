import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  SetStateAction,
} from "react";
import { createPortal } from "react-dom";
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
  offsets?: {
    left: Record<string, number>;
    right: Record<string, number>;
  },
  isHeader = false,
): CSSProperties => {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return {};
  }
  return {
    left:
      pinned === "left"
        ? `${offsets?.left[column.id] ?? column.getStart("left")}px`
        : undefined,
    right:
      pinned === "right"
        ? `${offsets?.right[column.id] ?? column.getAfter("right")}px`
        : undefined,
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
      {direction === "asc" ? (
        <svg
          className="w-6 h-6 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            d="M12 6v13m0-13 4 4m-4-4-4 4"
          />
        </svg>
      ) : (
        <svg
          className="w-6 h-6 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            d="M12 19V5m0 14-4-4m4 4 4-4"
          />
        </svg>
      )}
    </span>
  );
};

type TooltipState = {
  left: number;
  text: string;
  top: number;
  visible: boolean;
} | null;

const CellContent = ({
  children,
  showTooltip,
  setTooltipState,
  wrapText,
}: {
  children: ReactNode;
  showTooltip: boolean;
  setTooltipState: Dispatch<SetStateAction<TooltipState>>;
  wrapText: boolean;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tooltipText, setTooltipText] = useState("");

  useLayoutEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    const updateOverflowState = () => {
      const text = element.textContent?.trim() ?? "";
      const hasOverflow = wrapText
        ? element.scrollHeight > element.clientHeight
        : element.scrollWidth > element.clientWidth;

      setTooltipText(showTooltip && hasOverflow ? text : "");
    };

    updateOverflowState();

    const resizeObserver = new ResizeObserver(updateOverflowState);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [children, showTooltip, wrapText]);

  const handleMouseEnter = () => {
    const element = contentRef.current;

    if (!element || !tooltipText) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setTooltipState({
      left: rect.left + rect.width / 2,
      text: tooltipText,
      top: rect.top - 8,
      visible: true,
    });
  };

  const handleMouseLeave = () => {
    setTooltipState((current) =>
      current
        ? {
            ...current,
            visible: false,
          }
        : null,
    );
  };

  return (
    <div
      ref={contentRef}
      className={cx(
        styles.cellContent,
        showTooltip && styles.cellContentEllipsis,
        wrapText && !showTooltip && styles.cellContentWrap,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

const DataGridTable = <T extends GridRow>({
  contentHeight,
  emptyMessage,
  enableColumnFilters,
  enableResize,
  onRowClick,
  onRowDoubleClick,
  rowSelection,
  rows,
  showSummary,
  showTooltip,
  summaryByColumnId,
  sorting,
  table,
  toggleRowSelected,
  wrapText,
}: {
  contentHeight?: CSSProperties["height"];
  emptyMessage: string;
  enableColumnFilters: boolean;
  enableResize: boolean;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  rowSelection: RowSelectionState;
  rows: ReturnType<Table<T>["getRowModel"]>["rows"];
  showSummary: boolean;
  showTooltip: boolean;
  summaryByColumnId?: Record<string, number | string | null | undefined>;
  sorting: SortingState;
  table: Table<T>;
  toggleRowSelected: (row: T, checked: boolean) => void;
  wrapText: boolean;
}) => {
  const headers = table.getHeaderGroups();
  const leafHeaders = table.getLeafHeaders();
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const summaryScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [bodyScrollbarWidth, setBodyScrollbarWidth] = useState(0);
  const [tooltipState, setTooltipState] = useState<TooltipState>(null);
  const visiblePageRowIds = rows.map((row) => row.id);
  const isAllPageRowsSelected =
    visiblePageRowIds.length > 0 &&
    visiblePageRowIds.every((rowId) => Boolean(rowSelection[String(rowId)]));
  const isSomePageRowsSelected =
    !isAllPageRowsSelected &&
    visiblePageRowIds.some((rowId) => Boolean(rowSelection[String(rowId)]));
  const summaryLabelColumnId = leafHeaders.find(
    (header) => !!header.column.columnDef.meta?.enableSummary,
  )?.column.id;
  const shouldRenderSummaryRow =
    showSummary &&
    leafHeaders.some((header) => !!header.column.columnDef.meta?.enableSummary);

  useLayoutEffect(() => {
    const element = bodyScrollRef.current;
    if (!element) {
      return;
    }

    const updateViewportWidth = () => {
      setViewportWidth(element.clientWidth);
      setBodyScrollbarWidth(element.offsetWidth - element.clientWidth);
    };

    updateViewportWidth();

    const resizeObserver = new ResizeObserver(updateViewportWidth);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [contentHeight, enableColumnFilters, leafHeaders.length, table]);

  useEffect(() => {
    const bodyElement = bodyScrollRef.current;
    const headerElement = headerScrollRef.current;
    const summaryElement = summaryScrollRef.current;

    if (!bodyElement || !headerElement) {
      return;
    }

    const syncScroll = (
      source: HTMLDivElement,
      targets: Array<HTMLDivElement | null>,
    ) => {
      if (syncingScrollRef.current) {
        return;
      }

      syncingScrollRef.current = true;
      targets.forEach((target) => {
        if (!target || target === source) {
          return;
        }
        target.scrollLeft = source.scrollLeft;
      });

      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const handleBodyScroll = () => {
      syncScroll(bodyElement, [headerElement, summaryElement]);
    };

    const handleHeaderScroll = () => {
      syncScroll(headerElement, [bodyElement, summaryElement]);
    };

    const handleSummaryScroll = () => {
      if (!summaryElement) {
        return;
      }
      syncScroll(summaryElement, [bodyElement, headerElement]);
    };

    bodyElement.addEventListener("scroll", handleBodyScroll, {
      passive: true,
    });
    headerElement.addEventListener("scroll", handleHeaderScroll, {
      passive: true,
    });
    summaryElement?.addEventListener("scroll", handleSummaryScroll, {
      passive: true,
    });

    return () => {
      bodyElement.removeEventListener("scroll", handleBodyScroll);
      headerElement.removeEventListener("scroll", handleHeaderScroll);
      summaryElement?.removeEventListener("scroll", handleSummaryScroll);
    };
  }, [shouldRenderSummaryRow]);

  useEffect(() => {
    if (!tooltipState) {
      return;
    }

    if (!tooltipState.visible) {
      const timeoutId = window.setTimeout(() => {
        setTooltipState(null);
      }, 160);

      return () => window.clearTimeout(timeoutId);
    }

    const clearTooltip = () => setTooltipState(null);

    window.addEventListener("scroll", clearTooltip, true);
    window.addEventListener("resize", clearTooltip);

    return () => {
      window.removeEventListener("scroll", clearTooltip, true);
      window.removeEventListener("resize", clearTooltip);
    };
  }, [tooltipState]);

  const resolvedColumnWidths = (() => {
    const baseColumns = leafHeaders.map((header) => ({
      id: header.column.id,
      width: header.getSize(),
    }));
    const totalBaseWidth = baseColumns.reduce(
      (sum, column) => sum + column.width,
      0,
    );
    const widthMap = Object.fromEntries(
      baseColumns.map((column) => [column.id, column.width]),
    ) as Record<string, number>;

    if (viewportWidth > totalBaseWidth && baseColumns.length > 0) {
      const lastColumn = baseColumns[baseColumns.length - 1];
      widthMap[lastColumn.id] += viewportWidth - totalBaseWidth;
      return {
        tableWidth: viewportWidth,
        widthMap,
      };
    }

    return {
      tableWidth: totalBaseWidth,
      widthMap,
    };
  })();

  const pinnedOffsets = (() => {
    const left: Record<string, number> = {};
    const right: Record<string, number> = {};

    let leftOffset = 0;
    leafHeaders.forEach((header) => {
      if (header.column.getIsPinned() !== "left") {
        return;
      }
      left[header.column.id] = leftOffset;
      leftOffset += resolvedColumnWidths.widthMap[header.column.id];
    });

    let rightOffset = 0;
    [...leafHeaders].reverse().forEach((header) => {
      if (header.column.getIsPinned() !== "right") {
        return;
      }
      right[header.column.id] = rightOffset;
      rightOffset += resolvedColumnWidths.widthMap[header.column.id];
    });

    return { left, right };
  })();

  return (
    <div
      className={styles.gridContainer}
      style={
        contentHeight
          ? { height: contentHeight }
          : { flex: "1 1 auto", minHeight: 0 }
      }
    >
      <div className={styles.gridContainerWarp}>
        <div
          ref={headerScrollRef}
          className={styles.headerScroll}
          style={
            bodyScrollbarWidth > 0
              ? { paddingRight: bodyScrollbarWidth }
              : undefined
          }
        >
          <table
            className={cx(styles.table, styles.headerTable)}
            style={{ width: resolvedColumnWidths.tableWidth }}
          >
            <colgroup>
              {leafHeaders.map((header) => (
                <col
                  key={`${header.id}-header-col`}
                  style={{
                    width: resolvedColumnWidths.widthMap[header.column.id],
                    minWidth: resolvedColumnWidths.widthMap[header.column.id],
                  }}
                />
              ))}
            </colgroup>
            <thead>
              {headers.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const alignClassName = getAlignClassName(
                      header.column.columnDef.meta?.align,
                    );
                    const pinnedStyles = getPinnedColumnStyles(
                      header.column,
                      pinnedOffsets,
                      true,
                    );
                    const hasCheckbox =
                      header.column.columnDef.meta?.hasCheckbox;
                    const canSort = header.column.getCanSort();
                    const activeSort = sorting.find(
                      (item) => String(item.id) === String(header.column.id),
                    );
                    const sortedFromColumn = header.column.getIsSorted();
                    const sortingDirection: false | "asc" | "desc" = activeSort
                      ? activeSort.desc
                        ? "desc"
                        : "asc"
                      : sortedFromColumn === "asc" ||
                          sortedFromColumn === "desc"
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
                          width:
                            resolvedColumnWidths.widthMap[header.column.id],
                          minWidth:
                            resolvedColumnWidths.widthMap[header.column.id],
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
                                    aria-checked={
                                      isSomePageRowsSelected
                                        ? "mixed"
                                        : undefined
                                    }
                                    className={styles.checkboxInput}
                                    checked={isAllPageRowsSelected}
                                    ref={(element) => {
                                      if (element) {
                                        element.indeterminate =
                                          isSomePageRowsSelected;
                                      }
                                    }}
                                    onChange={(event) => {
                                      const checked =
                                        event.currentTarget.checked;
                                      rows.forEach((row) => {
                                        toggleRowSelected(
                                          row.original,
                                          checked,
                                        );
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
                                <span className={styles.headerLabel}>
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                </span>
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
                      pinnedOffsets,
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
                          width:
                            resolvedColumnWidths.widthMap[header.column.id],
                          minWidth:
                            resolvedColumnWidths.widthMap[header.column.id],
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
          </table>
        </div>

        <div ref={bodyScrollRef} className={styles.bodyScroll}>
          <table
            className={cx(styles.table, styles.bodyTable)}
            style={{ width: resolvedColumnWidths.tableWidth }}
          >
            <colgroup>
              {leafHeaders.map((header) => (
                <col
                  key={`${header.id}-body-col`}
                  style={{
                    width: resolvedColumnWidths.widthMap[header.column.id],
                    minWidth: resolvedColumnWidths.widthMap[header.column.id],
                  }}
                />
              ))}
            </colgroup>
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
                      const pinnedStyles = getPinnedColumnStyles(
                        cell.column,
                        pinnedOffsets,
                      );

                      return (
                        <td
                          key={cell.id}
                          className={cx(
                            styles.td,
                            alignClassName,
                            (wrapText ||
                              cell.column.columnDef.meta?.wrapText) &&
                              styles.tdWrapText,
                            cell.column.getIsPinned() && styles.tdPinned,
                            cell.column.getIsPinned() === "left" &&
                              styles.pinnedLeft,
                            cell.column.getIsPinned() === "right" &&
                              styles.pinnedRight,
                          )}
                          style={{
                            ...pinnedStyles,
                            width:
                              resolvedColumnWidths.widthMap[cell.column.id],
                            minWidth:
                              resolvedColumnWidths.widthMap[cell.column.id],
                          }}
                        >
                          <CellContent
                            showTooltip={showTooltip}
                            setTooltipState={setTooltipState}
                            wrapText={
                              wrapText ||
                              Boolean(cell.column.columnDef.meta?.wrapText)
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </CellContent>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {shouldRenderSummaryRow && (
          <div ref={summaryScrollRef} className={styles.summaryScroll}>
            <table
              className={cx(styles.table, styles.summaryTable)}
              style={{ width: resolvedColumnWidths.tableWidth }}
            >
              <colgroup>
                {leafHeaders.map((header) => (
                  <col
                    key={`${header.id}-summary-col`}
                    style={{
                      width: resolvedColumnWidths.widthMap[header.column.id],
                      minWidth: resolvedColumnWidths.widthMap[header.column.id],
                    }}
                  />
                ))}
              </colgroup>
              <tbody>
                <tr className={styles.summaryRow}>
                  {leafHeaders.map((header) => {
                    const alignClassName = getAlignClassName(
                      header.column.columnDef.meta?.align,
                    );
                    const pinnedStyles = getPinnedColumnStyles(
                      header.column,
                      pinnedOffsets,
                    );
                    const rawSummaryValue =
                      summaryByColumnId?.[header.column.id];
                    const canShowSummary = Boolean(
                      header.column.columnDef.meta?.enableSummary,
                    );

                    let displayValue = "";
                    if (!canShowSummary) {
                      displayValue = "";
                    } else if (typeof rawSummaryValue === "number") {
                      displayValue = rawSummaryValue.toLocaleString("vi-VN");
                    } else if (
                      rawSummaryValue !== undefined &&
                      rawSummaryValue !== null
                    ) {
                      displayValue = String(rawSummaryValue);
                    } else if (
                      summaryLabelColumnId &&
                      header.column.id === summaryLabelColumnId
                    ) {
                      displayValue = "Tổng cộng";
                    }

                    return (
                      <td
                        key={`${header.id}-summary`}
                        className={cx(
                          styles.td,
                          styles.summaryTd,
                          alignClassName,
                          header.column.getIsPinned() && styles.tdPinned,
                          header.column.getIsPinned() === "left" &&
                            styles.pinnedLeft,
                          header.column.getIsPinned() === "right" &&
                            styles.pinnedRight,
                        )}
                        style={{
                          ...pinnedStyles,
                          width:
                            resolvedColumnWidths.widthMap[header.column.id],
                          minWidth:
                            resolvedColumnWidths.widthMap[header.column.id],
                        }}
                      >
                        <div className={styles.cellContent}>{displayValue}</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showTooltip &&
        tooltipState &&
        createPortal(
          <div
            className={styles.tooltip}
            data-visible={tooltipState.visible}
            style={{
              left: tooltipState.left,
              top: tooltipState.top,
            }}
          >
            {tooltipState.text}
          </div>,
          document.body,
        )}
    </div>
  );
};

const DataGridInner = <T extends GridRow>(
  props: DataGridProps<T>,
  ref: Ref<DataGridRef<T>>,
) => {
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false);
  const pageSizeMenuRef = useRef<HTMLDivElement>(null);
  const hasTriggeredGridReadyRef = useRef(false);
  const {
    api,
    canPaginate,
    paginationModel,
    resolvedRowCount,
    rowSelection,
    rows,
    setPageIndex,
    setPageSize,
    sortingState,
    summaryByColumnId,
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
    if (hasTriggeredGridReadyRef.current) {
      return;
    }

    hasTriggeredGridReadyRef.current = true;
    props.onGridReady?.({
      api,
      ref: { api },
    });
  }, [api, props]);

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
    <div
      className={styles.wrap}
      style={{
        width: props.width ?? "100%",
        height: props.contentHeight || "100%",
      }}
    >
      <div className={styles.gridFrame}>
        {props.isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingCard}>
              <Spinner />
            </div>
          </div>
        )}

        <DataGridTable
          contentHeight={props.contentHeight}
          emptyMessage={props.emptyMessage ?? "Không có dữ liệu phù hợp"}
          enableColumnFilters={props.enableColumnFilters ?? false}
          enableResize={props.enableResize ?? true}
          onRowClick={props.onRowClick}
          onRowDoubleClick={props.onRowDoubleClick}
          rowSelection={rowSelection}
          rows={rows}
          showSummary={props.showSummary ?? false}
          showTooltip={props.showTooltip ?? false}
          summaryByColumnId={summaryByColumnId}
          sorting={sortingState}
          table={table}
          toggleRowSelected={toggleRowSelected}
          wrapText={props.wrapText ?? false}
        />

        {(props.enablePagination ?? true) && canPaginate && (
          <div className={styles.pagination}>
            <div className={styles.pageSelectWrap} ref={pageSizeMenuRef}>
              {pageSizeMenuOpen && (
                <div className={styles.pageSelectMenu} role="listbox">
                  {(paginationModel.pageSizeOptions ?? [5, 10, 20, 50]).map(
                    (size) => (
                      <div
                        key={size}
                        className={cx(
                          styles.pageSelectOption,
                          paginationModel.pageSize === size &&
                            styles.pageSelectOptionActive,
                        )}
                        role="option"
                        aria-selected={paginationModel.pageSize === size}
                        onClick={() => {
                          setPageSize(size);
                          setPageSizeMenuOpen(false);
                        }}
                      >
                        {size}
                      </div>
                    ),
                  )}
                </div>
              )}

              <button
                className={cx(styles.pageSelect, styles.pageSelectTrigger)}
                onClick={() => setPageSizeMenuOpen((current) => !current)}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pageSizeMenuOpen}
              >
                <span>{paginationModel.pageSize}</span>
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

            <span>
              {
                resolvedRowCount === 0 ? (
                  "0-0 of 0"
                ) : (
                  <>
                    <span className={styles.pagingNumber}>
                      {paginationModel.pageIndex * paginationModel.pageSize + 1}
                    </span>
                    &nbsp;-&nbsp;
                    <span className={styles.pagingNumber}>
                      {Math.min(
                        (paginationModel.pageIndex + 1) *
                          paginationModel.pageSize,
                        resolvedRowCount,
                      )}
                    </span>
                    &nbsp;of&nbsp;
                    <span className={styles.pagingNumber}>
                      {resolvedRowCount}
                    </span>
                  </>
                )
                // `${paginationModel.pageIndex * paginationModel.pageSize + 1}-${Math.min(
                //     (paginationModel.pageIndex + 1) * paginationModel.pageSize,
                //     resolvedRowCount,
                //   )} of ${resolvedRowCount}`}
              }
            </span>

            <div className={styles.paginationControls}>
              <div className={styles.pageButtonGroup}>
                <button
                  className={styles.pageButton}
                  disabled={paginationModel.pageIndex <= 0}
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
                  disabled={paginationModel.pageIndex <= 0}
                  onClick={() =>
                    setPageIndex(Math.max(paginationModel.pageIndex - 1, 0))
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
                  Trang {paginationModel.pageIndex + 1} /{" "}
                  {Math.max(
                    paginationModel.pageCount ?? table.getPageCount(),
                    1,
                  )}
                </span>
                <button
                  className={styles.pageButton}
                  disabled={
                    paginationModel.pageIndex >=
                    Math.max(
                      (paginationModel.pageCount ?? table.getPageCount()) - 1,
                      0,
                    )
                  }
                  onClick={() =>
                    setPageIndex(
                      Math.min(
                        paginationModel.pageIndex + 1,
                        Math.max(
                          (paginationModel.pageCount ?? table.getPageCount()) -
                            1,
                          0,
                        ),
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
                    paginationModel.pageIndex >=
                    Math.max(
                      (paginationModel.pageCount ?? table.getPageCount()) - 1,
                      0,
                    )
                  }
                  onClick={() =>
                    setPageIndex(
                      Math.max(
                        (paginationModel.pageCount ?? table.getPageCount()) - 1,
                        0,
                      ),
                    )
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
    </div>
  );
};

const DataGrid = forwardRef(DataGridInner) as <T extends GridRow>(
  props: DataGridProps<T> & { ref?: Ref<DataGridRef<T>> },
) => ReactElement;

export default DataGrid;
