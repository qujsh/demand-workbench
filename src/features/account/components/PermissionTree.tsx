import { Button, Checkbox, Empty, Input, Space, Tooltip, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useState } from 'react';
import type { PermissionDefinition } from '../api/roleApi';

type Props = {
  catalog: PermissionDefinition[];
  selected: string[];
  disabled: boolean;
  onToggle: (codes: string[], checked: boolean) => void;
};
type Branch = {
  key: string;
  name: string;
  nameEn?: string;
  permissions: PermissionDefinition[];
  children: Branch[];
  permission?: PermissionDefinition;
};

function branches(catalog: PermissionDefinition[]): Branch[] {
  const roots: Branch[] = [];
  for (const permission of catalog) {
    let siblings = roots;
    const path = permission.path?.length
      ? permission.path
      : [
          {
            code: `group:${permission.group}`,
            name: permission.group === '其他权限' ? '通用能力权限' : permission.group,
            nameEn: '',
          },
        ];
    for (const group of path) {
      let branch = siblings.find((item) => item.key === `scope:${group.code}`);
      if (!branch) {
        branch = {
          key: `scope:${group.code}`,
          name: catalog.some((p) => p.code === group.code) ? `${group.name}操作` : group.name,
          nameEn: group.nameEn,
          permissions: [],
          children: [],
        };
        siblings.push(branch);
      }
      branch.permissions.push(permission);
      siblings = branch.children;
    }
    siblings.push({
      key: permission.code,
      name: permission.name,
      nameEn: permission.nameEn,
      permissions: [permission],
      children: [],
      permission,
    });
  }
  return roots;
}
function moduleKeys(nodes: Branch[]): string[] {
  return nodes.flatMap((node) => (node.permission ? [] : [node.key, ...moduleKeys(node.children)]));
}

export function PermissionTree({ catalog, selected, disabled, onToggle }: Props) {
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const groups = branches(catalog);
  const [expanded, setExpanded] = useState<string[]>(() => moduleKeys(groups));
  const [searchExpanded, setSearchExpanded] = useState<string[] | null>(null);
  const keyword = search.trim().toLocaleLowerCase();
  const visibleKeys: string[] = [];
  const data = (nodes: Branch[], parentMatches = false): DataNode[] =>
    nodes.flatMap((node) => {
      const matches =
        parentMatches ||
        `${node.key} ${node.name} ${node.nameEn ?? ''} ${node.permission?.description ?? ''} ${node.permission?.descriptionEn ?? ''}`
          .toLocaleLowerCase()
          .includes(keyword);
      const children = node.permission ? [] : data(node.children, matches);
      if (
        node.permission
          ? !matches || (onlySelected && !selected.includes(node.key))
          : !children.length
      )
        return [];
      const count = node.permissions.filter((permission) =>
        selected.includes(permission.code),
      ).length;
      if (!node.permission) visibleKeys.push(node.key);
      const label = (
        <span className="permission-bilingual">
          <span>{node.name}</span>
          {node.nameEn && (
            <>
              <span className="permission-language-separator" aria-hidden="true">
                /
              </span>
              <small>{node.nameEn}</small>
            </>
          )}
        </span>
      );
      const title = (
        <Space>
          <Checkbox
            aria-label={node.name}
            checked={count === node.permissions.length}
            indeterminate={count > 0 && count < node.permissions.length}
            disabled={disabled}
            onChange={(event) =>
              onToggle(
                node.permissions.map((permission) => permission.code),
                event.target.checked,
              )
            }
          >
            {label}
          </Checkbox>
          {!node.permission && (
            <span className="system-permission-count">
              {count}/{node.permissions.length}
            </span>
          )}
        </Space>
      );
      return [
        {
          key: node.key,
          title: node.permission ? (
            <Tooltip
              title={
                <>
                  <div>{node.permission.description}</div>
                  <div>{node.permission.descriptionEn}</div>
                  <div>{node.key}</div>
                </>
              }
              placement="right"
            >
              {title}
            </Tooltip>
          ) : (
            title
          ),
          ...(children.length ? { children } : {}),
        },
      ];
    });
  const treeData = data(groups);
  const expandedKeys = keyword || onlySelected ? (searchExpanded ?? visibleKeys) : expanded;
  const allExpanded =
    visibleKeys.length > 0 && visibleKeys.every((group) => expandedKeys.includes(group));
  const updateExpanded = (keys: string[]) => {
    if (keyword || onlySelected) setSearchExpanded(keys);
    else setExpanded(keys);
  };
  return (
    <section className="system-permissions" aria-label="权限配置">
      <div className="system-permission-toolbar">
        <Input
          aria-label="搜索权限"
          placeholder="搜索中英文名称或编码"
          allowClear
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSearchExpanded(null);
          }}
        />
        <Checkbox
          checked={onlySelected}
          onChange={(event) => {
            setOnlySelected(event.target.checked);
            setSearchExpanded(null);
          }}
        >
          仅看已选
        </Checkbox>
        <Button
          type="link"
          disabled={!visibleKeys.length}
          onClick={() => updateExpanded(allExpanded ? [] : visibleKeys)}
        >
          {allExpanded ? '收起全部' : '展开全部'}
        </Button>
      </div>
      <p className="system-muted">
        已选 {catalog.filter((permission) => selected.includes(permission.code)).length}/
        {catalog.length} 项；
        {disabled
          ? '当前为只读展示，悬停权限可查看中英文说明和编码。'
          : '按分组、页面和权限逐级展示，勾选分组可全选，悬停权限可查看中英文说明和编码。'}
      </p>
      <div className="system-permission-tree-panel">
        {treeData.length ? (
          <Tree
            aria-label="角色权限树"
            selectable={false}
            showLine={{ showLeafIcon: false }}
            expandedKeys={expandedKeys}
            onExpand={(keys) => updateExpanded(keys.map(String))}
            treeData={treeData}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配的权限" />
        )}
      </div>
    </section>
  );
}
