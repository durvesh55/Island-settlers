import { RESOURCES, type Resource } from '@island/engine';
import { RESOURCE_LABEL } from '../lib/colors';
import { RESOURCE_IMG } from '../lib/resourceArt';

export function ResourceIcon({ resource, className = 'h-6 w-6' }: { resource: Resource; className?: string }) {
  return <img src={RESOURCE_IMG[resource]} alt={RESOURCE_LABEL[resource]} title={RESOURCE_LABEL[resource]} className={className} draggable={false} />;
}

/** Inline cost display, e.g. 1×wood 1×brick. */
export function CostList({ cost, className = '' }: { cost: Partial<Record<Resource, number>>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {RESOURCES.filter((r) => cost[r]).map((r) => (
        <span key={r} className="inline-flex items-center gap-0.5 text-sm">
          {cost[r]}
          <ResourceIcon resource={r} className="h-4 w-4" />
        </span>
      ))}
    </span>
  );
}
