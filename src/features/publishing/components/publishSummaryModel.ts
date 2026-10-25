import type { WorkItemNode, WorkItemType } from '../../../shared/types/workItem';

const executableTypes = new Set<WorkItemType>(['work', 'subtask']);

export interface PublishSummaryFeature {
  id: string;
  name: string;
  workNames: string[];
  showWorkItems: boolean;
  workCount: number;
  subtaskCount: number;
}

export interface PublishSummaryModule {
  id: string;
  name: string;
  features: PublishSummaryFeature[];
}

function selectedExecutableNodes(node: WorkItemNode, includedIds: Set<string>): WorkItemNode[] {
  const descendants = (node.children ?? []).flatMap((child) =>
    selectedExecutableNodes(child, includedIds),
  );
  return executableTypes.has(node.type) && includedIds.has(node.id)
    ? [node, ...descendants]
    : descendants;
}

function toFeature(node: WorkItemNode, includedIds: Set<string>): PublishSummaryFeature | null {
  const executableNodes = selectedExecutableNodes(node, includedIds);
  if (!executableNodes.length) return null;

  const selectedSubtaskIds = new Set(
    executableNodes.filter((item) => item.type === 'subtask').map((item) => item.id),
  );
  const workNames = (node.children ?? [])
    .filter((item) => item.type === 'work')
    .filter(
      (item) =>
        includedIds.has(item.id) ||
        (item.children ?? []).some((child) => selectedSubtaskIds.has(child.id)),
    )
    .map((item) => item.name);

  return {
    id: node.id,
    name: node.name,
    workNames,
    showWorkItems: selectedSubtaskIds.size > 0,
    workCount: executableNodes.filter((item) => item.type === 'work').length,
    subtaskCount: selectedSubtaskIds.size,
  };
}

export function buildPublishSummary(
  tree: WorkItemNode[],
  includedIds: Set<string>,
): PublishSummaryModule[] {
  return tree.flatMap((module) => {
    if (module.type !== 'module') return [];

    const features = (module.children ?? []).flatMap((node) => {
      if (node.type !== 'feature') return [];
      const feature = toFeature(node, includedIds);
      return feature ? [feature] : [];
    });

    if (!features.length) return [];
    return [{ id: module.id, name: module.name, features }];
  });
}
