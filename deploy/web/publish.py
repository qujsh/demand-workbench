#!/usr/bin/env python3
"""手动发布静态前端；版本目录只增不改，最后切换根入口。"""
import argparse
from html.parser import HTMLParser
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

REPORT = Path("web-deployment-result.json")
SHA_PATTERN = r"[a-f0-9]{40}"


def https_origin(value, name):
    if any(char.isspace() for char in value):
        raise ValueError(f"{name} 不能包含空白字符")
    url = urlparse(value)
    host = url.hostname or ""
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError(f"{name} 必须使用域名，不能使用 IP")
    if (url.scheme != "https" or not host or url.username or url.password
            or url.path not in ("", "/") or url.query or url.fragment
            or url.port not in (None, 443) or "." not in host
            or not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", part)
                       for part in host.split("."))
            or host in ("127.0.0.1", "localhost")
            or host.endswith((".clouddn.com", ".qiniucdn.com", ".qiniudn.com", ".local"))):
        raise ValueError(f"{name} 必须是自定义 HTTPS 域名，不含路径、凭据或查询参数")
    return value.rstrip("/")


def configuration(env):
    sha = env.get("RESTORE_SHA") or env.get("RELEASE_SHA", "")
    if not re.fullmatch(SHA_PATTERN, sha):
        raise ValueError("发布或回滚版本必须是完整 40 位 Git SHA")
    bucket = env.get("QINIU_WEB_BUCKET", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", bucket):
        raise ValueError("请配置独立前端空间 QINIU_WEB_BUCKET，例如 freeligo-workbench")
    origin = https_origin(env.get("QINIU_WEB_ORIGIN", ""), "QINIU_WEB_ORIGIN")
    api = https_origin(env.get("VITE_API_BASE_URL", ""), "VITE_API_BASE_URL")
    mcp = env.get("VITE_MCP_PUBLIC_URL", "")
    if mcp and mcp != api + "/mcp":
        raise ValueError("VITE_MCP_PUBLIC_URL 应留空或使用 API 域名下的 /mcp")
    if env.get("QINIU_SPA_FALLBACK_READY") != "true":
        raise ValueError("先配置页面路由回退和入口不缓存，再设置 QINIU_SPA_FALLBACK_READY=true")
    return {"sha": sha, "bucket": bucket, "origin": origin, "api": api,
            "restore": bool(env.get("RESTORE_SHA"))}


class EntryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.assets.append(attrs["src"])
        if tag == "link" and attrs.get("rel") in ("stylesheet", "modulepreload"):
            self.assets.append(attrs.get("href", ""))


def entry_assets(content, sha):
    parser = EntryParser()
    parser.feed(content.decode("utf-8"))
    prefix = f"/releases/{sha}/"
    if not parser.assets or any(not value.startswith(prefix) or ".." in value
                                or "?" in value or "#" in value for value in parser.assets):
        raise ValueError("入口没有引用当前版本的独立资源目录，请检查构建 --base")
    return parser.assets


def fetch(url, html=False):
    request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "freeligo-workbench-deploy"})
    with urlopen(request, timeout=10) as response:
        if (response.status != 200 or response.url != url
                or urlparse(response.url).scheme != "https"
                or urlparse(response.url).netloc != urlparse(url).netloc):
            raise ValueError("公开访问未返回当前 HTTPS 站点的 200 响应")
        if html and ("text/html" not in response.headers.get("Content-Type", "")
                     or "attachment" in response.headers.get("Content-Disposition", "").lower()):
            raise ValueError("HTML 未正常展示，请检查域名、MIME 和强制下载设置")
        data = response.read(50 * 1024 * 1024 + 1)
        if len(data) > 50 * 1024 * 1024:
            raise ValueError("文件超过发布验证上限")
        return data


