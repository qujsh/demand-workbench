import { expect, it } from 'vitest';
import { archiveDisplayBody } from './noteArchiveDisplay';
import type { NoteRecord } from './noteModels';

const record: NoteRecord = {
  id: 'archive',
  title: '',
  date: '2026-11-19T10:00',
  visibility: 'private',
  body: '用户问题：\n问题\n\nCodex 最终回答：\n**原样 Markdown**\n- 列表 `code`\n\n![效果](</tmp/my image.png>)\n\n#Codex #项目',
  tags: ['Codex', '项目'],
  images: ['/api/image.png'],
};

it('阅读时隐藏已关联的图片行和重复标签，保留原始Markdown和数据', () => {
  const original = record.body;
  const body = archiveDisplayBody(record, true);
  expect(body).toContain('**原样 Markdown**\n- 列表 `code`');
  expect(body).not.toContain('/tmp/');
  expect(body).not.toContain('#Codex');
  expect(record.body).toBe(original);
  expect(record.tags).toEqual(['Codex', '项目']);
  expect(archiveDisplayBody(record)).toContain('#Codex #项目');
});

it('保留普通笔记、未上传的图片、远程图片和代码示例', () => {
  expect(archiveDisplayBody({ ...record, body: '普通正文\n![图](/tmp/a.png)\n#Codex' }, true)).toBe(
    '普通正文\n![图](/tmp/a.png)\n#Codex',
  );
  expect(archiveDisplayBody({ ...record, images: [] })).toContain('/tmp/my image.png');
  const body =
    '用户问题：\n问题\nCodex 最终回答：\n```md\n![示例](/tmp/example.png)\n```\n![远程](https://example.com/image.png)';
  expect(archiveDisplayBody({ ...record, body })).toBe(body);
  expect(archiveDisplayBody({ ...record, body: record.body + '\n本地图片无法归档' })).toContain(
    '/tmp/',
  );
});

it('仅隐藏已注册的完整标签末行，不删除正文内标签或末尾其他文字', () => {
  expect(archiveDisplayBody({ ...record, body: record.body + '\n说明' }, true)).toContain(
    '#Codex #项目',
  );
  expect(archiveDisplayBody({ ...record, tags: ['Codex'] }, true)).toContain('#Codex #项目');
});

it('完整层级归档标签只在标签区显示一次', () => {
  const tag = 'Codex/demand-workbench/查看后端MCP是否可用';
  const body = '用户问题：\n问题\n\nCodex 最终回答：\n完整回复\n\n#' + tag;
  expect(archiveDisplayBody({ ...record, body, tags: [tag] }, true)).toBe(
    '用户问题：\n问题\n\nCodex 最终回答：\n完整回复',
  );
});

it('无问答包装的纯日志也隐藏末尾已注册的归档标签，原始内容不变', () => {
  const tag = 'Codex/demand-workbench/查看后端MCP是否可用';
  const body = '我想做下功能测试\n\n#' + tag;
  const log = { ...record, body, tags: [tag] };
  expect(archiveDisplayBody(log, true)).toBe('我想做下功能测试');
  expect(archiveDisplayBody(log)).toBe(body);
  expect(log.body).toBe(body);
  expect(log.tags).toEqual([tag]);
});

it('纯日志不隐藏未注册标签、正文内标签或代码示例', () => {
  const tag = 'Codex/demand-workbench';
  const log = { ...record, tags: [tag] };
  for (const body of [
    '正文\n\n#Codex/其他项目',
    '#' + tag + '\n正文',
    '正文\n```text\n#' + tag,
    '正文\n```text\n#' + tag + '\n```',
  ]) {
    expect(archiveDisplayBody({ ...log, body }, true)).toBe(body);
  }
});
