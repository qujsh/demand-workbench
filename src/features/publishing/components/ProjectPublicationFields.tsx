import { Button } from 'antd';
import type { PublicProject } from '../api/taskContentApi';
import { PublicProjectTree } from './PublicProjectTree';
import { countProjectTasks } from './publicationPreviewModel';
export function ProjectPublicationFields({
  value,
  onRefresh,
}: {
  value: PublicProject;
  onRefresh: () => void;
}) {
  return (
    <section className="project-publication-fields">
      <h3>工作范围</h3>
      <p>以下内容随本次发布展示在 B、C 两端。内部需求原文、状态、依赖和附件不会自动公开。</p>
      <div className="publish-section-heading">
        <strong>拟公开的工作范围 · {countProjectTasks(value.tasks)} 项</strong>
        <Button size="small" onClick={onRefresh}>
          从整份 AI 拆解更新
        </Button>
      </div>
      {value.tasks.length ? (
        <PublicProjectTree tasks={value.tasks} />
      ) : (
        <p>尚无工作范围，请先完成 AI 拆解。</p>
      )}
    </section>
  );
}
