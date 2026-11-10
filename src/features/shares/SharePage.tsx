import { useShareTimeline } from './hooks/useShareTimeline';
import { usePermissions } from '../account/hooks/usePermissions';
import { ShareRecordContent } from './ShareRecordContent';
import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Popover,
  Empty,
  Input,
  Segmented,
  Select,
  Tag,
} from 'antd';
import {
  CalendarDays,
  Check,
  Hash,
  PanelsTopLeft,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { type ShareRecord } from './shareModels';
import { useShares } from './hooks/useShares';
import { useShareEditingSession } from './hooks/useShareEditingSession';
import { ShareEditor } from './ShareEditor';
import { ShareTagAdd } from './ShareTagAdd';
import { ShareTagMergeProgress } from './ShareTagMergeProgress';
import { ShareTagMerge } from './ShareTagMerge';
import { ShareTagSorter } from './ShareTagSorter';
import { ShareFloating } from './ShareFloating';
import { useFloatingRecords } from './hooks/useFloatingRecords';
import './shares.css';

export default function SharePage() {
  const { message, modal } = App.useApp();
  const access = usePermissions();
  const [locateTag, setLocateTag] = useState<{ name: string } | null>(null);
  const [period, setPeriod] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [navigationYear, setNavigationYear] = useState(dayjs().format('YYYY'));
  const [browseDate, setBrowseDate] = useState('');
  const [openFloats, setOpenFloats] = useState<string[]>([]);
  const floating = useFloatingRecords();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('全部记录');
  const [tag, setTag] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [tagManager, setTagManager] = useState(false);
  const [mergingTags, setMergingTags] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [addedTag, setAddedTag] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);
  const status = filter === '草稿' ? 'DRAFT' : filter === '回收站' ? 'TRASH' : 'SAVED';
  const data = useShares({
    status,
    keyword: debouncedKeyword,
    tagNo: tag,
    visibility: visibility === 'all' ? '' : visibility.toUpperCase(),
    period,
    anchorDate,
  });
  const records = data.records.data?.pages.flatMap((page) => page.items) ?? [];
  const total = data.records.data?.pages[0]?.matchedCount ?? 0;
  const tags = data.tags.data?.tags.map((item) => item.name) ?? [];
  const periods = (data.periods.data?.years ?? []).map(({ year, months }) => ({
    label: `${year} 年`,
    options: [
      { value: year, label: `${year} 年 · 全年` },
      ...months.map((month) => ({ value: month, label: dayjs(month).format('YYYY 年 M 月') })),
    ],
  }));
  const reportError = (error: unknown) => {
    void message.error(error instanceof Error ? error.message : '操作失败，请重试');
  };
  const clearFilters = () => {
    setTag('');
    setKeyword('');
    setPeriod('');
    setVisibility('all');
  };
  const {
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
  } = useShareEditingSession(data, access.can, reportError, (record) => {
    setFilter(record.draft ? '草稿' : '全部记录');
    clearFilters();
  });
  const mergeTask = data.mergeTask.data?.task;
  const tagsLocked = Boolean(mergeTask && mergeTask.status !== 'COMPLETED');
  const observedMerge = useRef<string | null>(null);
  useEffect(() => {
    if (mergeTask && mergeTask.status !== 'COMPLETED') observedMerge.current = mergeTask.taskNo;
    if (mergeTask?.status === 'COMPLETED' && observedMerge.current === mergeTask.taskNo) {
      observedMerge.current = null;
      if (tag === mergeTask.sourceName) setTag(mergeTask.targetName);
      message.success(`已将 #${mergeTask.sourceName} 合并到 #${mergeTask.targetName}`);
    }
  }, [mergeTask, tag, message]);
  const writeTag = async (action: Parameters<typeof data.tagWrite.mutateAsync>[0]) => {
    try {
      await data.tagWrite.mutateAsync(action);
    } catch (error) {
      reportError(error);
      throw error;
    }
  };
  const hasFilters = Boolean(tag || keyword || period || visibility !== 'all');
  const openFloat = (id: string) =>
    setOpenFloats((ids) =>
      ids.includes(id) ? [...ids.filter((value) => value !== id), id] : [...ids, id],
    );
  const addFloating = async (record: ShareRecord) => {
    try {
      await floating.write.mutateAsync({ id: record.id });
      openFloat(record.id);
    } catch (error) {
      reportError(error);
    }
  };
  const { loadDirection, resetScrollAnchor } = useShareTimeline(
    records,
    data.records,
    setBrowseDate,
    reportError,
  );
  const locate = (date: string) => {
    resetScrollAnchor();
    setPeriod('');
    setAnchorDate(date);
    setBrowseDate(date);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const counts = (name: string) =>
    data.tags.data?.tags.find((item) => item.name === name)?.recordCount ?? 0;
  const filtered = records;
  const emptyDescription = hasFilters
    ? '没有找到符合条件的记录'
    : status === 'DRAFT'
      ? '暂无草稿'
      : status === 'TRASH'
        ? '回收站是空的'
        : '这里还没有记录';
  const content = (record: ShareRecord, full = false) => (
    <ShareRecordContent
      record={record}
      full={full}
      retrying={data.retryReview.isPending}
      canRetry={access.can('shares.edit')}
      onOpen={(value) => {
        void openRecord(value);
      }}
      onTag={(name) => {
        setTag(name);
        setDetail(null);
      }}
      onRetry={(value) => {
        void data.retryReview.mutateAsync(value).catch(reportError);
      }}
    />
  );

  return (
    <main className="shares-page">
      <div className="topbar">
        <span className="crumb">工作空间</span>
        <span className="share-crumb-divider">/</span>
        <span>分享管理</span>
        <span className="spacer" />
        <span className="share-demo-label">个人记录空间</span>
      </div>
      <div className="share-workspace">
        <header className="share-page-heading">
          <div>
            <h1>分享管理</h1>
            <p>记录当下的想法，让每一段经历都有迹可循。</p>
          </div>
          <Button
            type="primary"
            disabled={!access.can('shares.create')}
            icon={<Plus size={16} />}
            onClick={() => {
              setIncomingReferences([]);
              startNewRecord();
            }}
          >
            新建记录
          </Button>
        </header>
        <div className="share-layout">
          <section className="share-main">
            <button
              className="share-quick-entry"
              disabled={!access.can('shares.create')}
              onClick={() => {
                setIncomingReferences([]);
                startNewRecord();
              }}
            >
              <span className="share-write-icon">
                <PencilLine size={22} />
              </span>
              <span>
                <strong>今天，有什么值得记录的？</strong>
                <small>一个想法、一段经历，或是刚刚完成的小事……</small>
              </span>
            </button>
            <div className="share-list-toolbar">
              <Segmented
                styles={{ item: { margin: 0 } }}
                value={filter}
                options={['全部记录', '草稿', '回收站']}
                onChange={setFilter}
              />
              <div className="share-toolbar-right">
                <Input
                  aria-label="搜索记录"
                  placeholder="搜索记录"
                  prefix={<Search size={15} />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  allowClear
                />
                <Select
                  aria-label="筛选可见范围"
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: 'all', label: '可见范围：全部' },
                    { value: 'private', label: '仅自己可见' },
                    { value: 'public', label: '公开分享' },
                  ]}
                />
                <Button
                  className="share-mobile-tags"
                  disabled={!access.can('shares.edit')}
                  aria-label="管理标签"
                  icon={<SlidersHorizontal size={16} />}
                  onClick={() => setTagManager(true)}
                />
              </div>
            </div>
            <div className="share-time-navigation">
              <span>
                {status === 'DRAFT' ? '草稿更新时间' : status === 'TRASH' ? '移入时间' : '记录时间'}{' '}
                <small>
                  共 {total} 条{hasFilters ? '相关' : ''}记录
                </small>
              </span>
              <div className="share-time-actions">
                <Popover
                  trigger="click"
                  title="定位时间（可上下连续浏览）"
                  content={
                    <div className="share-locate-panel">
                      <Select
                        aria-label="定位年份"
                        value={navigationYear}
                        onChange={setNavigationYear}
                        options={[
                          ...new Set([
                            navigationYear,
                            ...(data.periods.data?.years ?? []).map((item) => item.year),
                          ]),
                        ]
                          .sort()
                          .reverse()
                          .map((year) => ({ value: year, label: `${year} 年` }))}
                      />
                      <div className="share-locate-months">
                        {Array.from({ length: 12 }, (_, index) => {
                          const month = `${navigationYear}-${String(index + 1).padStart(2, '0')}`;
                          const exists = data.periods.data?.years
                            .find((item) => item.year === navigationYear)
                            ?.months.includes(month);
                          return (
                            <Button
                              key={month}
                              disabled={!exists}
                              onClick={() => locate(`${month}-01`)}
                            >
                              {index + 1}月
                            </Button>
                          );
                        })}
                      </div>
                      <DatePicker
                        aria-label="定位具体日期"
                        placeholder="定位到某一天"
                        value={anchorDate ? dayjs(anchorDate) : null}
                        onChange={(value) => {
                          if (value) locate(value.format('YYYY-MM-DD'));
                          else setAnchorDate('');
                        }}
                      />
                      <Button type="link" onClick={() => locate(dayjs().format('YYYY-MM-DD'))}>
                        回到今天
                      </Button>
                    </div>
                  }
                >
                  <Button>定位时间</Button>
                </Popover>
                <Select
                  aria-label="记录年月"
                  value={period}
                  onChange={(value) => {
                    setAnchorDate('');
                    setPeriod(value);
                  }}
                  options={[{ value: '', label: '限定年月：不限' }, ...periods]}
                />
              </div>
            </div>
            {anchorDate && (
              <div className="share-browse-hint">
                已定位 {anchorDate} · 上滑查看更新记录，下滑查看更早记录
                {browseDate && <span>当前浏览：{browseDate}</span>}
                {(data.records.data?.pageParams[0] as { cursor?: string } | undefined)?.cursor ===
                  '' &&
                  data.records.data?.pages[0]?.exactDate === false && (
                    <small>当天没有记录，已展示附近日期。</small>
                  )}
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    setAnchorDate('');
                    window.scrollTo({ top: 0 });
                  }}
                >
                  返回最新
                </Button>
              </div>
            )}
            {hasFilters && (
              <div className="share-filter-summary">
                <div>
                  {tag && (
                    <Tag closable onClose={() => setTag('')}>
                      # {tag}
                    </Tag>
                  )}
                  {keyword && <span>搜索：{keyword}</span>}
                  {period && (
                    <span>
                      {period.length === 4 ? `${period} 年` : dayjs(period).format('YYYY 年 M 月')}
                    </span>
                  )}
                  {visibility !== 'all' && (
                    <span>{visibility === 'private' ? '仅自己可见' : '公开分享'}</span>
                  )}
                  <span>已筛选 · 共 {total} 条相关记录</span>
                </div>
                <Button type="link" size="small" onClick={clearFilters}>
                  清除筛选
                </Button>
              </div>
            )}
            <div className="share-timeline">
              {data.records.hasPreviousPage && (
                <Button
                  loading={data.records.isFetchingPreviousPage}
                  onClick={() => {
                    void loadDirection('newer');
                  }}
                >
                  加载更新的记录 ↑
                </Button>
              )}
              {data.records.isError && (
                <Alert
                  type="error"
                  showIcon
                  title="记录加载失败"
                  description={data.records.error.message}
                  action={
                    <Button
                      onClick={() => {
                        void data.records.refetch();
                      }}
                    >
                      重试
                    </Button>
                  }
                />
              )}
              {data.records.isLoading && <p role="status">正在加载记录…</p>}
              {!data.records.isLoading && !data.records.isError && filtered.length === 0 && (
                <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  {hasFilters ? (
                    <Button onClick={clearFilters}>清除筛选</Button>
                  ) : status === 'SAVED' && access.can('shares.create') ? (
                    <Button
                      onClick={() => {
                        setIncomingReferences([]);
                        startNewRecord();
                      }}
                    >
                      写下第一条记录
                    </Button>
                  ) : (
                    <span>
                      {status === 'DRAFT'
                        ? '保存为草稿的内容会显示在这里，方便下次继续编辑。'
                        : '移入回收站的记录会显示在这里，可随时恢复。'}
                    </span>
                  )}
                </Empty>
              )}
              {filtered.map((record, index) => {
                const month = dayjs(record.timelineDate ?? record.date).format('YYYY 年 M 月');
                return (
                  <div key={record.id}>
                    {(index === 0 ||
                      dayjs(filtered[index - 1].timelineDate ?? filtered[index - 1].date).format(
                        'YYYY-MM',
                      ) !== dayjs(record.timelineDate ?? record.date).format('YYYY-MM')) && (
                      <div className="share-month">
                        <span>{month}</span>
                        <span className="share-month-rule" />
                      </div>
                    )}
                    <article
                      className="share-record"
                      data-share-record={record.id}
                      data-share-date={dayjs(record.timelineDate ?? record.date).format(
                        'YYYY-MM-DD',
                      )}
                    >
                      <div className="share-date">
                        <strong>{dayjs(record.timelineDate ?? record.date).format('DD')}</strong>
                        <span>{dayjs(record.timelineDate ?? record.date).format('M月 · ddd')}</span>
                        <i />
                      </div>
                      <div
                        className="share-record-content"
                        onClick={(event) => {
                          if (
                            !(event.target instanceof Element) ||
                            event.target.closest('button,a,.ant-image') ||
                            window.getSelection()?.toString()
                          )
                            return;
                          void openRecord(record);
                        }}
                      >
                        <header>
                          <span className="share-record-time">
                            {dayjs(record.timelineDate ?? record.date).format('HH:mm')}
                            {record.draft && ' · 草稿'}
                          </span>
                          <div className="share-record-actions" role="group" aria-label="记录操作">
                            {record.deleted ? (
                              <Button
                                type="text"
                                size="small"
                                disabled={!access.can('shares.delete')}
                                icon={<Check size={14} />}
                                onClick={() => {
                                  void data.change
                                    .mutateAsync({ record, restore: true })
                                    .catch(reportError);
                                }}
                              >
                                恢复记录
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="text"
                                  size="small"
                                  disabled={!access.can('shares.edit')}
                                  icon={<PencilLine size={14} />}
                                  onClick={() => {
                                    void openRecord(record, true);
                                  }}
                                >
                                  编辑记录
                                </Button>
                                {!record.draft && (
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<PanelsTopLeft size={14} />}
                                    onClick={() => {
                                      void addFloating(record);
                                    }}
                                  >
                                    加入浮窗
                                  </Button>
                                )}
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  disabled={!access.can('shares.delete')}
                                  icon={<Trash2 size={14} />}
                                  onClick={() => remove(record)}
                                >
                                  移入回收站
                                </Button>
                              </>
                            )}
                          </div>
                        </header>
                        {record.title && (
                          <button
                            className="share-record-title"
                            onClick={() => {
                              void openRecord(record);
                            }}
                          >
                            {record.title}
                          </button>
                        )}
                        <div>{content(record)}</div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
            {data.records.hasNextPage && (
              <Button
                loading={data.records.isFetchingNextPage}
                onClick={() => {
                  void loadDirection('older');
                }}
              >
                加载更多
              </Button>
            )}
            {filtered.length > 0 && (
              <div className="share-end">
                每一条记录，都是走过的痕迹。<span>共 {total} 条记录</span>
              </div>
            )}
          </section>
          <aside className="share-aside">
            <div className="share-aside-title">
              <h2>我的标签</h2>
              {tagsLocked && (
                <Button
                  type="link"
                  size="small"
                  disabled={!access.can('shares.edit')}
                  onClick={() => setTagManager(true)}
                >
                  {mergeTask?.status === 'FAILED'
                    ? '合并待重试'
                    : mergeTask?.status === 'QUEUED'
                      ? '合并排队中'
                      : `合并中 ${mergeTask?.progress}%`}
                </Button>
              )}
              <Button
                type="text"
                size="small"
                disabled={!access.can('shares.edit')}
                aria-label="打开标签管理"
                onClick={() => setTagManager(true)}
              >
                管理标签
              </Button>
            </div>
            <button
              className={`share-tag-row ${!tag ? 'selected' : ''}`}
              onClick={() => setTag('')}
            >
              <Hash size={16} />
              <span>全部记录</span>
              <small>{data.tags.data?.recordCount ?? 0}</small>
            </button>
            {data.tags.isError && (
              <Alert
                type="error"
                title="标签加载失败"
                action={
                  <Button
                    onClick={() => {
                      void data.tags.refetch();
                    }}
                  >
                    重试
                  </Button>
                }
              />
            )}
            <div className="share-tag-list-heading">全部标签 · {tags.length}</div>
            <div
              className={`share-home-tags${tags.length > 16 ? ' is-two-columns' : ''}`}
              style={
                tags.length > 16
                  ? { gridTemplateRows: `repeat(${Math.ceil(tags.length / 2)}, auto)` }
                  : undefined
              }
            >
              {tags.map((name) => (
                <button
                  className={`share-tag-row ${tag === name ? 'selected' : ''}`}
                  key={name}
                  onClick={() => setTag(name)}
                >
                  <Hash size={15} />
                  <span>{name}</span>
                  <small>{counts(name)}</small>
                </button>
              ))}
            </div>
            <ShareFloating
              floating={floating}
              openIds={openFloats}
              onOpen={openFloat}
              onClose={(id) => setOpenFloats((ids) => ids.filter((value) => value !== id))}
              editing={Boolean(editor)}
              onReference={(refs, target) => {
                void attachReferences(refs, target);
              }}
              onError={reportError}
            />
            <div className="share-personal-note">
              <div className="share-personal-note-heading">
                <CalendarDays size={19} />
                <h3>给时间一点痕迹</h3>
              </div>
              <p>
                不必等到有了成果才记录。
                <br />
                每一个想法、每一次尝试，都值得留下。
              </p>
              <span>慢慢积累，自然生长。</span>
            </div>
          </aside>
        </div>
      </div>
      {editor && (
        <ShareEditor
          tagsLocked={tagsLocked}
          floating={floating}
          openFloatingIds={openFloats}
          key={editor === 'new' ? 'new' : editor.id}
          incomingReferences={incomingReferences}
          onOpenReference={openFloat}
          record={editor === 'new' ? undefined : editor}
          tags={tags}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      <Drawer
        title="记录详情"
        open={Boolean(detail)}
        width={720}
        onClose={() => setDetail(null)}
        extra={
          detail &&
          !detail.deleted && (
            <Button
              disabled={!access.can('shares.edit')}
              icon={<PencilLine size={14} />}
              onClick={() => {
                void openRecord(detail, true);
                setDetail(null);
              }}
            >
              编辑
            </Button>
          )
        }
      >
        {detail && (
          <div className="share-detail">
            <span>{dayjs(detail.date).format('YYYY 年 M 月 D 日 HH:mm')}</span>
            <h2>{detail.title || '一条记录'}</h2>
            {content(detail, true)}
            {detail.references?.length ? (
              <div className="share-reference-list">
                <strong>关联记录</strong>
                {detail.references.map((ref) => (
                  <Button
                    type="link"
                    key={ref.recordNo}
                    disabled={ref.unavailable}
                    onClick={() => openFloat(ref.recordNo)}
                  >
                    {ref.title || '一条记录'} ↗
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Drawer>
      <Drawer
        title="管理标签"
        open={tagManager}
        width={400}
        onClose={() => {
          if (!data.tagWrite.isPending) {
            setTagManager(false);
            setMergingTags(false);
            setMergeSelection([]);
          }
        }}
      >
        {data.mergeTask.isPending ? (
          <p>正在检查标签任务…</p>
        ) : data.mergeTask.isError ? (
          <Alert
            type="error"
            title="标签任务状态加载失败"
            action={<Button onClick={() => void data.mergeTask.refetch()}>重试</Button>}
          />
        ) : tagsLocked && mergeTask ? (
          <ShareTagMergeProgress
            task={mergeTask}
            retrying={data.retryMerge.isPending}
            onRetry={() => data.retryMerge.mutate(mergeTask.taskNo, { onError: reportError })}
          />
        ) : (
          <>
            <p className="share-tag-intro">
              {mergingTags ? '依次选择两个标签，先选的合并到后选的标签中' : '上下拖动标签调整顺序'}
            </p>
            <div
              aria-busy={data.tagWrite.isPending}
              style={data.tagWrite.isPending ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
            >
              {mergingTags ? (
                <ShareTagMerge
                  selection={mergeSelection}
                  pending={data.tagWrite.isPending}
                  onCancel={() => {
                    setMergingTags(false);
                    setMergeSelection([]);
                  }}
                  onMerge={async () => {
                    const [source, target] = mergeSelection;
                    if (!source || !target) return;
                    await writeTag({ kind: 'merge', source, target });
                    message.info('合并任务已提交，可关闭面板等待完成');
                    setMergingTags(false);
                    setMergeSelection([]);
                  }}
                />
              ) : (
                <ShareTagAdd
                  onStartMerge={() => {
                    setMergingTags(true);
                    setMergeSelection([]);
                  }}
                  tags={tags}
                  count={counts}
                  onLocate={(name) => setLocateTag({ name })}
                  onAdd={async (name) => {
                    if (data.tagWrite.isPending) return;
                    await writeTag({ kind: 'add', name });
                    setAddedTag(name);
                  }}
                />
              )}
              <ShareTagSorter
                selection={mergingTags ? mergeSelection : undefined}
                onSelect={(name, checked) =>
                  setMergeSelection((current) =>
                    checked
                      ? current.length < 2 && !current.includes(name)
                        ? [...current, name]
                        : current
                      : current.filter((value) => value !== name),
                  )
                }
                locateTag={locateTag}
                addedTag={addedTag}
                tags={tags}
                count={counts}
                onOrder={(names) => {
                  if (!data.tagWrite.isPending)
                    void writeTag({ kind: 'order', names }).catch(() => undefined);
                }}
                onDelete={(name) =>
                  modal.confirm({
                    title: `删除标签「${name}」？`,
                    content: '只移除标签，不会删除任何记录。',
                    okText: '删除标签',
                    cancelText: '取消',
                    onOk: async () => {
                      await writeTag({ kind: 'delete', name });
                      if (tag === name) setTag('');
                    },
                  })
                }
              />
            </div>
          </>
        )}
      </Drawer>
    </main>
  );
}
