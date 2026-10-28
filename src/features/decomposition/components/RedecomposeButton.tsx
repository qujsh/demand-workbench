import { App } from 'antd';
import { Icon } from '../../../components/Icons';

type Props = {
  hasExisting: boolean;
  pending: boolean;
  coolingDown?: boolean;
  onActivate?: () => boolean;
  onStart: () => Promise<void>;
};

/** 重新生成前说明替换边界；旧结果由调用方保留至新任务成功。 */
export function RedecomposeButton({ hasExisting, pending, coolingDown = false, onActivate, onStart }: Props) {
  const { modal } = App.useApp();
  const confirmStart = () => {
    if (coolingDown || (onActivate && !onActivate())) return;
    return onStart();
  };
  const start = () => {
    if (coolingDown) return;
    if (!hasExisting) {
      void confirmStart();
      return;
    }
    modal.confirm({
      title: '重新拆解工作项？',
      content: '将根据当前 AI 需求描述重新生成。',
      okText: '确认重新拆解',
      cancelText: '取消',
      onOk: confirmStart,
    });
  };
  return (
    <button className="ghost redecompose-button" disabled={coolingDown} title={coolingDown ? '确认重新拆解后30秒内不可重复操作' : undefined} onClick={start}>
      <Icon name={pending ? 'LoaderCircle' : hasExisting ? 'RefreshCw' : 'ListTree'} className={pending ? 'spin' : ''} />
      {hasExisting ? '重新拆解' : '拆解工作项'}
    </button>
  );
}
