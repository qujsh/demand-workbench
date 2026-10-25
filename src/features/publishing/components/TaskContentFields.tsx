import { useEffect, useState } from 'react';
import { Button, Checkbox, InputNumber, Select, message } from 'antd';
import type { PublicContent } from '../api/taskContentApi';
import { uploadTaskMedia } from '../api/taskContentApi';
import { buildApiUrl } from '../../../shared/api/httpClient';
import './taskContent.css';
const options = (items: [string, string][]) => items.map(([value, label]) => ({ value, label }));
export function TaskContentFields({
  value,
  onChange,
  workMode,
  onUploadingChange,
}: {
  value: PublicContent;
  onChange: (value: Partial<PublicContent>) => void;
  onUploadingChange: (busy: boolean) => void;
  workMode: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [toast, holder] = message.useMessage();
  const set = <K extends keyof PublicContent>(key: K, next: PublicContent[K]) =>
    onChange({ ...value, [key]: next });
  async function upload(input: HTMLInputElement, cover: boolean) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      void toast.warning('单文件最多 50MB');
      input.value = '';
      return;
    }
    setUploading(true);
    onUploadingChange(true);
    try {
      const media = await uploadTaskMedia(file);
      onChange({
        mediaNos: cover ? value.mediaNos : [...value.mediaNos, media.mediaNo],
        coverMediaNo:
          cover || (!value.coverMediaNo && media.type === 'image')
            ? media.mediaNo
            : value.coverMediaNo,
      });
    } catch (error) {
      void toast.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
      onUploadingChange(false);
      input.value = '';
    }
  }
  return (
    <div className="task-content-fields">
      {holder}
      <h3>任务报酬与交付</h3>
      <div className="form-grid">
        <label>
          报酬类型
          <Select
            className="publish-select"
            value={value.rewardType}
            options={options([
              ['negotiable', '面议'],
              ['fixed', '固定金额'],
              ['range', '金额区间'],
              ['non_cash', '非现金'],
            ])}
            onChange={(next) =>
              onChange({ ...value, rewardType: next, amountMin: null, amountMax: null })
            }
          />
        </label>
        <label>
          计价单位
          <Select
            className="publish-select"
            value={value.unit}
            options={options([
              ['project', '项目'],
              ['hour', '小时'],
              ['day', '天'],
              ['time', '次'],
              ['item', '件'],
            ])}
            onChange={(next) => set('unit', next)}
          />
        </label>
      </div>
      {['fixed', 'range'].includes(value.rewardType) && (
        <div className="form-grid">
          <label>
            金额／下限（人民币）
            <InputNumber
              aria-label="金额下限"
              min={0}
              precision={2}
              value={value.amountMin}
              onChange={(next) =>
                onChange({
                  ...value,
                  amountMin: next,
                  amountMax: value.rewardType === 'fixed' ? next : value.amountMax,
                })
              }
            />
          </label>
          {value.rewardType === 'range' && (
            <label>
              金额上限
              <InputNumber
                aria-label="金额上限"
                min={0}
                precision={2}
                value={value.amountMax}
                onChange={(next) => set('amountMax', next)}
              />
            </label>
          )}
        </div>
      )}
      {workMode !== '远程' && (
        <div className="form-grid">
          <label>
            城市行政区划编码
            <input
              value={value.cityCode ?? ''}
              maxLength={6}
              placeholder="例如 330100"
              onChange={(event) => set('cityCode', event.target.value)}
            />
          </label>
          <label>
            城市名称
            <input
              value={value.cityName ?? ''}
              maxLength={64}
              placeholder="例如 杭州"
              onChange={(event) => set('cityName', event.target.value)}
            />
          </label>
        </div>
      )}
      <div className="form-grid">
        <label>
          预计投入（可不填）
          <InputNumber
            aria-label="预计投入"
            min={0.01}
            precision={2}
            value={value.effort}
            onChange={(next) => set('effort', next)}
          />
        </label>
        <label>
          投入单位
          <Select
            className="publish-select"
            value={value.effortUnit}
            options={options([
              ['day', '天'],
              ['hour', '小时'],
            ])}
            onChange={(next) => set('effortUnit', next)}
          />
        </label>
      </div>
      <Checkbox
        checked={value.newcomer}
        onChange={(event) => set('newcomer', event.target.checked)}
      >
        允许新人参与
      </Checkbox>
      {(['scope', 'deliverables', 'acceptance'] as const).map((field, index) => (
        <LineField
          key={field}
          label={
            [
              '工作范围（每行一项，留空使用已选工作项名称）',
              '交付成果（每行一项）',
              '验收要求（每行一项）',
            ][index]!
          }
          value={value[field]}
          onChange={(next) => set(field, next)}
        />
      ))}
      <h3>任务图片与视频</h3>
      <p>
        只上传用于任务展示的媒体，内部需求附件不会自动展示。支持 JPEG / PNG / WebP、MP4；单文件最多
        50MB，最多8个媒体，视频需图片封面。
      </p>
      <div className="task-content-upload">
        <label>
          添加图片／视频
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            disabled={uploading || value.mediaNos.length >= 8}
            onChange={(event) => void upload(event.currentTarget, false)}
          />
        </label>
        <label>
          上传封面
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => void upload(event.currentTarget, true)}
          />
        </label>
      </div>
      {uploading && <p role="status">正在上传，请等待完成后保存或发布。</p>}
      {value.coverMediaNo && (
        <div className="task-content-cover">
          <img
            src={buildApiUrl(
              `/api/v1/task-media/content?mediaNo=${encodeURIComponent(value.coverMediaNo)}`,
            )}
            alt="任务封面"
          />
          <Button onClick={() => set('coverMediaNo', null)}>移除封面</Button>
        </div>
      )}
      {value.mediaNos.map((no) => (
        <div className="task-content-media" key={no}>
          <span>{no}</span>
          <Button
            type="text"
            danger
            onClick={() =>
              onChange({
                ...value,
                mediaNos: value.mediaNos.filter((item) => item !== no),
                coverMediaNo: value.coverMediaNo === no ? null : value.coverMediaNo,
              })
            }
          >
            移除
          </Button>
        </div>
      ))}
    </div>
  );
}
function LineField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [text, setText] = useState(value.join('\n'));
  const canonical = value.join('\n');
  useEffect(() => {
    setText((current) =>
      current
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n') === canonical
        ? current
        : canonical,
    );
  }, [canonical]);
  return (
    <label>
      {label}
      <textarea
        aria-label={label}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(
            event.target.value
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean),
          );
        }}
      />
    </label>
  );
}
