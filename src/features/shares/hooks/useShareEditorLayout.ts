import { useEffect, useRef, useState } from 'react';

/** 独立管理编辑弹窗布局，监听在布局变化/卸载时清理。正文与草稿保留在编辑会话中。 */
export function useShareEditorLayout() {
  const [expanded, setExpanded] = useState(false);
  const [detached, setDetached] = useState(false);
  const [layoutNode, setLayoutNode] = useState<HTMLDivElement | null>(null);
  const [closeHidden, setCloseHidden] = useState(false);
  useEffect(() => {
    const modal = layoutNode?.closest('.share-editor-modal');
    if (!modal) return;
    let idle: ReturnType<typeof setTimeout>;
    const restore = () => {
      const button = modal.querySelector('.ant-modal-close')?.getBoundingClientRect();
      const editor = modal.querySelector('.share-rich-editor')?.getBoundingClientRect();
      setCloseHidden(
        Boolean(
          button &&
          editor &&
          editor.top < button.bottom + 8 &&
          editor.bottom > button.top &&
          editor.right > button.left,
        ),
      );
    };
    const onScroll = (event: Event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.matches('.share-modal-body, .share-editor-main')
      )
        return;
      setCloseHidden(true);
      clearTimeout(idle);
      idle = setTimeout(restore, 180);
    };
    modal.addEventListener('scroll', onScroll, true);
    idle = setTimeout(restore, 250);
    return () => {
      modal.removeEventListener('scroll', onScroll, true);
      clearTimeout(idle);
    };
  }, [expanded, detached, layoutNode]);

  const [editorPosition, setEditorPosition] = useState({ x: 16, y: 20 });
  const [detachedWidth, setDetachedWidth] = useState(360);
  const editorDragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const toggleDetached = () => {
    const dateLeft = document.querySelector('.share-date')?.getBoundingClientRect().left;
    setDetachedWidth(Math.min(400, Math.max(280, (dateLeft ?? 388) - 28), window.innerWidth - 24));
    setDetached((value) => !value);
    setExpanded(false);
    setEditorPosition({ x: 16, y: 20 });
  };
  return {
    setDetached,
    expanded,
    setExpanded,
    detached,
    setLayoutNode,
    closeHidden,
    editorPosition,
    setEditorPosition,
    detachedWidth,
    editorDragRef,
    toggleDetached,
  };
}
