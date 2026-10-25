import { Button, Modal } from 'antd';
import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icons';
import type { WorkItemNode, WorkItemType } from '../../../shared/types/workItem';
import { buildPublishSummary } from './publishSummaryModel';

const typeLabels: Record<WorkItemType, string> = {
  module: '模块',
  feature: '功能',
  work: '工作项',
  subtask: '子任务',
};

function DetailNode({ node, level = 0 }: { node: WorkItemNode; level?: number }) {
  return (
    <li className={`publish-detail-node level-${level}`}>
      <div className="publish-detail-node-main">
        <span>{typeLabels[node.type]}</span>
        <strong>{node.name}</strong>
      </div>
      {node.description && <p>{node.description}</p>}
      {(node.children ?? []).length > 0 && (
        <ul>{node.children?.map((child) => <DetailNode key={child.id} node={child} level={level + 1} />)}</ul>
      )}
    </li>
  );
}

interface PublishWorkItemSummaryProps {
  tree: WorkItemNode[];
  includedIds: Set<string>;
  includedCount: number;
  isLoading?: boolean;
}

export function PublishWorkItemSummary({
  tree,
  includedIds,
  includedCount,
  isLoading = false,
}: PublishWorkItemSummaryProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const summary = useMemo(() => buildPublishSummary(tree, includedIds), [tree, includedIds]);

  return (
    <>
      <div className="publish-section-heading">
        <div>
          <strong>工作范围</strong>
          <small>按业务范围汇总，详细工作项可在详情中查看</small>
        </div>
        <span>{includedCount} 项</span>
        <Button
          type="text"
          size="small"
          icon={<Icon name="ListTree" size={14} />}
          disabled={!tree.length}
          onClick={() => setDetailOpen(true)}
        >
          查看详情
        </Button>
      </div>

      <div className="publish-work-summary">
        {isLoading && !tree.length && <div className="publish-summary-status">正在加载工作项...</div>}
        {!isLoading && includedCount > 0 && !summary.length && (
          <div className="publish-summary-status">当前工作项缺少模块或功能层级，请在详情中查看。</div>
        )}
        {summary.map((module) => (
          <div key={module.id} className="publish-scope-group">
            <strong className="publish-scope-title">{module.name}</strong>
            <div className="publish-scope-content">
              {module.features.some((feature) => feature.showWorkItems) ? (
                module.features.map((feature) => (
                  <div className="publish-scope-feature" key={feature.id}>
                    <span>{feature.name}：</span>
                    <p>
                      {feature.showWorkItems && feature.workNames.length
                        ? feature.workNames.join('、')
                        : feature.name}
                    </p>
                  </div>
                ))
              ) : (
                <p>{module.features.map((feature) => feature.name).join('、')}</p>
              )}
            </div>
          </div>
        ))}
        {!isLoading && includedCount === 0 && (
          <div className="publish-work-empty">
            <Icon name="ListTree" size={20} />
            <span>
              <strong>暂未带入工作项</strong>
              <small>可以继续发布，后续在任务中补充工作范围。</small>
            </span>
          </div>
        )}
      </div>

      <Modal
        className="publish-work-detail-modal"
        title="工作项拆解"
        open={detailOpen}
        width={1120}
        footer={null}
        centered
        destroyOnHidden
        onCancel={() => setDetailOpen(false)}
      >
        <div className="publish-work-detail-head">
          <span>完整工作项结构</span>
          <b>{includedCount} 个可执行项</b>
        </div>
        <ul className="publish-work-detail-tree">
          {tree.map((node) => <DetailNode key={node.id} node={node} />)}
        </ul>
      </Modal>
    </>
  );
}
