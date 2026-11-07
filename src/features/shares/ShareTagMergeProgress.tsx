import { Alert, Button, Progress } from 'antd';
import type { TagMergeJob } from './api/shareApi';

interface Props {
  task: TagMergeJob;
  retrying: boolean;
  onRetry: () => void;
}
export function ShareTagMergeProgress({ task, retrying, onRetry }: Props) {
  const title = {
    QUEUED: '等待处理',
    PREPARING: '正在准备记录',
    RUNNING: '标签合并中',
    FINALIZING: '正在完成合并',
    COMPLETED: '合并完成',
    FAILED: '处理暂停',
  }[task.status];
  return (
    <section className="share-tag-merge-progress" aria-label="标签合并进度" aria-live="polite">
      <strong>{title}</strong>
      <div className="share-tag-merge-direction">
        #{task.sourceName} → #{task.targetName}
      </div>
      {['RUNNING', 'FINALIZING', 'FAILED', 'COMPLETED'].includes(task.status) && (
        <>
          <Progress
            percent={task.progress}
            status={
              task.status === 'FAILED'
                ? 'exception'
                : task.status === 'COMPLETED'
                  ? 'success'
                  : 'active'
            }
          />
          <span>
            已处理 {task.processedCount.toLocaleString()} / {task.totalCount.toLocaleString()}{' '}
            条记录
          </span>
        </>
      )}
      <p>合并期间暂不可修改标签。关闭面板不影响处理，刷新页面后可继续查看进度。</p>
      {task.status === 'FAILED' && (
        <Alert
          type="error"
          title={task.errorMsg || '处理暂停，已完成的进度会保留'}
          action={
            <Button loading={retrying} onClick={onRetry}>
              重试
            </Button>
          }
        />
      )}
    </section>
  );
}
