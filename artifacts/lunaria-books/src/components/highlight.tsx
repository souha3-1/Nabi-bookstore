import type { ReactNode } from 'react';

import { findMatches } from '@/lib/search';

// Shows a text with the parts that match the visitor's search marked (nothing is marked without a search).
export function Highlight({ text, query }: { text: string; query?: string }) {
  const ranges = query ? findMatches(text, query) : [];
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let last = 0;
  ranges.forEach(([start, end], index) => {
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<mark key={index} className="rounded-[2px] bg-[#F8B2B2]/70 text-inherit">{text.slice(start, end)}</mark>);
    last = end;
  });
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
