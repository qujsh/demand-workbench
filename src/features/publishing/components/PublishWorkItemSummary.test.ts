import { describe, expect, it } from 'vitest';
import type { WorkItemNode } from '../../../shared/types/workItem';
import { buildPublishSummary } from './publishSummaryModel';

const tree: WorkItemNode[] = [
  {
    id: 'module-1',
    type: 'module',
    name: '内容模块',
    children: [
      {
        id: 'feature-1',
        type: 'feature',
        name: '帖子发布',
        children: [
          {
            id: 'work-1',
            type: 'work',
            name: '实现发布接口',
            children: [{ id: 'subtask-1', type: 'subtask', name: '校验权限', children: [] }],
          },
          { id: 'work-2', type: 'work', name: '实现草稿保存', children: [] },
        ],
      },
    ],
  },
];

describe('buildPublishSummary', () => {
  it('保留一二层关系并汇总选中的三四层节点', () => {
    expect(buildPublishSummary(tree, new Set(['work-1', 'subtask-1']))).toEqual([
      {
        id: 'module-1',
        name: '内容模块',
        features: [
          {
            id: 'feature-1',
            name: '帖子发布',
            workNames: ['实现发布接口'],
            showWorkItems: true,
            workCount: 1,
            subtaskCount: 1,
          },
        ],
      },
    ]);
  });

  it('最深只有工作项时停留在功能层展示', () => {
    expect(buildPublishSummary(tree, new Set(['work-2']))[0].features[0]).toMatchObject({
      name: '帖子发布',
      workNames: ['实现草稿保存'],
      showWorkItems: false,
    });
  });

  it('不展示没有被包含工作项的分支', () => {
    expect(buildPublishSummary(tree, new Set())).toEqual([]);
  });
});