class QiniuStorage:
    def __init__(self, bucket, env):
        import qiniu
        import qiniu.config
        for key in ("QINIU_ACCESS_KEY", "QINIU_SECRET_KEY"):
            if not env.get(key):
                raise ValueError(f"缺少 GitHub Secret: {key}")
        qiniu.config.set_default(default_zone=qiniu.Region(scheme="https"),
                                 connection_timeout=15, connection_retries=2)
        self.sdk = qiniu
        self.auth = qiniu.Auth(env["QINIU_ACCESS_KEY"], env["QINIU_SECRET_KEY"])
        self.bucket = bucket
        self.manager = qiniu.BucketManager(self.auth, preferred_scheme="https")
        self.cdn = qiniu.CdnManager(self.auth)
        self.cdn.server = "https://fusion.qiniuapi.com"

    def upload(self, key, path, immutable=True):
        expected = self.sdk.etag(str(path))
        if immutable:
            current, info = self.manager.stat(self.bucket, key)
            if info.status_code == 200:
                if current.get("hash") != expected:
                    raise ValueError("同一提交已存在不同构建内容；请创建新提交，不能覆盖历史版本")
                return
            if info.status_code != 612:
                raise ValueError("读取七牛对象状态失败")
        policy = {"insertOnly": 1} if immutable else {}
        token = self.auth.upload_token(self.bucket, key, 600, policy)
        mime = {".js": "application/javascript", ".css": "text/css", ".html": "text/html"}.get(
            path.suffix, mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        data, info = self.sdk.put_file_v2(token, key, str(path), mime_type=mime,
                                           check_crc=True, bucket_name=self.bucket)
        if info.status_code != 200 or not data or data.get("hash") != expected:
            raise ValueError("七牛上传或文件哈希验证失败")

    def refresh(self, urls):
        data, info = self.cdn.refresh_urls(urls)
        if info.status_code != 200 or not data or data.get("code") != 200:
            raise ValueError("CDN 刷新请求未被接受")


def publish(config, storage, result, dist=Path("dist")):
    sha, origin = config["sha"], config["origin"]
    prefix = f"releases/{sha}/"
    with tempfile.TemporaryDirectory() as temporary:
        if config["restore"]:
            result["stage"] = "读取保留版本"
            entry = Path(temporary) / "index.html"
            entry.write_bytes(fetch(origin + "/" + prefix + "index.html", html=True))
        else:
            result["stage"] = "检查构建产物"
            entry = dist / "index.html"
            if not entry.is_file() or dist.is_symlink():
                raise ValueError("缺少 dist/index.html")
            assets = entry_assets(entry.read_bytes(), sha)
            files = sorted(dist.rglob("*"))
            if any(path.is_symlink() for path in files):
                raise ValueError("构建目录不允许符号链接")
            files = [path for path in files if path.is_file()]
            if any(path.suffix in (".map", ".env", ".pem", ".key")
                   or any(part.startswith(".") for part in path.relative_to(dist).parts)
                   for path in files):
                raise ValueError("构建目录含不应公开的文件")
            result["stage"] = "上传版本资源"
            for path in files:
                if path != entry:
                    storage.upload(prefix + path.relative_to(dist).as_posix(), path)
            # HTML 只会引用已上传的独立版本资源。
            storage.upload(prefix + "index.html", entry)
        content = entry.read_bytes()
        assets = entry_assets(content, sha)
        result["stage"] = "验证版本资源公开访问"
        if fetch(origin + "/" + prefix + "index.html", html=True) != content:
            raise ValueError("版本入口与构建内容不一致")
        for asset in assets:
            data = fetch(origin + asset)
            relative = asset.removeprefix("/" + prefix)
            if not config["restore"] and data != (dist / relative).read_bytes():
                raise ValueError("版本资源内容与构建内容不一致")
            if not data:
                raise ValueError("版本资源为空")
        result["stage"] = "切换根入口"
        # 在操作前标记，网络超时可能发生在服务端已写入但未返回的情况下。
        result["entry_may_have_changed"] = True
        storage.upload("index.html", entry, immutable=False)
        result["stage"] = "刷新入口缓存"
        urls = [origin + path for path in ("/", "/index.html", "/shares", "/system/settings")]
        storage.refresh(urls)
        result["stage"] = "验证入口及页面刷新"
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            try:
                if all(fetch(url, html=True) == content for url in urls):
                    result.update(status="success", stage="发布验证完成")
                    return
            except (OSError, ValueError):
                pass
            time.sleep(5)
        raise ValueError("入口或页面路由未返回当前版本，请检查 CDN 缓存及 SPA 回退")


def summary():
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    status = "✅ 前端发布验证成功" if report.get("status") == "success" else "❌ 前端发布未完成"
    lines = ["## " + status, "", "- Actions 状态：" + os.environ.get("JOB_STATUS", "unknown")]
    if re.fullmatch(SHA_PATTERN, report.get("sha", "")):
        lines.append("- 目标版本：`" + report["sha"] + "`")
    if report.get("origin"):
        origin = https_origin(report["origin"], "站点地址")
        lines.append(f"- 站点：[打开前端]({origin})")
    lines.append("- 最后阶段：" + report.get("stage", "检查 Actions 失败步骤"))
    lines.append("- 模式：" + ("恢复历史版本" if report.get("restore") else "发布新版本"))
    if report.get("entry_may_have_changed") and report.get("status") != "success":
        lines.append("- ⚠️ 入口可能已经更新，缓存/验证未完成；请检查站点，必要时手动恢复保留版本。")
    elif report.get("status") != "success":
        lines.append("- 未收到完整成功报告；上传步骤未开始时不影响现有站点，强制终止时需核对入口状态。")
    lines.append("\n此结果验证静态文件与路由返回，不代表登录、API 或图片上传业务已验收。\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
        output.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()
    if args.summary:
        summary()
        return
    result = {"status": "failed", "stage": "检查配置", "entry_may_have_changed": False}
    try:
        config = configuration(os.environ)
        result.update(sha=config["sha"], restore=config["restore"], origin=config["origin"])
        if args.validate:
            print("域名、空间及版本配置检查通过")
            return
        result["stage"] = "初始化七牛客户端（请核对 Secrets）"
        storage = QiniuStorage(config["bucket"], os.environ)
        publish(config, storage, result)
        print("前端版本及入口验证成功")
    except (Exception, KeyboardInterrupt) as error:
        # SDK/HTTP 异常可能附带 token，禁止直接打印异常及原始响应。
        print("发布未完成：" + result["stage"] + "。请查看 Summary 和配置说明。", file=sys.stderr)
        if result["stage"] == "检查配置":
            print(str(error), file=sys.stderr)
        raise SystemExit(1)
    finally:
        REPORT.write_text(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
