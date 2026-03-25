import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  mobileHide?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  testIdPrefix?: string;
  rowClassName?: (item: T) => string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  onRowClick,
  emptyState,
  testIdPrefix = "row",
  rowClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const firstCol = columns[0];
  const restCols = columns.slice(1);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={item.id}
                data-testid={`${testIdPrefix}-${item.id}`}
                className={`${onRowClick ? "cursor-pointer" : ""} ${rowClassName ? rowClassName(item) : ""}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {data.map((item) => (
          <div
            key={item.id}
            data-testid={`${testIdPrefix}-${item.id}`}
            className={`border rounded-lg p-3 bg-card ${onRowClick ? "cursor-pointer active:opacity-80" : ""} ${rowClassName ? rowClassName(item) : ""}`}
            onClick={() => onRowClick?.(item)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {firstCol.render(item)}
              </div>
              {restCols[0] && (
                <div className="shrink-0">
                  {restCols[0].render(item)}
                </div>
              )}
            </div>
            {restCols.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {restCols.slice(1).filter(col => !col.mobileHide).map((col) => (
                  <div key={col.key} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/60">{col.header}: </span>
                    {col.render(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
