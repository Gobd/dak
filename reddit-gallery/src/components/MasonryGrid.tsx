import { useState, useEffect, useRef, Children } from 'react';
import { useMediaQuery } from '@dak/hooks';
import type { ReactNode, ReactElement } from 'react';

interface MasonryGridProps {
  children: ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isSm = useMediaQuery('(min-width: 640px)');
  const colCount = isLg ? 4 : isSm ? 3 : 2;

  const items = Children.toArray(children) as ReactElement[];
  const [columns, setColumns] = useState<number[]>(() => items.map((_, i) => i % colCount));
  const [measured, setMeasured] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevColCount = useRef(colCount);
  const prevItemCount = useRef(items.length);

  useEffect(() => {
    const colCountChanged = prevColCount.current !== colCount;
    const newItems = items.length > prevItemCount.current;

    if (!colCountChanged && !newItems && measured) return;

    prevColCount.current = colCount;

    if (colCountChanged) {
      setMeasured(false);
    }

    const frames = Array.from({ length: colCount }, () => 0);

    // For new items only, keep existing assignments and only place the new ones
    if (newItems && measured && !colCountChanged) {
      const newAssignments = [...columns];
      for (let i = prevItemCount.current; i < items.length; i++) {
        const shortest = frames.indexOf(Math.min(...frames));
        // Approximate height from existing measured items in that col
        for (let j = 0; j < prevItemCount.current; j++) {
          if (newAssignments[j] === shortest) {
            frames[shortest] += itemRefs.current[j]?.offsetHeight ?? 0;
          }
        }
        newAssignments[i] = frames.indexOf(Math.min(...frames));
        frames[newAssignments[i]] += itemRefs.current[i]?.offsetHeight ?? 300;
      }
      prevItemCount.current = items.length;
      setColumns(newAssignments);
      return;
    }

    // Full measurement pass
    const assign = () => {
      const heights = Array.from({ length: colCount }, () => 0);
      const assignments = items.map((_, i) => {
        const el = itemRefs.current[i];
        const h = el?.offsetHeight ?? 0;
        if (h === 0) return i % colCount;
        const shortest = heights.indexOf(Math.min(...heights));
        heights[shortest] += h;
        return shortest;
      });
      prevItemCount.current = items.length;
      setColumns(assignments);
      setMeasured(true);
    };

    // Wait a frame for images to have intrinsic sizes
    const id = requestAnimationFrame(assign);
    return () => cancelAnimationFrame(id);
  }, [items.length, colCount, measured]);

  // Build column arrays
  const cols: ReactElement[][] = Array.from({ length: colCount }, () => []);
  items.forEach((item, i) => {
    const col = columns[i] ?? i % colCount;
    cols[col].push(
      <div
        key={i}
        ref={(el) => {
          itemRefs.current[i] = el;
        }}
      >
        {item}
      </div>,
    );
  });

  return (
    <div className={`flex gap-4 items-start${measured ? '' : ' invisible'}`}>
      {cols.map((col, i) => (
        <div key={i} className="flex-1 flex flex-col gap-4">
          {col}
        </div>
      ))}
    </div>
  );
}
