import { useState } from 'react';
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
  const [expanded, setExpanded] = useState(false);
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
    <div className="publication-body publication-detail-layout">
      <article>
        <small>{categoryName || '分类待选择'} · 发布后所有人可见</small>
        <h2>{content.title || '未填写任务标题'}</h2>

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
          <h3>任务简介</h3>
          <p>{content.summary || '未填写任务简介'}</p>
        </section>
        {content.details?.goal && (
          <section>
            <h3>任务目标</h3>
            <p>{content.details.goal}</p>
          </section>
        )}
        {!!content.project?.tasks.length && (
          <section>
            <h3>工作范围</h3>
            <p className="publication-node-meta">整份已确认的 AI 拆解；工作项不单独招募或计价。</p>
            <PublicProjectTree
              tasks={expanded ? content.project.tasks : content.project.tasks.slice(0, 3)}
            />
            {content.project.tasks.length > 3 && (
              <button className="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded ? '收起' : '展开全部工作范围'}
              </button>
            )}
          </section>
        )}
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
                  ) : file.data?.type === 'file' ? (
                    <a
                      key={content.mediaNos[index]}
                      href={buildApiUrl(file.data.previewUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      下载参考文件 ↗
                    </a>
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
        {(['deliverables'] as const).map(
          (key, index) =>
            content[key].length > 0 && (
              <section key={key}>
                <h3>{['交付成果'][index]}</h3>
                <ul>
                  {content[key].map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
            ),
        )}
        {(content.skills.length > 0 ||
          content.newcomer ||
          (experience && experience !== '不限')) && (
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
        {!!content.acceptance.length && (
          <details className="publication-acceptance">
            <summary>验收要求 · {content.acceptance.length} 项</summary>
            <ul>
              {content.acceptance.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </details>
        )}
        {content.details?.collaboration && (
          <section>
            <h3>时间与协作</h3>
            <p>{content.details.collaboration}</p>
          </section>
        )}
      </article>
      <aside className="publication-reward-card">
        <h3>回报内容</h3>
        {content.details?.rewards.length ? (
          content.details.rewards.map((r, i) => (
            <section key={i}>
              <small>{{ cash: '现金回报', goods: '物品交换', service: '服务交换' }[r.type]}</small>
              <h4>{r.title || '名称待填写'}</h4>
              {r.type === 'cash' ? (
                <strong className="publication-reward">
                  ¥{r.amountMin ?? '待填写'}
                  {r.pricing === 'range' ? `–${r.amountMax ?? '待填写'}` : ''} / {r.unit}
                </strong>
              ) : (
                r.type === 'goods' && (
                  <p>
                    {r.quantity} {r.unit} · {r.condition}
                  </p>
                )
              )}
              {r.description && <p>{r.description}</p>}
              {r.handover && <p>{r.handover}</p>}
            </section>
          ))
        ) : (
          <strong className="publication-reward">{rewardLabel(content)}</strong>
        )}
        <p>招募 {recruitCount} 人 · 表达意向不等于确认承接</p>
        <p className="publication-node-meta">
          预览模式，不提交意向；发布后与 C 端共用同一正式版本。
        </p>
      </aside>
    </div>
  );
}
