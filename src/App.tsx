import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Icon } from './components/Icons';
import type { Requirement, WorkItemNode } from './shared/types/workItem';
import { useSaveRequirement } from './features/requirements/hooks/useSaveRequirement';
import { stageLabels, useRequirements } from './features/requirements/hooks/useRequirements';
import { useDeleteRequirement } from './features/requirements/hooks/useDeleteRequirement';
import { useCancelPublishTask } from './features/publishing/hooks/useCancelPublishTask';
import { isPersistedRequirement } from './features/requirements/api/requirementApi';
import { ApiError } from './shared/api/httpClient';

const RequirementList = lazy(() => import('./components/RequirementList'));
const AnalysisWorkbench = lazy(() => import('./components/AnalysisWorkbench'));
const Planning = lazy(() => import('./components/Planning'));
const PublishWizard = lazy(() => import('./components/PublishWizard'));
const SettingsPage = lazy(() => import('./features/auth/pages/SettingsPage'));

type View = 'requirements' | 'analysis' | 'planning' | 'publishing' | 'settings';

const flattenNodes = (nodes: WorkItemNode[]): WorkItemNode[] =>
  nodes.flatMap((node) => [node, ...flattenNodes(node.children || [])]);

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [workItemsByRequirement, setWorkItemsByRequirement] = useState<
    Record<string, WorkItemNode[]>
  >({});
  const [selected, setSelected] = useState<WorkItemNode[]>([]);
  const [toast, setToast] = useState('');
  const saveRequirementMutation = useSaveRequirement();
  const deleteRequirementMutation = useDeleteRequirement();
  const cancelPublishTaskMutation = useCancelPublishTask();
  const requirementsQuery = useRequirements();

  useEffect(() => {
    if (requirementsQuery.data) setRequirements(requirementsQuery.data);
  }, [requirementsQuery.data]);

  const routeMatch =
    matchPath('/requirements/:requirementId/analysis', location.pathname) ||
    matchPath('/requirements/:requirementId/planning', location.pathname) ||
    matchPath('/requirements/:requirementId/publish', location.pathname);
  const requirementId = routeMatch?.params.requirementId;
  const requirement = useMemo(
    () => requirements.find((item) => item.id === requirementId) ?? requirements[0],
    [requirementId, requirements],
  );
  const modules = requirement ? (workItemsByRequirement[requirement.id] ?? []) : [];
  const setModules = useCallback(
    (next: WorkItemNode[] | ((current: WorkItemNode[]) => WorkItemNode[])) => {
      setWorkItemsByRequirement((current) => {
        if (!requirement) return current;
        const previous = current[requirement.id] ?? [];
        return {
          ...current,
          [requirement.id]: typeof next === 'function' ? next(previous) : next,
        };
      });
    },
    [requirement],
  );
  const view: View = location.pathname === '/settings' ? 'settings' : location.pathname.endsWith('/analysis')
    ? 'analysis'
    : location.pathname.endsWith('/planning')
      ? 'planning'
      : location.pathname.endsWith('/publish')
        ? 'publishing'
        : 'requirements';

  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setToast(message);
      window.setTimeout(() => setToast(''), 2400);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  const openRequirement = (item: Requirement) => navigate(`/requirements/${item.id}/analysis`);
  const openPublishing = async (
    source: Requirement,
    items: WorkItemNode[] = [],
    patch: Partial<Requirement> = {},
  ) => {
    const pendingRequirement = { ...source, ...patch };
    try {
      const saved = await saveRequirementMutation.mutateAsync({
        requirement: pendingRequirement,
        title: pendingRequirement.title,
        description: pendingRequirement.description,
        aiDescription: pendingRequirement.aiDescription,
      });
      const persistedRequirement: Requirement = {
        ...pendingRequirement,
        id: saved.requirementNo,
        title: saved.title,
        description: saved.userDescription ?? '',
        aiDescription: saved.aiDescription ?? '',
        stage: stageLabels[saved.stage],
        updated: '刚刚',
        currentDecompositionNo: saved.currentDecompositionNo ?? undefined,
      };
      setRequirements((current) =>
        current.map((item) => (item.id === source.id ? persistedRequirement : item)),
      );
      if (source.id !== saved.requirementNo) {
        setWorkItemsByRequirement((current) => {
          const sourceItems = current[source.id];
          if (!sourceItems) return current;
          const next = { ...current, [saved.requirementNo]: sourceItems };
          delete next[source.id];
          return next;
        });
      }
      setSelected(items);
      navigate(`/requirements/${saved.requirementNo}/publish`);
    } catch (error) {
      setToast(
        error instanceof ApiError
          ? error.message
          : '无法连接后端服务，请确认服务已启动后重试',
      );
      window.setTimeout(() => setToast(''), 3000);
    }
  };
  const createRequirement = () => {
    const item: Requirement = {
      id: `LOCAL-${Date.now()}`,
      title: '未命名需求标题',
      description: '',
      aiDescription: '',
      updated: '刚刚',
      stage: '草稿',
      modules: 0,
      items: 0,
    };
    setRequirements((current) => [item, ...current]);
    openRequirement(item);
  };
  const deleteRequirement = async (item: Requirement) => {
    try {
      if (isPersistedRequirement(item.id)) {
        await deleteRequirementMutation.mutateAsync(item.id);
      }
      setRequirements((current) => current.filter((requirement) => requirement.id !== item.id));
      setWorkItemsByRequirement((current) => {
        if (!current[item.id]) return current;
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setToast('需求已删除');
      window.setTimeout(() => setToast(''), 2400);
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
      window.setTimeout(() => setToast(''), 3000);
      throw error;
    }
  };
  const navigateSidebar = (target: string) => {
    if (target === 'settings') navigate('/settings');
    else if (target === 'requirements') navigate('/requirements');
    else {
      setToast('该模块将在后续版本开放');
      window.setTimeout(() => setToast(''), 2200);
    }
  };

  return (
    <div className="app flex min-h-screen">
      {view !== 'settings' && <Link to="/settings" className="settings-mobile-entry">个人设置</Link>}
      <Sidebar view={view === 'analysis' ? 'requirements' : view} onChange={navigateSidebar} />
      <div className="app-content min-w-0 flex-1">
        <Suspense
          fallback={
            <div className="grid min-h-screen place-items-center text-sm text-slate-500">
              页面加载中...
            </div>
          }
        >
          {view === 'settings' && <SettingsPage />}
          {view === 'requirements' && (
            <RequirementList
              requirements={requirements}
              onOpen={openRequirement}
              onCreate={createRequirement}
              onPublish={(item: Requirement) => {
                void openPublishing(item);
              }}
              onDelete={deleteRequirement}
              deletingRequirementId={deleteRequirementMutation.variables}
              isDeleting={deleteRequirementMutation.isPending}
              cancellingRequirementId={cancelPublishTaskMutation.variables}
              isCancelling={cancelPublishTaskMutation.isPending}
              onCancel={async (item) => {
                try {
                  await cancelPublishTaskMutation.mutateAsync(item.id);
                  setRequirements((current) =>
                    current.map((requirement) =>
                      requirement.id === item.id
                        ? { ...requirement, stage: '已取消', updated: '刚刚' }
                        : requirement,
                    ),
                  );
                  setToast('任务已取消');
                  window.setTimeout(() => setToast(''), 2400);
                } catch (error) {
                  setToast(error instanceof ApiError ? error.message : '取消失败，请稍后重试');
                  window.setTimeout(() => setToast(''), 3000);
                  throw error;
                }
              }}
              publishingRequirementId={saveRequirementMutation.variables?.requirement.id}
              isPublishing={saveRequirementMutation.isPending}
              isLoading={requirementsQuery.isLoading}
              loadError={requirementsQuery.error}
              onRetry={() => void requirementsQuery.refetch()}
            />
          )}
          {view === 'analysis' && requirement && (
            <AnalysisWorkbench
              requirement={requirement}
              modules={modules}
              setModules={setModules}
              onRequirementChange={(patch: Partial<Requirement>) => {
                setRequirements((current) =>
                  current.map((item) =>
                    item.id === requirement.id ? { ...item, ...patch, updated: '刚刚' } : item,
                  ),
                );
              }}
              onBack={() => navigate('/requirements')}
              onPublish={(items: WorkItemNode[], patch: Partial<Requirement> = {}) => {
                void openPublishing(requirement, items, patch);
              }}
              isPublishing={saveRequirementMutation.isPending}
            />
          )}
          {view === 'planning' && requirement && (
            <Planning
              title={requirement.title}
              modules={modules}
              setModules={setModules}
              decompositionNo={requirement.currentDecompositionNo}
              onBack={() => navigate(`/requirements/${requirement.id}/analysis`)}
            />
          )}
          {view === 'publishing' && requirement && (
            <PublishWizard
              requirement={requirement}
              modules={modules}
              selected={
                selected.length
                  ? selected
                  : flattenNodes(modules).filter(
                      (item) => item.type === 'work' || item.type === 'subtask',
                    )
              }
              onBack={() => navigate(`/requirements/${requirement.id}/analysis`)}
              onDone={() => {
                setToast('任务已发布');
                window.setTimeout(() => setToast(''), 2500);
                navigate('/requirements');
              }}
            />
          )}
        </Suspense>
      </div>
      {toast && (
        <div className="toast">
          <Icon name="CircleCheck" />
          {toast}
        </div>
      )}
    </div>
  );
}
