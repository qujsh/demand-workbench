import { Link } from 'react-router-dom';
import CollaborationPanel from '../components/CollaborationPanel';
import '../system.css';

export default function CollaborationPage({ requirementNo }: { requirementNo: string }) {
  return <main className="system-page">
    <header className="topbar"><Link to="/requirements">需求管理</Link><span>/</span><strong>协作管理</strong></header>
    <div className="system-content"><h1>协作管理</h1><p className="system-muted">需求编号：{requirementNo}</p>
      <CollaborationPanel requirementNo={requirementNo} />
    </div>
  </main>;
}
