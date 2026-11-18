import { useState } from 'react';
import { App } from 'antd';
import { getNote } from '../api/noteApi';
import type { NoteRecord, NoteReference } from '../noteModels';
import type { useNotes } from './useNotes';

/** 编辑/详情会话保留在页面挂载周期内；只有保存成功才关闭编辑器并重置筛选。 */
export function useNoteEditingSession(
  data: Pick<ReturnType<typeof useNotes>, 'save' | 'change'>,
  can: (permission: string) => boolean,
  reportError: (error: unknown) => void,
  onSaved: (record: NoteRecord) => void,
) {
  const { message, modal } = App.useApp();
  const [incomingReferences, setIncomingReferences] = useState<NoteReference[]>([]);
  const [editor, setEditor] = useState<NoteRecord | 'new' | null>(null);
  const [detail, setDetail] = useState<NoteRecord | null>(null);
  const startNewRecord = () => {
    if (!can('notes.create')) {
      void message.warning('暂无新建笔记权限');
      return;
    }
    if (editor) {
      void message.info('请先保存或关闭当前编辑器');
      return;
    }
    setIncomingReferences([]);
    setEditor('new');
  };
  const openRecord = async (record: NoteRecord, editing = false) => {
    if (editing && !can('notes.edit')) {
      void message.warning('暂无编辑笔记权限');
      return;
    }
    if (editing && editor) {
      void message.info('请先保存或关闭当前编辑器');
      return;
    }
    try {
      const full = await getNote(record.id, editing);
      if (editing) {
        setIncomingReferences([]);
        setEditor(full);
      } else setDetail(full);
    } catch (error) {
      reportError(error);
    }
  };
  const attachReferences = async (refs: NoteReference[], target: string) => {
    if (!can(target === 'new' ? 'notes.create' : 'notes.edit')) {
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
      const record = await getNote(target, true);
      setIncomingReferences(refs.filter((ref) => ref.recordNo !== target));
      setEditor(record);
    } catch (error) {
      reportError(error);
    }
  };
  const save = async (record: NoteRecord) => {
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
  const remove = (record: NoteRecord) =>
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
