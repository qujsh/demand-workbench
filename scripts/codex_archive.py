#!/usr/bin/env python3
"""项目级 Codex 归档：助手提交或Hook落队列，独立进程通过现有MCP上传。"""
import argparse
import contextlib
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / '.codex/archive.local.json'
KEY_SERVICE = 'demand-workbench-codex-archive'


def redact(text):
    """落盘前清除已知令牌、私钥及带敏感字段的赋值；不承诺识别所有自然语言秘密。"""
    text = re.sub(r'-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----',
                  '[已隐藏私钥]', str(text), flags=re.S)
    text = re.sub(r'\b(?:dw_sk_|sk-)[A-Za-z0-9_-]+', '[已隐藏密钥]', text)
    text = re.sub(r'(?i)\bBearer\s+[A-Za-z0-9_.~+/-]+=*', 'Bearer [已隐藏]', text)
    text = re.sub(r'''(?ix)(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization|cookie|密码|密钥|令牌)["']?\s*[:=：]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\}\n]+)''',
                  lambda match: match[1] + '[已隐藏]', text)
    text = re.sub(r'(?i)(https?://)[^\s/@:]+:[^\s/@]+@', r'\1[已隐藏]@', text)
    return text


def settings():
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    config.setdefault('enabled', False)
    config.setdefault('url', 'http://localhost:8070/mcp')
    config.setdefault('upload_helper', '/Users/mainto/javafile/demand-workbench-backend/scripts/create_mcp_image_note.py')
    config.setdefault('state_dir', str(Path.home() / '.codex/archives' / ('demand-workbench-' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:12])))
    return config


