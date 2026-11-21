import { describe, expect, it } from 'vitest';
import { activeTag, extractTags, matchingTags } from './noteTags';

describe('正文标签规则', () => {
  it('支持92字三级路径并按每级30字校验，包含Unicode字符', () => {
    const path = ['项'.repeat(30), '目'.repeat(30), '聊'.repeat(30)].join('/');
    expect(path.length).toBe(92);
    expect(extractTags('#' + path)).toEqual([path]);
    const emoji = ['😀'.repeat(30), '😁'.repeat(30), '😃'.repeat(30)].join('/');
    expect(extractTags('#' + emoji)).toEqual([emoji]);
    expect(extractTags('#父/' + '长'.repeat(31))).toEqual([]);
    expect(activeTag('#' + path, path.length + 1)?.query).toBe(path);
  });
  it('识别三级路径并拒绝空层级或超过三级', () => {
    expect(extractTags('#项目/构想台/MCP #一//二 #一/二/三/四 #/一 #一/')).toEqual([
      '项目/构想台/MCP',
    ]);
  });
  it('区分标签、语言名称和网址片段，并识别末尾未加空格的标签', () => {
    expect(extractTags('C# https://example.com/#part #工作 正文\n#摄影')).toEqual(['工作', '摄影']);
  });
  it('重复标签只关联一次，删除最后一个文本标签即可解除关联', () => {
    expect(extractTags('#Work #work #摄影')).toEqual(['Work', '摄影']);
    expect(extractTags('普通正文')).toEqual([]);
  });
  it('空格后退出候选，光标在词中间或 C# 后不触发', () => {
    expect(activeTag('#创', 2)?.query).toBe('创');
    expect(activeTag('#创业 正文', 4)).toBeNull();
    expect(activeTag('#创业', 2)).toBeNull();
    expect(activeTag('C#', 2)).toBeNull();
  });
  it('完全匹配优先，再前缀匹配，再包含匹配', () => {
    expect(matchingTags(['我的创业', '创业记录', '创业', '摄影'], '创业')).toEqual([
      '创业',
      '创业记录',
      '我的创业',
    ]);
  });
  it('限制标签名称长度，保留合法标点和斜线', () => {
    expect(extractTags(`#${'长'.repeat(31)} #5.创意/暂无需求`)).toEqual(['5.创意/暂无需求']);
  });
});
