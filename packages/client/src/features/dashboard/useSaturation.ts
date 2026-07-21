import { useQuery } from '@tanstack/react-query';
import type { SaturationBand } from '@cmt/domain';
import { api } from '../../lib/api';

export interface SaturationCellDto {
  score: number;
  band: SaturationBand;
  contributions: Array<{ projectId: string; projectName: string; load: number }>;
}

export interface SaturationDto {
  months: string[];
  rows: Array<{ orgGroupId: string; orgGroupName: string; cells: SaturationCellDto[] }>;
  unlinkedGroupCount: number;
}

/** Portfolio change-saturation heatmap (server default: last month → +6). */
export function useSaturation() {
  return useQuery({
    queryKey: ['saturation'],
    queryFn: () => api.get<SaturationDto>('/api/dashboard/saturation'),
  });
}
