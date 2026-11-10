import { useState } from 'react';
import { App } from 'antd';
import { getShare } from '../api/shareApi';
import type { ShareRecord, ShareReference } from '../shareModels';
import type { useShares } from './useShares';

/** 编辑/详情会话保留在页面挂载周期内；只有保存成功才关闭编辑器并重置筛选。 */
export function useShareEditingSession(
  data: Pick<ReturnType<typeof useShares>, 'save' | 'change'>,
  can: (permission: string) => boolean,
  reportError: (error: unknown) => void,
  onSaved: (record: ShareRecord) => void,
) {
  const { message, modal } = App.useApp();
  const [incomingReferences, setIncomingReferences] = useState<ShareReference[]>([]);
  const [editor, setEditor] = useState<ShareRecord | 'new' | null>(null);
  const [detail, setDetail] = useState<ShareRecord | null>(null);
  const startNewRecord = () => {
    if (!can('shares.create')) {
      void message.warning('暂无新建分享权限');
      return;
    }
    if (editor) {
      void message.info('请先保存或关闭当前编辑器');
      return;
    }
    setIncomingReferences([]);
    setEditor('new');
  };
  const openRecord = async (record: ShareRecord, editing = false) => {
    if (editing && !can('shares.edit')) {
      void message.warning('暂无编辑分享权限');
      return;
    }
    if (editing && editor) {
      void message.info('请先保存或关闭当前编辑器');
      return;
    }
    try {
      const full = await getShare(record.id, editing);
      if (editing) {
        setIncomingReferences([]);
        setEditor(full);
      } else setDetail(full);
    } catch (error) {
      reportError(error);
    }
  };
  const attachReferences = async (refs: ShareReference[], target: string) => {
    if (!can(target === 'new' ? 'shares.create' : 'shares.edit')) {
      void message.warning('暂无引用写入权限');
      return;
    }
    if (target === 'current' && editor) {
      setIncomingReferences((values) => [...values, ...refs]);
      return;
    }
    if (editor) {
      void message.info('请先保存或关闭当前编辑器，或引用到当前记录');
      return;
    }
    if (target === 'new') {
      setIncomingReferences(refs);
      setEditor('new');
      return;
    }
    try {
      const record = await getShare(target, true);
      setIncomingReferences(refs.filter((ref) => ref.recordNo !== target));
      setEditor(record);
    } catch (error) {
      reportError(error);
    }
  };
  const save = async (record: ShareRecord) => {
    try {
      await data.save.mutateAsync(record);
      setEditor(null);
      onSaved(record);
      void message.success(
        record.draft
          ? '草稿已保存'
          : record.visibility === 'public'
            ? '已保存，公开内容需审核通过后可见'
            : '记录已保存',
      );
    } catch (error) {
      reportError(error);
      throw error;
    }
  };
  const remove = (record: ShareRecord) =>
    modal.confirm({
      title: '将这条记录移入回收站？',
      content: '可以在回收站中恢复。',
      okText: '移入回收站',
      cancelText: '取消',
      onOk: async () => {
        try {
          await data.change.mutateAsync({ record, restore: false });
          setDetail(null);
        } catch (error) {
          reportError(error);
          throw error;
        }
      },
    });
  return {
    editor,
    setEditor,
    detail,
    setDetail,
    incomingReferences,
    setIncomingReferences,
    startNewRecord,
    openRecord,
    attachReferences,
    save,
    remove,
  };
}
