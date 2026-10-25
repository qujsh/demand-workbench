import { useMutation } from '@tanstack/react-query';
import { saveRequirement } from '../api/requirementApi';

export function useSaveRequirement() {
  return useMutation({ mutationFn: saveRequirement });
}
