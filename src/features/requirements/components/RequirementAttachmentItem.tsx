import { Button, Image, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, ImageIcon, X } from 'lucide-react';
import type { RequirementAttachment } from '../../../shared/types/workItem';
import { requestAttachmentLink } from '../api/requirementAttachmentApi';

export function RequirementAttachmentItem({
  file,
  requirementNo,
  disabled,
  onRemove,
  onOpen,
}: {
  file: RequirementAttachment;
  requirementNo: string;
  disabled: boolean;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const image = file.contentType?.startsWith('image/');
  const link = useQuery({
    queryKey: ['requirement-attachment-link', requirementNo, file.storageKey],
    queryFn: () => requestAttachmentLink(requirementNo, file.storageKey),
    enabled: Boolean(image),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return (
    <div className={`requirement-attachment-item ${image ? 'is-image' : 'is-document'}`}>
      {image && link.data ? (
        <Image
          width={72}
          height={54}
          src={link.data}
          alt={file.fileName}
          styles={{ image: { objectFit: 'contain' } }}
        />
      ) : (
        <Button
          type="text"
          aria-label={`打开 ${file.fileName}`}
          onClick={onOpen}
          icon={image ? <ImageIcon size={20} /> : <FileText size={20} />}
        />
      )}
      <Tooltip title={file.fileName}>
        <div className="requirement-attachment-name">
          {file.fileName}
          <small>{(file.fileSize / 1024 / 1024).toFixed(2)} MB · 已保存</small>
        </div>
      </Tooltip>
      {!image && (
        <Button
          type="text"
          size="small"
          aria-label={`下载 ${file.fileName}`}
          onClick={onOpen}
          icon={<Download size={14} />}
        />
      )}
      <Button
        className="requirement-attachment-remove"
        type="text"
        size="small"
        disabled={disabled}
        aria-label={`移除 ${file.fileName}`}
        onClick={onRemove}
        icon={<X size={14} />}
      />
    </div>
  );
}
