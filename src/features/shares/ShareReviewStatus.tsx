import { Button, Tooltip } from 'antd';
import { LoaderCircle, CircleAlert } from 'lucide-react';
import type { ShareRecord } from './shareDemo';

/** 公开申请与实际可见范围分开展示，服务异常不误报为违规。 */
export function ShareReviewStatus({
  record,
  retrying,
  onRetry,
}: {
  record: ShareRecord;
  retrying: boolean;
  onRetry: () => void;
}) {
  const review = record.review;
  if (!review || review.status === 'approved' || review.status === 'cancelled') return null;
  const active = review.status === 'queued' || review.status === 'running';
  const text =
    review.status === 'queued'
      ? '等待公开审核'
      : review.status === 'running'
        ? `正在审核 ${review.completedCount}/${review.totalCount}`
        : review.status === 'failed'
          ? '审核暂未完成'
          : review.status === 'review_required'
            ? '需要调整后再公开'
            : '未通过公开审核';
  return (
    <div className="share-review-status" role="status">
      <Tooltip title={review.message || '审核通过后自动公开，目前仅自己可见'}>
        <span>
          {active ? <LoaderCircle size={13} /> : <CircleAlert size={13} />}
          {text}
        </span>
      </Tooltip>
      {review.status === 'failed' && (
        <Button type="link" size="small" loading={retrying} onClick={onRetry}>
          重试审核
        </Button>
      )}
    </div>
  );
}
