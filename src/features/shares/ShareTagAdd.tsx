import { useRef, useState } from 'react';
import { Button, Input, type InputRef } from 'antd';

const normalize = (value: string) =>
  value
    .trim()
    .replace(/^#+\s*/, '')
    .trim();
interface Props {
  tags: string[];
  count: (name: string) => number;
  onAdd: (name: string) => void | Promise<void>;
  onLocate: (name: string) => void;
  onStartMerge: () => void;
}
export function ShareTagAdd({ tags, count, onAdd, onLocate, onStartMerge }: Props) {
  const [value, setValue] = useState('');
  const input = useRef<InputRef>(null);
  const name = normalize(value);
  const query = name.toLocaleLowerCase();
  const exact = tags.find((tag) => tag.toLocaleLowerCase() === query);
  const matches = query
    ? tags
        .filter((tag) => {
          const text = tag.toLocaleLowerCase();
          return text.includes(query) || query.includes(text);
        })
        .sort((a, b) => Number(b === exact) - Number(a === exact))
        .slice(0, 5)
    : [];
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (pending) return;
    if (!name) return;
    if (exact) {
      onLocate(exact);
      return;
    }
    setPending(true);
    try {
      await onAdd(name);
    } catch {
      return;
    } finally {
      setPending(false);
    }
    setValue('');
    input.current?.focus();
    input.current?.input?.closest('.ant-drawer-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="share-tag-add-area">
      <div className="share-new-tag">
        <Input
          ref={input}
          aria-label="新标签名称"
          placeholder="输入新标签名称"
          maxLength={30}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPressEnter={(event) => {
            if (!event.nativeEvent.isComposing) submit();
          }}
        />
        <Button type="primary" loading={pending} disabled={!name || pending} onClick={submit}>
          {exact ? '定位已有标签' : '添加'}
        </Button>
        <Button disabled={tags.length < 2 || pending} onClick={onStartMerge}>
          合并
        </Button>
      </div>
      {matches.length > 0 && (
        <div className="share-tag-matches" aria-label="已有相似标签">
          <p>{exact ? '标签已存在，无需重复添加' : '可能已有相关标签'}</p>
          <div>
            {matches.map((tag) => (
              <button key={tag} onClick={() => onLocate(tag)}>
                # {tag}
                <small>{count(tag)} 条</small>
              </button>
            ))}
          </div>
          {!exact && <small>可定位已有标签，或继续添加「{name}」。</small>}
        </div>
      )}
    </div>
  );
}
