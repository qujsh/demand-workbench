import type { PublishTask } from '../api/publishTaskApi';
import { emptyTaskContent } from './taskContentDefaults';
import type { PublicContent, PublicProject, ProjectTask } from '../api/taskContentApi';
import type { WorkItemNode } from '../../../shared/types/workItem';

/** 仅拷贝选中节点及必要祖先的公开字段，不携带内部状态、依赖和附件。 */
export function buildPublicProject(
  tree: WorkItemNode[],
  selected: Set<string>,
  title: string,
  summary: string,
): PublicProject {
  function prune(nodes: WorkItemNode[], path: string): ProjectTask[] {
    return nodes.flatMap((node, index) => {
      const id = `${path}-${index + 1}`;
      const children = prune(node.children ?? [], id);
      if (!selected.has(node.id) && !children.length) return [];
      return [
        {
          id,
          type: node.type,
          name: node.name,
          description: node.description || null,
          role: node.role || null,
          startDate: node.startDate || null,
          endDate: node.endDate || null,
          children,
        },
      ];
    });
  }
  return { title, summary, tasks: prune(tree, 'task') };
}
export function countProjectTasks(nodes: ProjectTask[]): number {
  return nodes.reduce(
    (count, node) =>
      count +
      (node.type === 'work' || node.type === 'subtask' ? 1 : 0) +
      countProjectTasks(node.children),
    0,
  );
}
export interface PreviewInput {
  title: string;
  summary: string;
  category: string;
  skills: string;
  mode: string;
  budget: string;
  startDate: string;
  deadline: string;
  content: PublicContent;
}
/** 预览与提交始终读取同一份派生内容。 */
export function publicationContent(
  data: PreviewInput,
  included: WorkItemNode[],
  project: PublicProject,
): PublicContent {
  return {
    ...data.content,
    title: data.title.trim(),
    summary: data.summary.trim(),
    categoryCode: data.category,
    skills: data.skills
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    workMode: data.mode === '现场' ? 'onsite' : data.mode === '混合' ? 'hybrid' : 'remote',
    budgetText: data.budget,
    startDate: data.startDate || null,
    deadline: data.deadline || null,
    scope: data.content.scope.length
      ? data.content.scope
      : included.map((item) => item.name).filter(Boolean),
    project,
  };
}
export const unitLabels: Record<string, string> = {
  project: '项目',
  hour: '小时',
  day: '天',
  time: '次',
  item: '件',
};
export function rewardLabel(content: PublicContent): string {
  const amount = (n: number | null) =>
    n === null ? '' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const unit = ` / ${unitLabels[content.unit]}`;
  if (content.rewardType === 'fixed')
    return content.amountMin === null ? '金额待填写' : `¥${amount(content.amountMin)}${unit}`;
  if (content.rewardType === 'range')
    return content.amountMin === null || content.amountMax === null
      ? '金额待填写'
      : `¥${amount(content.amountMin)}–${amount(content.amountMax)}${unit}`;
  return content.budgetText?.trim() || (content.rewardType === 'non_cash' ? '非现金报酬' : '面议');
}

/** 显式恢复表单副本；不能依赖查询对象引用变化，因为未保存编辑不会改变缓存。 */
export function publicationEditorState(task: PublishTask) {
  return {
    title: task.title,
    category: task.category,
    summary: task.summary,
    skills: task.skills,
    experience: task.experience,
    recruitCount: String(task.recruitCount),
    budget: task.budget,
    startDate: task.startDate || '',
    deadline: task.deadline || '',
    mode: task.workMode,
    recruit: task.recruitMode,
    visibility: '所有人可见',
    content: task.content || emptyTaskContent(),
    invitedUserNos: [],
    version: task.version || 0,
  };
}
