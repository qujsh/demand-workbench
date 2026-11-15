/** 隔离协议正文，后端清理后仍不允许脚本、表单、外部样式或嵌入资源执行。 */
export function LegalPreview({ html, mobile }: { html: string; mobile: boolean }) {
  const srcDoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{max-width:800px;margin:auto;padding:24px;font:16px/1.9 system-ui,sans-serif;color:#34373c;overflow-wrap:anywhere}h1,h2,h3{line-height:1.5}table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;
  return (
    <iframe
      title="协议正文预览"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      style={{
        display: 'block',
        width: mobile ? 'min(390px, 100%)' : '100%',
        height: '60vh',
        margin: 'auto',
        border: '1px solid #eee',
        borderRadius: 12,
      }}
    />
  );
}