@contextlib.contextmanager
def database(config):
    directory = Path(config['state_dir']).expanduser()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    path = directory / 'queue.sqlite3'
    # 创建文件前使用私有权限；SQLite journal继承数据库权限。
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    os.close(fd)
    os.chmod(path, 0o600)
    connection = sqlite3.connect(str(path), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE IF NOT EXISTS prompts (id TEXT PRIMARY KEY, value TEXT NOT NULL)')
    connection.execute('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL)')
    connection.execute('''CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, payload TEXT NOT NULL, progress TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        retry_at REAL NOT NULL DEFAULT 0, error TEXT)''')
    try:
        yield connection
    finally:
        connection.close()


def identity(event):
    if not event.get('session_id') or not event.get('turn_id'):
        raise ValueError('Hook缺少session_id或turn_id，未归档')
    return hashlib.sha256((str(ROOT) + '\0' + str(event['session_id']) + '\0' + str(event['turn_id'])).encode()).hexdigest()


def split_text(text, limit=15000):
    """按Java UTF-16长度拆分，保留所有文字，给每段元数据留出空间。"""
    chunks, chunk, count = [], [], 0
    for char in text:
        width = 2 if ord(char) > 0xffff else 1
        if count + width > limit:
            chunks.append(''.join(chunk)); chunk, count = [], 0
        chunk.append(char); count += width
    if chunk:
        chunks.append(''.join(chunk))
    return chunks or ['']


def markdown_images(text, source):
    # 代码示例里的图片语法不是附件，不能把示例路径误当成待上传文件。
    visible, fence = [], None
    for line in text.splitlines():
        marker = re.match(r'^\s*(`{3,}|~{3,})', line)
        if marker:
            token = marker[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence is None:
            visible.append(re.sub(r'(`+).*?\1', '', line))
    return [{'path': match[1] or match[2], 'source': source}
            for match in re.finditer(r'!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)', '\n'.join(visible))
            if (match[1] or match[2]).startswith('/')]


def footer_tags(text, thread_title):
    # 与后端标签规则一致；已有业务标签占用额度时不使整条归档失败。
    existing = re.findall(r'(?:^|\s)#([^\s#]{1,30})(?=\s|$)', text)
    import unicodedata
    key = lambda value: unicodedata.normalize('NFC', value).lower()
    seen = {key(value) for value in existing}
    result = []
    for value in ('Codex', ROOT.name, thread_title):
        tag = re.sub(r'[\s#\x00-\x1f\x7f]+', '', redact(value))[:30]
        if tag and key(tag) not in seen and len(seen) < 10:
            result.append('#' + tag)
            seen.add(key(tag))
    return ('\n\n' + ' '.join(result)) if result else ''


def snapshot_images(text, directory, attachments=None):
    """复制明确提供的用户/助手附件；兼容回复里的Markdown，不扫描目录。"""
    images, warnings, seen = [], [], set()
    candidates = list(attachments or []) + markdown_images(text, 'assistant')
    for attachment in candidates:
        name = attachment['path']
        source_kind = attachment['source']
        if not name.startswith('/'):
            continue
        source = Path(name)
        if source.is_symlink():
            warnings.append('有一张本地配图是符号链接，未自动归档。')
            continue
        source = source.resolve()
        if str(source) in seen:
            continue
        seen.add(str(source))
        try:
            if source.is_symlink() or not source.is_file() or not 1 <= source.stat().st_size <= 10485760:
                raise ValueError('无效图片')
            data = source.read_bytes()
            mime = ('image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else
                    'image/jpeg' if data.startswith(b'\xff\xd8\xff') else
                    'image/webp' if data[:4] == b'RIFF' and data[8:12] == b'WEBP' else None)
            if mime is None:
                raise ValueError('不支持的图片')
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            target = directory / (str(len(images)) + '.bin')
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                stream.write(data)
            images.append({'path': str(target), 'mimeType': mime, 'size': len(data), 'source': source_kind})
        except (OSError, ValueError):
            warnings.append('有一张明确引用的本地图片无法归档（不存在、格式不支持或超过10MiB）。')
    return images, warnings


def capture(event, config):
    """只采集当前项目的主线程问题和最终回答；任务一旦入队即冻结，重复事件不重复创建。"""
    cwd = Path(event.get('cwd', '/')).resolve()
    if ROOT != cwd and ROOT not in cwd.parents:
        return
    kind = event.get('hook_event_name')
    if kind not in ('UserPromptSubmit', 'Stop') or event.get('agent_id'):
        return
    job_id = identity(event)
    with database(config) as db, db:
        if kind == 'UserPromptSubmit':
            if db.execute('SELECT 1 FROM jobs WHERE id=?', (job_id,)).fetchone():
                return
            prompt = redact(event.get('prompt', ''))
            old = db.execute('SELECT value FROM prompts WHERE id=?', (job_id,)).fetchone()
            values = json.loads(old['value']) if old else []
            if prompt and prompt not in values:
                values.append(prompt)
            db.execute('INSERT OR REPLACE INTO prompts VALUES (?,?)', (job_id, json.dumps(values, ensure_ascii=False)))
            return
        answer = event.get('last_assistant_message')
        if not answer or not str(answer).strip() or db.execute('SELECT 1 FROM jobs WHERE id=?', (job_id,)).fetchone():
            return
        old = db.execute('SELECT value FROM prompts WHERE id=?', (job_id,)).fetchone()
        prompt = '\n\n'.join(json.loads(old['value'])) if old else '（本轮问题未捕获；可能在启用Hook前已开始。）'
        supplied_title = event.get('thread_title')
        if supplied_title:
            db.execute('INSERT OR REPLACE INTO sessions VALUES (?,?)',
                       (event['session_id'], redact(supplied_title)[:200]))
        cached = db.execute('SELECT title FROM sessions WHERE id=?', (event['session_id'],)).fetchone()
        thread_title = cached['title'] if cached else ''
        attachments = event.get('attachments', []) + markdown_images(prompt, 'user')
        images, warnings = snapshot_images(str(answer), Path(config['state_dir']) / 'images' / job_id, attachments)
        body = '用户问题：\n' + prompt + '\n\nCodex 最终回答：\n' + redact(answer)
        if warnings:
            body += '\n\n归档说明：\n' + '\n'.join(warnings)
        chunks = split_text(body)
        total = max(len(chunks), (len(images) + 8) // 9)
        occurred_at = datetime.now(timezone.utc).isoformat()
        parts = []
        for index in range(total):
            chunk = chunks[index] if index < len(chunks) else '本轮补充配图。'
            parts.append({'title': '', 'text': chunk + footer_tags(chunk, thread_title),
                          'images': images[index * 9:(index + 1) * 9],
                          'clientRequestNo': hashlib.sha256((job_id + ':' + str(index)).encode()).hexdigest(),
                          'occurredAt': occurred_at})
        payload = {'parts': parts, 'createdAt': occurred_at,
                   'session_id': event['session_id'], 'turn_id': event['turn_id'], 'thread_title': thread_title}
        db.execute('INSERT INTO jobs(id,payload) VALUES (?,?)', (job_id, json.dumps(payload, ensure_ascii=False)))
        db.execute('DELETE FROM prompts WHERE id=?', (job_id,))



def publish(value, config):
    """助手发送最终回复前主动入队；明确提交号支持重试，不依赖Hook和会话文件。"""
    question, answer = value.get('question'), value.get('answer')
    if not isinstance(question, str) or not question.strip() or not isinstance(answer, str) or not answer.strip():
        raise ValueError('question和answer必须为非空文本')
    session = value.get('session_id') or os.environ.get('CODEX_THREAD_ID')
    if not isinstance(session, str) or not session.strip():
        raise ValueError('缺少会话编号')
    submission = value.get('submission_id') or str(uuid.uuid4())
    if not isinstance(submission, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,128}', submission):
        raise ValueError('submission_id格式无效')
    attachments = value.get('attachments', [])
    if not isinstance(attachments, list) or any(
            not isinstance(item, dict) or item.get('source') not in ('user', 'assistant')
            or not isinstance(item.get('path'), str) or not item['path'].startswith('/')
            for item in attachments):
        raise ValueError('attachments必须包含source（user/assistant）和绝对path')
    title = value.get('thread_title', '')
    if not isinstance(title, str):
        raise ValueError('thread_title必须为文本')
    event = {'cwd': str(ROOT), 'session_id': session, 'turn_id': submission,
             'attachments': attachments, 'thread_title': title}
    capture({**event, 'hook_event_name': 'UserPromptSubmit', 'prompt': question}, config)
    capture({**event, 'hook_event_name': 'Stop', 'last_assistant_message': answer}, config)
    return {'queued': True, 'job_id': identity(event), 'submission_id': submission}


def credential():
    secret = os.environ.get('DEMAND_WORKBENCH_API_KEY')
    if secret:
        return secret
    result = subprocess.run(['/usr/bin/security', 'find-generic-password', '-s', KEY_SERVICE, '-a', os.environ.get('USER', 'mainto'), '-w'],
                            capture_output=True, text=True, timeout=15)
    if result.returncode or not result.stdout.strip():
        raise ValueError('缺少归档密钥，请设置环境变量或使用set-key')
    return result.stdout.strip()


class Client:
    def __init__(self, config):
        spec = importlib.util.spec_from_file_location('archive_mcp_upload', config['upload_helper'])
        self.api = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.api)
        self.api.check_url(config['url'], local=True)
        self.url, self.secret = config['url'], credential()
        self.api.rpc(self.url, self.secret, 'initialize', {'protocolVersion': '2025-11-25', 'capabilities': {},
            'clientInfo': {'name': 'codex-project-archive', 'version': '1'}})
        self.api.rpc(self.url, self.secret, 'notifications/initialized', {})

    def tool(self, name, arguments):
        return self.api.tool(self.url, self.secret, name, arguments)

    def upload(self, image, progress, save):
        if not progress.get('mediaNo'):
            ticket = self.tool('prepare_note_image_upload', {'filename': 'codex-image',
                'mimeType': image['mimeType'], 'size': image['size']})
            self.api.check_url(ticket['uploadUrl'])
            boundary = '----CodexArchive' + uuid.uuid4().hex
            parts = []
            for name in ('token', 'key'):
                parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="' + name +
                              '"\r\n\r\n' + ticket[name] + '\r\n').encode())
            parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="image"\r\nContent-Type: ' + image['mimeType'] + '\r\n\r\n').encode())
            parts.extend([Path(image['path']).read_bytes(), ('\r\n--' + boundary + '--\r\n').encode()])
            uploaded = self.api.request_json(ticket['uploadUrl'], b''.join(parts), {'Content-Type': 'multipart/form-data; boundary=' + boundary})
            if uploaded.get('key') != ticket['key']:
                raise ValueError('云端返回图片编号不一致')
            progress['mediaNo'] = ticket['mediaNo']
            save()
        if not progress.get('completed'):
            self.tool('complete_note_image_upload', {'mediaNo': progress['mediaNo']})
            progress['completed'] = True
            save()
        return progress['mediaNo']


