import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Form, Input, Space, Upload } from 'antd';
import { currentUserKey, saveProfile, type CurrentUser, type ProfileDraft } from '../api/authApi';
import { avatarUrl, uploadAvatar } from '../api/avatarApi';

export default function ProfileEditor({ user }: { user: CurrentUser }) {
  const [form] = Form.useForm<ProfileDraft>();
  const client = useQueryClient();
  const { message } = App.useApp();
  const draftAvatar = Form.useWatch('avatarMediaNo', form) ?? user.avatarMediaNo ?? '';
  const upload = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (no) => {
      form.setFieldValue('avatarMediaNo', no);
      void message.success('头像已上传，保存资料后生效');
    },
  });
  const save = useMutation({
    mutationFn: saveProfile,
    onSuccess: (updated) => {
      client.setQueryData(currentUserKey, updated);
      void client.invalidateQueries({ queryKey: ['account', 'users'] });
      void client.invalidateQueries({ queryKey: ['collaboration'] });
      form.setFieldsValue({
        nickname: updated.nickname,
        bio: updated.bio ?? '',
        avatarMediaNo: updated.avatarMediaNo ?? '',
      });
      void message.success('个人资料已保存');
    },
  });
  return (
    <section className="settings-section" aria-labelledby="profile-heading">
      <h2 id="profile-heading">个人资料</h2>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          nickname: user.nickname,
          bio: user.bio ?? '',
          avatarMediaNo: user.avatarMediaNo ?? '',
        }}
        onFinish={(values) =>
          save.mutate({ ...values, nickname: values.nickname.trim(), bio: values.bio.trim() })
        }
      >
        <Form.Item label="头像" extra="支持JPEG、PNG、WebP，最大5MB。上传后需保存资料。">
          <Space wrap size="middle">
            <Avatar size={64} src={avatarUrl(draftAvatar)}>
              {(user.nickname || '成员').slice(0, 1)}
            </Avatar>
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              disabled={upload.isPending || save.isPending}
              beforeUpload={(file) => {
                upload.mutate(file);
                return false;
              }}
            >
              <Button loading={upload.isPending} disabled={save.isPending}>
                上传头像
              </Button>
            </Upload>
          </Space>
        </Form.Item>
        <Form.Item name="avatarMediaNo" hidden>
          <Input />
        </Form.Item>
        {upload.isError && <Alert type="error" title={upload.error.message} showIcon />}
        <Form.Item
          name="nickname"
          label="昵称"
          rules={[
            { required: true, whitespace: true, message: '请输入昵称' },
            { max: 64, message: '昵称不能超过64个字符' },
          ]}
        >
          <Input maxLength={64} showCount placeholder="请输入昵称" disabled={save.isPending} />
        </Form.Item>
        <Form.Item
          name="bio"
          label="个人简介"
          rules={[{ max: 500, message: '个人简介不能超过500个字符' }]}
        >
          <Input.TextArea
            maxLength={500}
            showCount
            rows={4}
            placeholder="介绍一下自己、擅长的领域或协作偏好（选填）"
            disabled={save.isPending}
          />
        </Form.Item>
        {save.isError && <Alert type="error" title={save.error.message} showIcon />}
        <Button
          type="primary"
          htmlType="submit"
          loading={save.isPending}
          disabled={upload.isPending}
        >
          保存资料
        </Button>
      </Form>
    </section>
  );
}
