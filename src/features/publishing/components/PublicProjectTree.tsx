import type { ProjectTask } from '../api/taskContentApi';

function rows(tasks: ProjectTask[], prefix: string): { task: ProjectTask; number: string }[] {
  return tasks.flatMap((task, index) => {
    const number = `${prefix}.${index + 1}`;
    return [{ task, number }, ...rows(task.children, number)];
  });
}
export function PublicProjectTree({ tasks }: { tasks: ProjectTask[] }) {
  const overview =
    tasks.length === 1 && tasks[0].type === 'module' && tasks[0].children.length
      ? tasks[0]
      : undefined;
  const groups = overview?.children ?? tasks;
  const count = groups.reduce(
    (sum, group, index) =>
      sum +
      (group.children.length
        ? rows(group.children, String(index + 1)).filter((row) => !row.task.children.length).length
        : 1),
    0,
  );
  return (
    <div className="publication-project-tree scope-reader">
      <div className="scope-count">
        {groups.length} 个工作分组 · {count} 项具体工作
      </div>
      <div className="scope-groups">
        {groups.map((group, index) => (
          <div className="scope-group" key={group.id}>
            <div className="scope-header">
              <span className="scope-number">{String(index + 1).padStart(2, '0')}</span>
              <h4>{group.name}</h4>
            </div>
            {rows(group.children, String(index + 1)).map(({ task, number }) => (
              <div className="scope-row" key={task.id}>
                <span className="scope-index">{number}</span>
                <strong className="scope-name">{task.name}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
