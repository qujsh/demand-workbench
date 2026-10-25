import { useQueries } from '@tanstack/react-query';
import { Image } from 'antd';
import { getTaskMediaMetadata, type PublicContent } from '../api/taskContentApi';
import { buildApiUrl } from '../../../shared/api/httpClient';
import { rewardLabel, unitLabels } from './publicationPreviewModel';
import { PublicProjectTree } from './PublicProjectTree';
import './taskContent.css';
export function PublicTaskPreview({
  content,
  categoryName,
  recruitCount,
  experience,
}: {
  content: PublicContent;
  categoryName: string;
  recruitCount: number;
  experience: string;
}) {
  const files = useQueries({
    queries: content.mediaNos.map((no) => ({
      queryKey: ['task-media', no],
      queryFn: ({ signal }: { signal: AbortSignal }) => getTaskMediaMetadata(no, signal),
      staleTime: Infinity,
    })),
  });
  const cover = content.coverMediaNo
    ? buildApiUrl(`/api/v1/task-media/content?mediaNo=${encodeURIComponent(content.coverMediaNo)}`)
    : undefined;
  return (
    <div className="publication-body">
      <small>{categoryName || '分类待选择'} · 发布后所有人可见</small>
      <h2>{content.title || '未填写任务标题'}</h2>
      <strong className="publication-reward">{rewardLabel(content)}</strong>
      <p className="publication-node-meta">
        {[
          { remote: '远程', onsite: '现场', hybrid: '混合' }[content.workMode],
          content.workMode !== 'remote' ? content.cityName : null,
          content.effort !== null
            ? `预计投入 ${content.effort}${unitLabels[content.effortUnit || ''] || ''}`
            : null,
          `承接人数 ${recruitCount} 人`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <section>
        <h3>任务介绍</h3>
        <p>{content.summary || '未填写任务简介'}</p>
      </section>
      {(cover || files.length > 0) && (
        <section>
          <h3>参考资料</h3>
          <Image.PreviewGroup>
            {cover && <Image src={cover} alt="任务封面" />}
            <div className="publication-media">
              {files.map((file, index) =>
                file.data?.type === 'image' ? (
                  <Image
                    key={content.mediaNos[index]}
                    src={buildApiUrl(file.data.previewUrl)}
                    alt="任务参考图片"
                  />
                ) : file.data?.type === 'video' ? (
                  <video
                    key={content.mediaNos[index]}
                    src={buildApiUrl(file.data.previewUrl)}
                    controls
                    preload="metadata"
                    poster={cover}
                  />
                ) : (
                  <p key={content.mediaNos[index]}>
                    {file.isError ? '媒体暂不可预览' : '正在读取媒体…'}
                  </p>
                ),
              )}
            </div>
          </Image.PreviewGroup>
        </section>
      )}
      {(content.budgetText || content.startDate || content.deadline) && (
        <section>
          <h3>报酬与时间安排</h3>
          {content.budgetText && <p>{content.budgetText}</p>}
          {content.startDate && <p>开始日期：{content.startDate}</p>}
          {content.deadline && <p>交付期限：{content.deadline}</p>}
        </section>
      )}
      {(['scope', 'deliverables', 'acceptance'] as const).map(
        (key, index) =>
          content[key].length > 0 && (
            <section key={key}>
              <h3>{['工作范围', '交付成果', '验收要求'][index]}</h3>
              <ul>
                {content[key].map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ),
      )}
      {(content.skills.length > 0 || content.newcomer || (experience && experience !== '不限')) && (
        <section>
          <h3>角色与技能</h3>
          <p>
            {[
              ...content.skills,
              experience !== '不限' ? experience : null,
              content.newcomer ? '新人可参与' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>
      )}
      {content.project && (
        <section className="publication-project">
          <h3>所属项目</h3>
          <h4>{content.project.title || content.title}</h4>
          {content.project.summary && <p>{content.project.summary}</p>}
          <h3>项目任务</h3>
          {content.project.tasks.length ? (
            <PublicProjectTree tasks={content.project.tasks} />
          ) : (
            <p>暂未发布项目任务</p>
          )}
        </section>
      )}
    </div>
  );
}
