import type { PublicContent } from '../api/taskContentApi';
export function emptyTaskContent(): PublicContent {
  return {
    details: { goal: '', collaboration: '', rewards: [] },
    title: '',
    summary: '',
    categoryCode: '',
    skills: [],
    cityCode: null,
    cityName: null,
    workMode: 'remote',
    rewardType: 'cash',
    amountMin: null,
    amountMax: null,
    currency: 'CNY',
    unit: 'project',
    budgetText: null,
    effort: null,
    effortUnit: 'day',
    newcomer: false,
    scope: [],
    deliverables: [],
    acceptance: [],
    startDate: null,
    deadline: null,
    mediaNos: [],
    coverMediaNo: null,
  };
}
