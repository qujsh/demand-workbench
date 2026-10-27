import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Modal, Space, Tag } from 'antd';
import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
const interestSchema = z.object({
  id: z.number(),
  applicantId: z.number(),
  applicantName: z.string(),
  status: z.string(),
  statement: z.string(),
  confirmedVersion: z.number(),
  confirmationVersion: z.number(),
});
const statuses: Record<string, string> = {
  pending: '待处理',
  accepted: '已确认承接',
  rejected: '未选中',
  withdrawn: '已撤回',
};
export function RecruitmentManagement({ taskNo }: { taskNo: string }) {
  const client = useQueryClient(),
    [open, setOpen] = useState(false),
    [modal, holder] = Modal.useModal();
  const list = useQuery({
    queryKey: ['task-applicants', taskNo],
    enabled: open,
    queryFn: () =>
      requestJson(
        `/api/v1/task-interactions/applicants?taskNo=${encodeURIComponent(taskNo)}`,
        apiResponseSchema(z.array(interestSchema)),
      ),
  });
  const detail = useQuery({
    queryKey: ['task-recruitment', taskNo],
    queryFn: () =>
      requestJson(
        `/api/v1/public/tasks/detail?taskNo=${encodeURIComponent(taskNo)}`,
        apiResponseSchema(
          z.object({
            recruitmentStatus: z.string(),
            acceptedCount: z.number(),
            recruitCount: z.number(),
          }),
        ),
      ),
  });
  const mutation = useMutation({
    mutationFn: ({
      path,
      action,
      applicantId,
    }: {
      path: string;
      action: string;
      applicantId?: number;
    }) =>
      requestJson(`/api/v1/task-interactions/${path}`, apiResponseSchema(z.string()), {
        method: 'POST',
        body: JSON.stringify({ taskNo, action, applicantId }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['task-applicants', taskNo] });
      await client.invalidateQueries({ queryKey: ['task-recruitment', taskNo] });
    },
  });
  const status = detail.data?.recruitmentStatus;
  return (
    <section className="recruitment-management">
      {holder}
      <Space wrap>
        <strong>招募管理</strong>
        <Tag>
          {(
            { open: '招募中', paused: '暂停招募', full: '名额已满', ended: '已结束' } as Record<
              string,
              string
            >
          )[status || ''] || '读取中'}
        </Tag>
        <span>
          已确认 {detail.data?.acceptedCount ?? 0} / {detail.data?.recruitCount ?? '—'} 人
        </span>
        <Button onClick={() => setOpen(true)}>查看承接意向</Button>
        {status && status !== 'ended' && (
          <Button
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                path: 'recruitment',
                action: status === 'paused' ? 'open' : 'paused',
              })
            }
          >
            {status === 'paused' ? '恢复招募' : '停止招募'}
          </Button>
        )}
      </Space>
      <p className="publication-node-meta">
        有意向后修改工作、回报或时间等关键条件：先停止招募，修改草稿后重新发布；原申请人需要确认新条件。
      </p>
      {detail.error && <Alert type="error" title={detail.error.message} showIcon />}
      {mutation.error && <Alert type="error" title={mutation.error.message} showIcon />}
      <Modal title="承接意向" open={open} footer={null} onCancel={() => setOpen(false)} width={720}>
        {list.isPending ? (
          <p>正在加载…</p>
        ) : list.error ? (
          <Alert
            title={list.error.message}
            type="error"
            action={<Button onClick={() => list.refetch()}>重试</Button>}
          />
        ) : !list.data?.length ? (
          <Empty description="还没有人表达意向" />
        ) : (
          list.data.map((i) => (
            <article className="reward-edit-card" key={i.id}>
              <Space>
                <strong>{i.applicantName}</strong>
                <Tag>{statuses[i.status] || i.status}</Tag>
              </Space>
              <p style={{ whiteSpace: 'pre-wrap' }}>{i.statement}</p>
              {i.status === 'pending' && i.confirmedVersion < i.confirmationVersion && (
                <Alert type="warning" title="等待申请人确认最新条件，暂不能选择承接" />
              )}
              {i.status === 'pending' && (
                <Space>
                  <Button
                    type="primary"
                    disabled={status !== 'open' || i.confirmedVersion < i.confirmationVersion}
                    loading={mutation.isPending}
                    onClick={() =>
                      modal.confirm({
                        title: `确认由 ${i.applicantName} 承接？`,
                        content: '确认后占用一个招募名额。后续退出需人工协商。',
                        onOk: () =>
                          mutation.mutateAsync({
                            path: 'decide',
                            action: 'accept',
                            applicantId: i.applicantId,
                          }),
                      })
                    }
                  >
                    确认承接
                  </Button>
                  <Button
                    loading={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        path: 'decide',
                        action: 'reject',
                        applicantId: i.applicantId,
                      })
                    }
                  >
                    不选择
                  </Button>
                </Space>
              )}
            </article>
          ))
        )}
        {mutation.error && <Alert title={mutation.error.message} type="error" />}
      </Modal>
    </section>
  );
}
