import { useEffect, useRef, useState } from 'react';
import { Button, Popover, Progress, message } from 'antd';
import { FileText, Info, Paperclip, RotateCcw, X } from 'lucide-react';
import { RequirementAttachmentItem } from './RequirementAttachmentItem';
import './requirementAttachments.css';
import { useMutation } from '@tanstack/react-query';
import type { Requirement, RequirementAttachment } from '../../../shared/types/workItem';
import { useMediaUpload } from '../../media';
import { saveRequirement } from '../api/requirementApi';
import { mapRequirement } from '../hooks/useRequirements';
import { requestAttachmentLink } from '../api/requirementAttachmentApi';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const accept = [
  ...imageTypes,
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');
/** 原始需求附件上传后立即绑定，保存对象路径；移除仅解除引用，不删除云端文件。 */
export function RequirementAttachments({
  requirement,
  onSaved,
  onBusyChange,
}: {
  requirement: Requirement;
  onSaved: (saved: Requirement) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const latest = useRef(requirement);
  useEffect(() => {
    latest.current = requirement;
  }, [requirement]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<{
    file: File;
    attachment?: RequirementAttachment;
    failed: boolean;
  } | null>(null);
  const [toast, holder] = message.useMessage();
  const media = useMediaUpload();
  const save = useMutation({ mutationFn: saveRequirement });
  const files = requirement.attachments ?? [];
  const persist = async (current: Requirement) => {
    const result = mapRequirement(await save.mutateAsync({ requirement: current }));
    latest.current = result;
    onSaved(result);
    return result;
  };
  async function change(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      await operation();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        void toast.error(error instanceof Error ? error.message : '附件保存失败，请重试');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function upload(file: File, confirmed?: RequirementAttachment) {
    if (lock.current) return;
    if ((latest.current.attachments?.length ?? 0) >= 10) {
      void toast.warning('最多添加 10 个附件');
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      void toast.warning('单个图片或文件不能超过 10MB，且不能为空');
      return;
    }
    if (!accept.split(',').includes(file.type)) {
      void toast.warning('支持 JPEG、PNG、WebP、PDF、DOCX、ZIP');
      return;
    }
    if (!requirement.title.trim()) {
      void toast.warning('请先填写需求标题，再添加附件');
      return;
    }
    setPending({ file, attachment: confirmed, failed: false });
    let attachment = confirmed;
    await change(async () => {
      try {
        // 新需求先取得持久编号，保证每个对象从上传前就有来源。
        const current = await persist(latest.current);
        const result = confirmed
          ? null
          : await media.upload({
              file,
              requirementNo: current.id,
              scene: imageTypes.includes(file.type)
                ? 'requirement_image'
                : 'requirement_attachment',
            });
        attachment = confirmed ?? {
          fileName: file.name,
          storageKey: result!.storageKey,
          contentType: file.type,
          fileSize: file.size,
          sortOrder: files.length,
        };
        await persist({
          ...latest.current,
          id: current.id,
          attachments: [...(current.attachments ?? []), attachment],
        });
        setPending(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') setPending(null);
        else setPending({ file, attachment, failed: true });
        throw error;
      }
    });
  }
  async function open(file: RequirementAttachment) {
    try {
      const link = await requestAttachmentLink(requirement.id, file.storageKey);
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      void toast.error(error instanceof Error ? error.message : '无法打开附件');
    }
  }
  return (
    <section
      className={`requirement-attachments${dragging ? ' is-dragging' : ''}`}
      aria-label="需求附件"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        if (!busy && !pending) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (busy || pending) return;
        if (event.dataTransfer.files.length > 1) {
          void toast.warning('请每次添加一个附件');
          return;
        }
        const file = event.dataTransfer.files[0];
        if (file) void upload(file);
      }}
    >
      {holder}
      {(files.length > 0 || pending) && (
        <div className="requirement-attachment-list">
          {files.map((file) => (
            <RequirementAttachmentItem
              key={file.storageKey}
              file={file}
              requirementNo={requirement.id}
              disabled={busy || Boolean(pending)}
              onOpen={() => void open(file)}
              onRemove={() =>
                void change(async () => {
                  await persist({
                    ...latest.current,
                    attachments: files
                      .filter((item) => item.storageKey !== file.storageKey)
                      .map((item, index) => ({ ...item, sortOrder: index })),
                  });
                })
              }
            />
          ))}
          {pending && (
            <div className="requirement-attachment-pending" role="status">
              <FileText size={20} />
              <div className="requirement-attachment-name">
                {pending.file.name}
                <small>
                  {pending.failed
                    ? '未保存，请重试'
                    : media.uploading
                      ? `上传中 ${media.progress}%`
                      : '正在保存附件…'}
                </small>
                {!pending.failed && (
                  <Progress
                    percent={media.uploading ? media.progress : 100}
                    showInfo={false}
                    size="small"
                  />
                )}
              </div>
              {pending.failed ? (
                <>
                  <Button
                    type="text"
                    size="small"
                    aria-label="重试上传附件"
                    icon={<RotateCcw size={14} />}
                    onClick={() => void upload(pending.file, pending.attachment)}
                  >
                    重试
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    aria-label="移除失败附件"
                    icon={<X size={14} />}
                    onClick={() => setPending(null)}
                  />
                </>
              ) : (
                media.uploading && (
                  <Button type="text" size="small" onClick={media.cancel}>
                    取消
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      )}
      <div className="requirement-attachment-toolbar">
        <Button
          type="text"
          icon={<Paperclip size={15} />}
          disabled={busy || Boolean(pending) || files.length >= 10}
          onClick={() => input.current?.click()}
        >
          添加附件
        </Button>
        <Popover
          trigger="click"
          placement="topRight"
          title="附件说明"
          content={
            <div className="requirement-attachment-help">
              <p>支持 JPEG、PNG、WebP、PDF、DOCX、ZIP。</p>
              <p>单个不超过 10MB，最多 10 个附件。</p>
              <p>参考图片建议长边 1600px，文字清晰；建议压缩至 2MB 内，不强制尺寸。</p>
              <p>原始附件不会自动公开到 C 端。当前 AI 分析不读取附件内容。</p>
            </div>
          }
        >
          <Button
            type="text"
            size="small"
            className="requirement-attachment-rules"
            aria-label="查看附件格式与图片建议"
          >
            {files.length}/10 · 单个 ≤10MB <Info size={14} />
          </Button>
        </Popover>
      </div>
      <input
        ref={input}
        type="file"
        aria-label="选择需求附件"
        accept={accept}
        hidden
        disabled={busy || Boolean(pending)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />
      {dragging && <div className="requirement-attachment-drop">松开以上传附件 · 单个 ≤10MB</div>}
    </section>
  );
}
