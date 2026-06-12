import { Masonry, useInfiniteLoader } from 'masonic';
import type { ReactElement } from 'react';

interface MasonryGridProps {
  items: { id: string }[];
  renderItem: (item: { id: string }, width: number) => ReactElement;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function MasonryGrid({ items, renderItem, hasMore, onLoadMore }: MasonryGridProps) {
  const maybeLoadMore = useInfiniteLoader(
    async () => {
      if (hasMore) onLoadMore();
    },
    { isItemLoaded: (index) => index < items.length, threshold: 3 },
  );

  return (
    <Masonry
      items={items}
      render={({ data, width }) => renderItem(data, width)}
      columnGutter={16}
      columnWidth={280}
      maxColumnCount={4}
      itemKey={(item) => item.id}
      itemHeightEstimate={400}
      onRender={maybeLoadMore}
    />
  );
}
