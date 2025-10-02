import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(items: T[] = [], initialPageSize = 6) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = useMemo(() => {
    const total = Math.ceil((items?.length ?? 0) / pageSize);
    return Math.max(total, 1);
  }, [items, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [] as T[];
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const nextPage = () => setPage((p) => Math.min(p + 1, totalPages));
  const prevPage = () => setPage((p) => Math.max(p - 1, 1));
  const goToPage = (p: number) =>
    setPage(() => Math.min(Math.max(1, Math.floor(p)), totalPages));

  return {
    page,
    totalPages,
    pageItems,
    nextPage,
    prevPage,
    goToPage,
    pageSize,
    setPageSize,
  };
}
