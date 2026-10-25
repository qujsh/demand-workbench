import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Popconfirm, Select, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listRequirements } from '../../requirements';
import { getMembers, saveMember, type MemberRole } from '../api/accountApi';
import { roleNames } from '../accountPresentation';

export default function CollaborationPanel() {
  const [no, setNo] = useState('');
  const client = useQueryClient();
  const requirements = useQuery({ queryKey: ['requirements'], queryFn: ({ signal }) => listRequirements(signal) });
  const space = useQuery({ queryKey: ['collaboration', no], queryFn: ({ signal }) => getMembers(no, signal), enabled: !!no });
  const save = useMutation({ mutationFn: (input: { userNo: string; role: MemberRole | null }) => saveMember(no, input.userNo, input.role), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['collaboration', no] }), client.invalidateQueries({ queryKey: ['account', 'audits'] }), client.invalidateQueries({ queryKey: ['requirements'] })]);
  } });
  const canManage = space.data?.role === 'owner' || space.data?.role === 'manager';
  return <section className="settings-section">
    <h2>需求协作权限</h2>
    <p className="settings-subtitle">成员权限覆盖所选需求、拆解结果和工作项。只有负责人能够删除需求。</p>
    <Select aria-label="选择协作需求" placeholder="选择一个已保存的需求" value={no || undefined} onChange={setNo} loading={requirements.isPending} showSearch optionFilterProp="label" style={{ width: '100%' }} options={requirements.data?.map((requirement) => ({ value: requirement.requirementNo, label: `${requirement.title} · ${requirement.requirementNo}` }))} />
    {requirements.isError && <Alert type="error" title={requirements.error.message} />}
    {space.isError && <Alert type="error" title={space.error.message} />}
    {save.isError && <Alert type="error" title={save.error.message} showIcon />}
    {space.data && <>
      <p>你的角色：{roleNames[space.data.role]} · <Link to={`/requirements/${encodeURIComponent(no)}/analysis`}>打开需求</Link></p>
      <Table rowKey="userNo" size="small" dataSource={space.data.members} loading={space.isFetching} pagination={false} scroll={{ x: 460 }} columns={[
        { title: '账号', dataIndex: 'userNo' }, { title: '昵称', dataIndex: 'nickname' }, { title: '角色', dataIndex: 'role', render: (role: string) => roleNames[role] },
        ...(canManage ? [{ title: '操作', render: (_: unknown, member: { userNo: string; role: MemberRole }) => member.role === 'owner' || (space.data.role === 'manager' && member.role === 'manager') ? '—' : <Popconfirm title="移除该成员？" description="该账号将失去此需求的继承访问权限。" onConfirm={() => save.mutateAsync({ userNo: member.userNo, role: null }).catch(() => undefined)}><Button danger loading={save.isPending}>移除</Button></Popconfirm> }] : []),
      ]} />
      {canManage && <Form key={no} layout="vertical" initialValues={{ role: 'viewer' }} onFinish={(values: { userNo: string; role: MemberRole }) => save.mutate(values)}>
        <Form.Item name="userNo" label="协作账号编号" rules={[{ required: true, whitespace: true }]}><Input placeholder="请输入对方已注册的账号编号" /></Form.Item>
        <Form.Item name="role" label="协作角色"><Select options={(space.data.role === 'owner' ? ['manager', 'editor', 'viewer'] : ['editor', 'viewer']).map((role) => ({ value: role, label: roleNames[role] }))} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>添加或更新成员</Button>
      </Form>}
    </>}
  </section>;
}
