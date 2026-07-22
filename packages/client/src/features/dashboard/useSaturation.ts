import { useQuery } from '@tanstack/react-query';
import type { SaturationGridRow, SaturationProject } from '@cmt/domain';
import { api } from '../../lib/api';

export type { SaturationGridCell as SaturationCellDto } from '@cmt/domain';

/** Compute model + the raw roadmap dates the review dialog edits. */
export type SaturationProjectDto = SaturationProject & {
  roadmap: { kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null };
};

export interface SaturationDto {
  months: string[];
  rows: SaturationGridRow[];
  projects: SaturationProjectDto[];
  unlinkedGroupCount: number;
}

/** Portfolio change-saturation heatmap (server default: last month → +6). */
export function useSaturation() {
  return useQuery({
    queryKey: ['saturation'],
    queryFn: () => api.get<SaturationDto>('/api/dashboard/saturation'),
  });
}
