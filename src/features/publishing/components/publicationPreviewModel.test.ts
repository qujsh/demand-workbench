import { describe, it, expect } from 'vitest';
import { buildPublicProject, publicationContent, rewardLabel } from './publicationPreviewModel';
import { emptyTaskContent } from './taskContentDefaults';
import type { WorkItemNode } from '../../../shared/types/workItem';
const tree: WorkItemNode[] = [
  {
    id: 'private-module',
    type: 'module',
    name: '模块',
    children: [
      {
        id: 'private-feature',
        type: 'feature',
        name: '功能',
        children: [
          {
            id: 'chosen',
            type: 'work',
            name: '已选任务',
            description: '任务说明',
            status: '进行中',
            dependency: '内部依赖',
            children: [],
          },
          { id: 'not-chosen', type: 'work', name: '不公开的工作项' },
        ],
      },
    ],
  },
];
describe('正式内容与发布预览', () => {
  it('只发布选中工作项及必要祖先，不包含未选节点和内部信息', () => {
    const project = buildPublicProject(tree, new Set(['chosen']), '公开项目', '公开介绍');
    const serialized = JSON.stringify(project);
    expect(serialized).toContain('已选任务');
    expect(serialized).not.toContain('不公开的工作项');
    expect(serialized).not.toContain('内部依赖');
    expect(serialized).not.toContain('private-module');
    expect(serialized).not.toContain('进行中');
    expect(project.tasks[0]?.children[0]?.children).toHaveLength(1);
  });
  it('手工工作范围覆盖默认工作项，预览金额含计价单位且可保留空交付字段', () => {
    const content = {
      ...emptyTaskContent(),
      scope: ['手工范围'],
      rewardType: 'range' as const,
      amountMin: 1200,
      amountMax: 1800,
      unit: 'day' as const,
    };
    const project = buildPublicProject(tree, new Set(), '项目', '');
    const actual = publicationContent(
      {
        title: ' 标题 ',
        summary: ' 简介 ',
        category: 'design',
        skills: '摄影、设计',
        mode: '现场',
        budget: '分两次结算',
        startDate: '',
        deadline: '',
        content,
      },
      [{ id: 'other', type: 'work', name: '其他范围' }],
      project,
    );
    expect(actual.scope).toEqual(['手工范围']);
    expect(actual.title).toBe('标题');
    expect(actual.budgetText).toBe('分两次结算');
    expect(actual.workMode).toBe('onsite');
    expect(actual.skills).toEqual(['摄影', '设计']);
    expect(actual.deliverables).toEqual([]);
    expect(rewardLabel(actual)).toBe('¥1,200–1,800 / 天');
  });
});
