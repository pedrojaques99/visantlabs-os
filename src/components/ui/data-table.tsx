import * as React from "react"
import {
  ColumnDef,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  className?: string
  searchKey?: string
  searchPlaceholder?: string
  title?: string
  icon?: React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  searchKey,
  searchPlaceholder,
  title,
  icon,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    defaultColumn: {
      minSize: 50,
      maxSize: 1000,
    },
    state: {
      sorting,
      columnSizing,
      columnFilters,
      columnVisibility,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {title && (
          <div className="flex items-center gap-3 text-neutral-300 font-mono">
            {icon}
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
        )}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {searchKey && (
            <div className="relative w-full md:w-auto md:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                placeholder={searchPlaceholder || "Search..."}
                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
                }
                className="pl-10 bg-black/40 border-neutral-800/50 text-neutral-300 placeholder:text-neutral-500 focus:ring-[brand-cyan]/30 focus:border-[brand-cyan]/50"
              />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto bg-black/40 border-neutral-800/50 text-neutral-300">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-neutral-300 focus:bg-neutral-800"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={cn("rounded-md border border-neutral-800/50", className)}>
        <Table style={{ width: table.getTotalSize(), minWidth: '100%', tableLayout: 'fixed' }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-neutral-800/50">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative group p-0"
                    >
                      <div
                        className={cn(
                          "px-4 py-2 flex items-center gap-2 h-full",
                          header.column.getCanSort() && "cursor-pointer select-none hover:text-neutral-200 transition-colors"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2 flex-1 overflow-hidden">
                          <div className="flex-1 truncate">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          </div>
                          {header.column.getCanSort() && (
                            <div className="w-4 h-4 flex-shrink-0">
                              {{
                                asc: <ArrowUp className="h-3 w-3" />,
                                desc: <ArrowDown className="h-3 w-3" />,
                              }[header.column.getIsSorted() as string] ?? (
                                  <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Resize Handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize bg-neutral-700/50 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                            header.column.getIsResizing() && "bg-brand-cyan opacity-100 w-0.5"
                          )}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-neutral-800/30 hover:bg-black/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-3 overflow-hidden"
                    >
                      <div className="truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-neutral-500 font-mono">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

