import { useState } from 'react';
import { Alert, Button, Modal, Select, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getPublishVersion, getPublishVersions } from '../api/publishTaskApi';
import './taskContent.css';
import { PublicTaskPreview } from './PublicTaskPreview';
import { useQuery as useCategoriesQuery } from '@tanstack/react-query';
import { getTaskCategories } from '../api/taskContentApi';
export function PublicationHistory({
  requirementNo,
  version,
  hasDraft,
}: {
  requirementNo: string;
  version: number;
  hasDraft: boolean;
}) {
  const [selected, setSelected] = useState<number>();
  const versions = useQuery({
    queryKey: ['publish-versions', requirementNo],
    queryFn: ({ signal }) => getPublishVersions(requirementNo, signal),
  });
  const snapshot = useQuery({
    queryKey: ['publish-version', requirementNo, selected],
    queryFn: ({ signal }) => getPublishVersion(requirementNo, selected!, signal),
    enabled: selected !== undefined,
  });
  const data = snapshot.data;
  const categories = useCategoriesQuery({
    queryKey: ['task-categories'],
    queryFn: ({ signal }) => getTaskCategories(signal),
  });
  return (
    <section className="publication-history">
      <h3>发布版本</h3>
      <p>
        {version
          ? `当前正式版本 V${version}。${hasDraft ? '有编辑草稿，承接者仍查看正式版本。' : '尚无未发布草稿。'}`
          : '尚未正式发布。保存草稿不会展示给承接者。'}
      </p>
      {versions.isError ? (
        <Alert
          type="error"
          title={versions.error.message}
          action={<Button onClick={() => void versions.refetch()}>重试</Button>}
        />
      ) : (
        <Select
          aria-label="查看历史发布版本"
          placeholder="查看历史发布版本"
          style={{ width: '100%', maxWidth: 420 }}
          loading={versions.isPending}
          value={selected}
          options={versions.data?.map((item) => ({
            value: item.version,
            label: `V${item.version} · ${item.title} · ${item.publishedAt.replace('T', ' ')}`,
          }))}
          onChange={setSelected}
        />
      )}
      <Modal
        title={`正式发布版本 V${selected ?? ''}`}
        open={selected !== undefined}
        onCancel={() => setSelected(undefined)}
        footer={<Button onClick={() => setSelected(undefined)}>关闭</Button>}
        width={1120}
      >
        {snapshot.isPending ? (
          <Spin />
        ) : snapshot.isError ? (
          <Alert type="error" title={snapshot.error.message} />
        ) : (
          data && (
            <>
              {data.content ? (
                <PublicTaskPreview
                  content={data.content}
                  categoryName={
                    categories.data?.find((c) => c.code === data.category)?.name || data.category
                  }
                  recruitCount={data.recruitCount}
                  experience={data.experience}
                />
              ) : (
                <>
                  <h3>{data.title}</h3>
                  <p>{data.summary}</p>
                </>
              )}
              <p>此处只读查看正式快照，不会修改当前草稿。</p>
            </>
          )
        )}
      </Modal>
    </section>
  );
}
