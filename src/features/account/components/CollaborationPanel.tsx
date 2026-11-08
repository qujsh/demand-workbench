import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Popconfirm, Select, Table } from 'antd';
import { Link } from 'react-router-dom';
import { memberNumber } from '../../../shared/identity/memberPresentation';
import { getMembers, saveMember, type MemberRole } from '../api/accountApi';
import { roleNames } from '../accountPresentation';

export default function CollaborationPanel({ requirementNo: no }: { requirementNo: string }) {
  const client = useQueryClient();
  const space = useQuery({ queryKey: ['collaboration', no], queryFn: ({ signal }) => getMembers(no, signal), enabled: !!no });
  const save = useMutation({ mutationFn: (input: { userNo: string; role: MemberRole | null }) => saveMember(no, input.userNo, input.role), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['collaboration', no] }), client.invalidateQueries({ queryKey: ['account', 'audits'] }), client.invalidateQueries({ queryKey: ['requirements'] })]);
  } });
  const canManage = space.data?.role === 'owner' || space.data?.role === 'manager';
  return <section className="settings-section">
    <h2>需求成员</h2>
    <p className="settings-subtitle">成员权限覆盖所选需求、拆解结果和工作项。只有负责人能够删除需求。</p>
    {space.isPending && <p>正在加载协作成员…</p>}
    {space.isError && <Alert type="error" title={space.error.message} />}
    {save.isError && <Alert type="error" title={save.error.message} showIcon />}
    {space.data && <>
      <p>你的角色：{roleNames[space.data.role]} · <Link to={`/requirements/${encodeURIComponent(no)}/analysis`}>打开需求</Link></p>
      <Table rowKey="userNo" size="small" dataSource={space.data.members} loading={space.isFetching} pagination={false} scroll={{ x: 460 }} columns={[
        { title: '成员编号', render: (_, member) => memberNumber(member) }, { title: '昵称', render: (_, member) => member.nickname || memberNumber(member) }, { title: '角色', dataIndex: 'role', render: (role: string) => roleNames[role] },
        ...(canManage ? [{ title: '操作', render: (_: unknown, member: { userNo: string; role: MemberRole }) => member.role === 'owner' || (space.data.role === 'manager' && member.role === 'manager') ? '—' : <Popconfirm title="移除该成员？" description="该成员将失去此需求的继承访问权限。" onConfirm={() => save.mutateAsync({ userNo: member.userNo, role: null }).catch(() => undefined)}><Button danger loading={save.isPending}>移除</Button></Popconfirm> }] : []),
      ]} />
      {canManage && <Form key={no} layout="vertical" initialValues={{ role: 'viewer' }} onFinish={(values: { userNo: string; role: MemberRole }) => save.mutate({ ...values, userNo: values.userNo.trim() })}>
        <Form.Item name="userNo" label="协作成员编号" rules={[{ required: true, whitespace: true }]}><Input placeholder="请输入对方已注册的成员编号（MEM-…）" /></Form.Item>
        <Form.Item name="role" label="协作角色"><Select options={(space.data.role === 'owner' ? ['manager', 'editor', 'viewer'] : ['editor', 'viewer']).map((role) => ({ value: role, label: roleNames[role] }))} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>添加或更新成员</Button>
      </Form>}
    </>}
  </section>;
}
