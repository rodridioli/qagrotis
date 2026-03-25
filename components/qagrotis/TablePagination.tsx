"use client"

import React from "react"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: TablePaginationProps) {
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex flex-col gap-2 border-t border-border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span className="hidden text-sm text-text-secondary sm:inline">
        Itens por página: <span className="font-medium">{itemsPerPage}</span>
      </span>
      <div className="flex items-center justify-between gap-3 text-sm text-text-secondary sm:justify-end">
        <span className="text-xs sm:text-sm">
          {start}–{end} de {totalItems}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="flex size-7 items-center justify-center rounded-md border border-border-default disabled:opacity-40 hover:bg-neutral-grey-100"
          >
            &lt;
          </button>
          <span className="px-2 text-xs sm:text-sm">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="flex size-7 items-center justify-center rounded-md border border-border-default disabled:opacity-40 hover:bg-neutral-grey-100"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