def drain(config, force=False, reset=False, client_factory=Client):
    """单进程锁保护上传；最多五次自动尝试，分段保存后可安全续传。"""
    with database(config) as db:
        lock_path = Path(config['state_dir']) / 'worker.lock'
        with lock_path.open('a') as lock:
            os.chmod(lock_path, 0o600)
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return
            if reset:
                with db:
                    db.execute("UPDATE jobs SET attempts=0,status='pending',retry_at=0 WHERE status='failed'")
            rows = db.execute("SELECT * FROM jobs WHERE status='pending' AND attempts<5 AND retry_at<=? ORDER BY rowid LIMIT 20",
                              (float('inf') if force else time.time(),)).fetchall()
            client = None
            for row in rows:
                progress = json.loads(row['progress'])
                def save():
                    with db:
                        db.execute('UPDATE jobs SET progress=? WHERE id=?', (json.dumps(progress), row['id']))
                try:
                    if client is None:
                        client = client_factory(config)
                    for index, part in enumerate(json.loads(row['payload'])['parts']):
                        saved = progress.setdefault(str(index), {'images': {}})
                        if saved.get('recordNo'):
                            continue
                        media_nos = []
                        for image_index, image in enumerate(part['images']):
                            media_nos.append(client.upload(image, saved['images'].setdefault(str(image_index), {}), save))
                        args = {key: part[key] for key in ('title', 'text', 'clientRequestNo', 'occurredAt')}
                        result = client.tool('create_note', {**args, 'mediaNos': media_nos, 'action': 'SAVE'})
                        saved['recordNo'] = result['recordNo']
                        save()
                    with db:
                        db.execute("UPDATE jobs SET status='done',error=NULL WHERE id=?", (row['id'],))
                except Exception as error:
                    # 不保存异常正文，HTTP异常/服务返回可能包含凭据和用户内容。
                    attempts = row['attempts'] + 1
                    with db:
                        db.execute('UPDATE jobs SET attempts=?,status=?,retry_at=?,error=? WHERE id=?',
                                   (attempts, 'failed' if attempts >= 5 else 'pending', time.time() + min(60 * 2 ** (attempts - 1), 3600),
                                    type(error).__name__, row['id']))


