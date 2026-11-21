import type { NoteRecord } from './noteModels';

/** 整理 Codex 问答和日志的阅读视图；原始正文、Markdown 和服务端标签不变。 */
export function archiveDisplayBody(record: NoteRecord, hideFooterTags = false): string {
  const isQuestionAnswer =
    record.body.includes('用户问题：\n') && record.body.includes('Codex 最终回答：\n');
  const lines = record.body.split('\n');
  const normalize = (value: string) => value.normalize('NFC').toLowerCase();
  const tags = new Set(record.tags.map(normalize));
  let last = lines.length - 1;
  while (last >= 0 && !lines[last].trim()) last -= 1;
  if (hideFooterTags && last >= 0) {
    const footer = lines[last].trim().split(/\s+/);
    let footerFence: string | undefined;
    for (const line of lines.slice(0, last)) {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (!marker) continue;
      if (!footerFence) footerFence = marker;
      else if (marker[0] === footerFence[0] && marker.length >= footerFence.length)
        footerFence = undefined;
    }
    if (
      !footerFence &&
      (isQuestionAnswer || footer.some((tag) => normalize(tag).startsWith('#codex/'))) &&
      footer.some((tag) => normalize(tag) === '#codex' || normalize(tag).startsWith('#codex/')) &&
      footer.every((tag) => tag.startsWith('#') && tags.has(normalize(tag.slice(1))))
    ) {
      lines.splice(last);
    }
  }
  if (!isQuestionAnswer) {
    return lines.length === record.body.split('\n').length
      ? record.body
      : lines.join('\n').trimEnd();
  }
  // 仅隐藏独占一行、位于代码围栏之外的本地图片标记。缺图告警时保留路径供排查。
  const hasImages = (record.imageCount ?? record.images.length) > 0;
  const canHideImages =
    hasImages &&
    !record.body.includes('本地图片无法归档') &&
    !record.body.includes('本地配图是符号链接');
  let fence: string | undefined;
  return lines
    .filter((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
        return true;
      }
      return (
        !canHideImages ||
        Boolean(fence) ||
        !/^\s*!\[[^\]]*\]\((?:<\/[^>]+>|\/[^\s)]+)(?:\s+"[^"]*")?\)\s*$/.test(line)
      );
    })
    .join('\n')
    .trimEnd();
}
