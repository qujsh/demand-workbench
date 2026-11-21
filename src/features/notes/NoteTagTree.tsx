import { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { ChevronDown, Hash } from 'lucide-react';

interface TagPath {
  name: string;
  recordCount: number;
}
interface TagNode extends TagPath {
  children: TagNode[];
}
interface Props {
  paths: TagPath[];
  selected: string;
  onSelect: (path: string) => void;
}

/** 路径仅用于组织展示；原始标签及笔记归属由服务端维护。 */
export function NoteTagTree({ paths, selected, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const roots: TagNode[] = [];
  const nodes = new Map<string, TagNode>();
  for (const path of paths) {
    let full = '';
    let siblings = roots;
    for (const part of path.name.split('/')) {
      full = full ? `${full}/${part}` : part;
      const key = full.normalize('NFC').toLocaleLowerCase();
      let node = nodes.get(key);
      if (!node) {
        node = { name: full, recordCount: 0, children: [] };
        nodes.set(key, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
    const node = nodes.get(path.name.normalize('NFC').toLocaleLowerCase());
    if (node) node.recordCount = path.recordCount;
  }
  const branchNames = [...nodes.values()]
    .filter((node) => node.children.length)
    .map((node) => node.name);
  function renderTags(items: TagNode[]) {
    return (
      <ul className="note-tag-branches">
        {items.map((node) => {
          const title = node.name.split('/').at(-1)!;
          const expanded = !collapsed.has(node.name);
          return (
            <li key={node.name}>
              <div
                className={`note-tag-branch-row${selected.normalize('NFC').toLocaleLowerCase() === node.name.normalize('NFC').toLocaleLowerCase() ? ' is-selected' : ''}`}
              >
                <Tooltip
                  title={`#${node.name}`}
                  mouseEnterDelay={0}
                >
                  <button
                    className="note-tag-branch-label"
                    aria-pressed={selected === node.name}
                    onClick={() => onSelect(node.name)}
                  >
                    <Hash size={14} strokeWidth={1.8} />
                    <span>{title}</span>
                  </button>
                </Tooltip>
                <span
                  className="note-tag-branch-count"
                  aria-label={`${node.name}：${node.recordCount} 条笔记`}
                >
                  {node.recordCount}
                </span>
                {node.children.length ? (
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${expanded ? '收起' : '展开'}${node.name}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (expanded) next.add(node.name);
                        else next.delete(node.name);
                        return next;
                      })
                    }
                    icon={<ChevronDown size={16} className={expanded ? '' : 'is-collapsed'} />}
                  />
                ) : (
                  <span className="note-tag-chevron-space" />
                )}
              </div>
              {!!node.children.length && expanded && (
                <div className="note-tag-children">{renderTags(node.children)}</div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section aria-label="笔记标签树">
      <div className="note-tag-tree-heading">
        <span>全部标签 · {paths.length}</span>
        {!!branchNames.length && (
          <Button
            type="text"
            size="small"
            onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(branchNames))}
          >
            {collapsed.size ? '全部展开' : '全部收起'}
          </Button>
        )}
      </div>
      {roots.length ? (
        renderTags(roots)
      ) : (
        <p className="note-tag-empty-hint">在笔记中输入 #标签，使用 / 创建三级标签。</p>
      )}
    </section>
  );
}
