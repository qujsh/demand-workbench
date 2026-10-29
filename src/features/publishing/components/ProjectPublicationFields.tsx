import type { PublicProject } from '../api/taskContentApi';
import { PublicProjectTree } from './PublicProjectTree';
import { countProjectTasks } from './publicationPreviewModel';
export function ProjectPublicationFields({ value }: { value: PublicProject }) {
  return (
    <section className="project-publication-fields">
      <div className="project-scope-heading">
        <h3>
          工作范围 <span>· {countProjectTasks(value.tasks)} 项</span>
        </h3>
      </div>
      {value.tasks.length ? (
        <PublicProjectTree tasks={value.tasks} />
      ) : (
        <p>尚无工作范围，请先完成 AI 拆解。</p>
      )}
    </section>
  );
}
