import type { ProjectTask } from '../api/taskContentApi';
const labels = { module: '模块', feature: '功能', work: '工作项', subtask: '子任务' };
export function PublicProjectTree({ tasks }: { tasks: ProjectTask[] }) {
  return (
    <div className="publication-project-tree">
      {tasks.map((task) => (
        <details key={task.id}>
          <summary>
            <span>{labels[task.type]}</span>
            <strong>{task.name}</strong>
          </summary>
          {task.description && <p>{task.description}</p>}
          {(task.role || task.startDate || task.endDate) && (
            <p className="publication-node-meta">
              {[
                task.role,
                task.startDate && `开始 ${task.startDate}`,
                task.endDate && `结束 ${task.endDate}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {!!task.children.length && <PublicProjectTree tasks={task.children} />}
        </details>
      ))}
    </div>
  );
}
