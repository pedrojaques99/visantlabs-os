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
  ColumnOrderState,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronDown, GripVertical } from "lucide-react"

// Drag and drop imports
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
  initialColumnVisibility?: VisibilityState
  initialColumnOrder?: string[]
}

// Draggable Header Component
interface DraggableHeaderProps {
  header: any
}

function DraggableHeader({ header }: DraggableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    width: header.getSize(),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 0,
    position: 'relative',
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className="relative group p-0"
    >
      <div className="flex h-full items-center">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="px-1 cursor-grab active:cursor-grabbing hover:text-brand-cyan transition-colors"
        >
          <GripVertical className="h-4 w-4 opacity-30 group-hover:opacity-100" />
        </div>

        <div
          className={cn(
            "px-2 py-2 flex items-center gap-2 h-full flex-1 min-w-0",
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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  searchKey,
  searchPlaceholder,
  title,
  icon,
  initialColumnVisibility = {},
  initialColumnOrder = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility)
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    initialColumnOrder.length > 0 ? initialColumnOrder : columns.map(c => c.id as string)
  )

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

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
    onColumnOrderChange: setColumnOrder,
    defaultColumn: {
      minSize: 50,
      maxSize: 1000,
    },
    state: {
      sorting,
      columnSizing,
      columnFilters,
      columnVisibility,
      columnOrder,
    },
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)
        return arrayMove(columnOrder, oldIndex, newIndex)
      })
    }
  }

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
                className="pl-10 bg-neutral-950/70 border-neutral-800/50 text-neutral-300 placeholder:text-neutral-500 focus:ring-[brand-cyan]/30 focus:border-[brand-cyan]/50"
              />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto bg-neutral-950/70 border-neutral-800/50 text-neutral-300">
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
      <div className={cn("rounded-md border border-neutral-800/50 overflow-x-auto", className)}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table style={{ width: table.getTotalSize(), minWidth: '100%', tableLayout: 'fixed' }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-neutral-800/50">
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-neutral-800/30 hover:bg-neutral-950/20 transition-colors"
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
        </DndContext>
      </div>
    </div>
  )
}

