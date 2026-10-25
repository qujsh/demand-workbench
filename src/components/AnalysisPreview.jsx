const isDivider = row => row.every(cell => /^:?-{3,}:?$/.test(cell));

function parseTable(lines, start) {
  const rows = [];
  let index = start;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    rows.push(lines[index].trim().slice(1, -1).split('|').map(cell => cell.trim()));
    index += 1;
  }
  return { rows: rows.filter(row => !isDivider(row)), next: index };
}

function createSafeHtmlDocument(source) {
  const content = source
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|form|link|meta)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|input|button|link|meta)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><style>html,body{margin:0;min-height:100%;background:#fff}*{box-sizing:border-box}</style></head><body>${content}</body></html>`;
}

function parseCodeFence(lines, start) {
  const code = [];
  let index = start + 1;
  while (index < lines.length && !lines[index].trim().startsWith('```')) {
    code.push(lines[index]);
    index += 1;
  }
  return { code: code.join('\n'), next: Math.min(index + 1, lines.length) };
}

export default function AnalysisPreview({ content }) {
  const lines = content.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith('```')) {
      const fenced = parseCodeFence(lines, index);
      const isHtml = /<html\b|<div\b[^>]*style=/i.test(fenced.code);
      blocks.push(isHtml
        ? <div className="analysis-html-wrap" key={index}><div className="analysis-html-label">HTML 可视化</div><iframe className="analysis-html-preview" title="AI 生成的功能优先级与风险地图" sandbox="" srcDoc={createSafeHtmlDocument(fenced.code)}/></div>
        : <pre className="analysis-code" key={index}>{fenced.code}</pre>);
      index = fenced.next; continue;
    }
    if (line.startsWith('|')) {
      const table = parseTable(lines, index);
      const [head, ...body] = table.rows;
      blocks.push(<div className="analysis-table-wrap" key={index}><table><thead><tr>{head.map((cell,i)=><th key={i}>{cell}</th>)}</tr></thead><tbody>{body.map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c}>{c===1 && ['高','中','低'].includes(cell)?<b className={`risk-level risk-${cell}`}>{cell}</b>:cell}</td>)}</tr>)}</tbody></table></div>);
      index = table.next; continue;
    }
    if (line.startsWith('### ')) { blocks.push(<h3 key={index}>{line.slice(4)}</h3>); index += 1; continue; }
    if (line.startsWith('## ')) { blocks.push(<h2 key={index}>{line.slice(3)}</h2>); index += 1; continue; }
    if (line.startsWith('# ')) { blocks.push(<h1 key={index}>{line.slice(2)}</h1>); index += 1; continue; }
    if (line.startsWith('> ')) { blocks.push(<aside className="analysis-note" key={index}>{line.slice(2)}</aside>); index += 1; continue; }
    if (/^[-*] /.test(line)) { const items=[]; const key=index; while(index<lines.length&&/^[-*] /.test(lines[index].trim())){items.push(lines[index].trim().slice(2));index+=1;} blocks.push(<ul key={key}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>); continue; }
    if (/^\d+\. /.test(line)) { const items=[]; const key=index; while(index<lines.length&&/^\d+\. /.test(lines[index].trim())){items.push(lines[index].trim().replace(/^\d+\. /,''));index+=1;} blocks.push(<ol key={key}>{items.map((item,i)=><li key={i}>{item}</li>)}</ol>); continue; }
    blocks.push(<p key={index}>{line.replaceAll('**','')}</p>); index += 1;
  }
  return <article className="analysis-preview">{blocks}</article>;
}
