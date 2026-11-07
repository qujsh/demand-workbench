import { Button } from 'antd';
import { ArrowRight } from 'lucide-react';

interface Props {
  selection: string[];
  pending: boolean;
  onCancel: () => void;
  onMerge: () => Promise<void>;
}

export function ShareTagMerge({ selection, pending, onCancel, onMerge }: Props) {
  const [source, target] = selection;
  return (
    <section className="share-tag-merge" aria-label="合并标签">
      <div className="share-tag-merge-toolbar">
        <div className="share-tag-merge-direction" role="status" aria-live="polite">
          {source ? (
            <>
              <span>#{source}</span>
              <ArrowRight size={14} />
              <strong>{target ? `#${target}` : '请选择保留的标签'}</strong>
            </>
          ) : (
            <span>请选择要合并的标签</span>
          )}
        </div>
        <Button
          type="primary"
          loading={pending}
          disabled={selection.length !== 2}
          onClick={() => void onMerge().catch(() => undefined)}
        >
          确认合并
        </Button>
        <Button type="text" disabled={pending} onClick={onCancel}>
          取消
        </Button>
      </div>
      <p className="share-tag-merge-note">
        {target
          ? `将 #${source} 的记录归入 #${target}，并移除 #${source}。`
          : '最多选择两个标签，可取消勾选后重新选择。'}
        原文保持不变，合并后不能一键拆分。
      </p>
    </section>
  );
}
