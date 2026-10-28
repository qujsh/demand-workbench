import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';

export const requirementPlaceholder = `描述你想做的事、希望达到的效果，以及时间、地点等具体要求…

示例一：
我经营一家杭州的独立书店，想拍一组照片用于社交平台宣传。需要到店拍摄空间、书架和人物，并完成基础修图，希望下周能拿到成片。

示例二：
我们想给现有APP增加社区功能，让用户可以发布图文、点赞和评论。还需要后台审核帖子和评论，处理违规内容，希望能结合现有系统完成开发和测试。`;

export const requirementEditorExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    link: { openOnClick: false, autolink: false, protocols: ['https', 'http', 'mailto'] },
  }),
  Markdown.configure({ markedOptions: { breaks: true } }),
  Placeholder.configure({ placeholder: requirementPlaceholder }),
];