def kick():
    # 立即落盘后派生独立进程；不让网络请求阻塞Codex本轮完成。
    subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'drain'],
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True, close_fds=True, cwd=str(ROOT))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['hook', 'publish', 'drain', 'retry', 'status', 'set-key'])
    parser.add_argument('--reset-failed', action='store_true')
    args = parser.parse_args()
    if args.command == 'set-key':
        secret = sys.stdin.readline().strip()
        if not re.fullmatch(r'dw_sk_[A-Za-z0-9_-]{43}', secret):
            raise ValueError('密钥格式无效')
        result = subprocess.run(['/usr/bin/security', 'add-generic-password', '-U', '-s', KEY_SERVICE,
                                 '-a', os.environ.get('USER', 'mainto'), '-w', secret], capture_output=True, timeout=15)
        if result.returncode:
            raise ValueError('钥匙串保存失败')
        print('归档密钥已保存到macOS钥匙串。')
        return
    config = settings()
    if args.command == 'status':
        with database(config) as db:
            counts = dict(db.execute('SELECT status,COUNT(*) FROM jobs GROUP BY status').fetchall())
            jobs = [{'id': row['id'][:12], 'status': row['status'], 'attempts': row['attempts'], 'error': row['error'],
                     'recordNos': [part['recordNo'] for part in json.loads(row['progress']).values() if part.get('recordNo')]}
                    for row in db.execute('SELECT * FROM jobs ORDER BY rowid DESC LIMIT 10')]
        print(json.dumps({'enabled': config['enabled'], 'mode': config.get('mode', 'hooks'), 'counts': counts, 'recent': jobs}, ensure_ascii=False))
        return
    if not config['enabled']:
        if args.command == 'publish':
            print(json.dumps({'queued': False, 'enabled': False}))
        return
    if args.command == 'publish':
        result = publish(json.loads(sys.stdin.read(8 * 1024 * 1024)), config)
        kick()
        print(json.dumps(result))
    elif args.command == 'hook':
        if config.get('mode', 'hooks') != 'hooks':
            return
        try:
            event = json.loads(sys.stdin.read(8 * 1024 * 1024))
            capture(event, config)
            if event.get('hook_event_name') in ('Stop', 'SessionStart'):
                kick()
        except Exception as error:
            # 非阻断警告，避免归档失败继续触发新轮次，也不输出敏感内容。
            print(json.dumps({'systemMessage': 'Codex归档未入队：' + type(error).__name__}))
    else:
        drain(config, force=args.command == 'retry', reset=args.reset_failed)


if __name__ == '__main__':
    main()
