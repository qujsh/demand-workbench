"""归档工具专项验证：脱敏、轮次去重、失败恢复、分段和本地配图。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('codex_archive', Path(__file__).with_name('codex_archive.py'))
ARCHIVE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ARCHIVE)


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = {'enabled': True, 'state_dir': str(self.root / 'queue')}
        self.event = {'cwd': str(ARCHIVE.ROOT), 'session_id': 'test-session', 'turn_id': 'test-turn'}

    def capture(self, kind, **values):
        ARCHIVE.capture({**self.event, 'hook_event_name': kind, **values}, self.config)

    def jobs(self):
        with ARCHIVE.database(self.config) as db:
            return db.execute('SELECT * FROM jobs ORDER BY rowid').fetchall()

    def test_secrets_redacted_before_disk_and_duplicate_stops_create_one_job(self):
        self.capture('UserPromptSubmit', prompt='问题 dw_sk_' + 'A' * 43 + '\npassword="secret-value"\n密码：中文秘密\ntoken=other-secret')
        self.capture('UserPromptSubmit', prompt='补充要求')
        self.capture('Stop', last_assistant_message='回答 Authorization: Bearer very-secret-token')
        self.capture('Stop', last_assistant_message='重复事件不覆盖冻结内容')
        self.capture('UserPromptSubmit', prompt='冻结后的重复提问不重新落盘')
        jobs = self.jobs()
        self.assertEqual(len(jobs), 1)
        payload = jobs[0]['payload']
        self.assertIn('补充要求', payload)
        self.assertNotIn('dw_sk_', payload)
        self.assertNotIn('secret-value', payload)
        self.assertNotIn('中文秘密', payload)
        self.assertNotIn('other-secret', payload)
        self.assertNotIn('very-secret-token', payload)
        self.assertNotIn('重复事件', payload)
        self.assertEqual((Path(self.config['state_dir']) / 'queue.sqlite3').stat().st_mode & 0o777, 0o600)
        with ARCHIVE.database(self.config) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM prompts').fetchone()[0], 0)

    def test_full_text_and_images_split_without_loss(self):
        paths = []
        for index in range(10):
            path = self.root / ('test' + str(index) + '.png')
            path.write_bytes(b'\x89PNG\r\n\x1a\nimage')
            paths.append(path)
        answer = '😀' * 16000 + '\n' + '\n'.join('![图](<' + str(path) + '>)' for path in paths)
        self.capture('Stop', last_assistant_message=answer)
        parts = json.loads(self.jobs()[0]['payload'])['parts']
        self.assertGreaterEqual(len(parts), 3)
        self.assertEqual(sum(len(part['images']) for part in parts), 10)
        self.assertTrue(all(len(part['images']) <= 9 for part in parts))
        self.assertTrue(all(part['title'] == '' for part in parts))
        self.assertTrue(all(len(part['text'].encode('utf-16-le')) // 2 <= 20000 for part in parts))
        copied = parts[0]['images'][0]['path']
        paths[0].unlink()
        self.assertTrue(Path(copied).exists())

    def test_foreign_project_subagent_empty_response_not_archived(self):
        ARCHIVE.capture({**self.event, 'cwd': str(self.root), 'hook_event_name': 'Stop', 'last_assistant_message': 'foreign'}, self.config)
        self.capture('Stop', last_assistant_message='subagent', agent_id='child')
        self.capture('Stop', last_assistant_message='')
        self.assertEqual(self.jobs(), [])

    def test_retry_reuses_exact_input_after_lost_create_response(self):
        self.capture('UserPromptSubmit', prompt='重试测试')
        self.capture('Stop', last_assistant_message='完成')
        calls = []
        class Client:
            def tool(self, name, arguments):
                calls.append(arguments)
                if len(calls) == 1:
                    raise OSError('do-not-log-this-secret')
                return {'recordNo': 'NOTE-test'}
        factory = lambda config: Client()
        ARCHIVE.drain(self.config, client_factory=factory)
        self.assertEqual(self.jobs()[0]['status'], 'pending')
        self.assertEqual(self.jobs()[0]['error'], 'OSError')
        ARCHIVE.drain(self.config, client_factory=factory)
        self.assertEqual(len(calls), 1)  # 未到重试时间，不忙循环。
        ARCHIVE.drain(self.config, force=True, client_factory=factory)
        self.assertEqual(calls[0], calls[1])
        self.assertEqual(self.jobs()[0]['status'], 'done')
        ARCHIVE.drain(self.config, force=True, client_factory=factory)
        self.assertEqual(len(calls), 2)

    def test_successful_parts_and_uploaded_images_not_repeated(self):
        image = self.root / 'test.png'
        image.write_bytes(b'\x89PNG\r\n\x1a\nimage')
        self.capture('Stop', last_assistant_message='![图](<' + str(image) + '>)\n' + 'x' * 20000)
        calls = []
        uploads = []
        class Client:
            def upload(self, image, progress, save):
                uploads.append(image)
                progress.update(mediaNo='MEDIA-test', completed=True)
                save()
                return progress['mediaNo']
            def tool(self, name, arguments):
                calls.append(arguments)
                if len(calls) == 2:
                    raise OSError('offline')
                return {'recordNo': 'NOTE-' + str(len(calls))}
        factory = lambda config: Client()
        ARCHIVE.drain(self.config, client_factory=factory)
        ARCHIVE.drain(self.config, force=True, client_factory=factory)
        self.assertEqual(len(uploads), 1)
        self.assertEqual(calls[1], calls[2])
        self.assertEqual(self.jobs()[0]['status'], 'done')

    def test_five_failures_require_explicit_reset(self):
        self.capture('Stop', last_assistant_message='失败上限')
        def failing(config):
            raise OSError('offline')
        for _ in range(7):
            ARCHIVE.drain(self.config, force=True, client_factory=failing)
        self.assertEqual(self.jobs()[0]['attempts'], 5)
        self.assertEqual(self.jobs()[0]['status'], 'failed')
        ARCHIVE.drain(self.config, force=True, reset=True, client_factory=failing)
        self.assertEqual(self.jobs()[0]['attempts'], 1)

    def test_hook_never_blocks_or_leaks_error_message(self):
        with patch.object(ARCHIVE, 'settings', return_value=self.config), patch('sys.argv', ['archive', 'hook']), \
             patch('sys.stdin', __import__('io').StringIO('bad-json')), patch('sys.stdout', new_callable=__import__('io').StringIO) as output:
            ARCHIVE.main()
        response = json.loads(output.getvalue())
        self.assertIn('systemMessage', response)
        self.assertNotIn('decision', response)
        self.assertNotIn('continue', response)

    def test_assistant_publish_redacts_and_deduplicates_submission(self):
        value = {'question': '问题 dw_sk_' + 'X' * 43, 'answer': '完整最终回复',
                 'session_id': 'assistant-session', 'submission_id': 'assistant-turn-001'}
        first = ARCHIVE.publish(value, self.config)
        second = ARCHIVE.publish(value, self.config)
        self.assertEqual(first, second)
        self.assertTrue(first['queued'])
        jobs = self.jobs()
        self.assertEqual(len(jobs), 1)
        text = json.loads(jobs[0]['payload'])['parts'][0]['text']
        self.assertIn('完整最终回复', text)
        self.assertIn('[已隐藏密钥]', text)
        self.assertNotIn('dw_sk_', text)

    def test_assistant_publish_uses_current_thread_and_preserves_answer(self):
        with patch.dict('os.environ', {'CODEX_THREAD_ID': 'current-thread'}):
            result = ARCHIVE.publish({'question': '这轮问题', 'answer': '第一段\n\n第二段'}, self.config)
        self.assertTrue(result['queued'])
        text = json.loads(self.jobs()[0]['payload'])['parts'][0]['text']
        self.assertNotIn('current-thread', text)
        self.assertIn('第一段\n\n第二段', text)
        self.assertTrue(text.endswith('#Codex #demand-workbench'))
        self.assertEqual(json.loads(self.jobs()[0]['payload'])['session_id'], 'current-thread')
        with self.assertRaises(ValueError):
            ARCHIVE.publish({'question': '问题', 'answer': ''}, self.config)

    def test_user_attachments_snapshot_deduplicate_and_keep_source(self):
        image = self.root / '用户截图.png'
        image.write_bytes(b'\x89PNG\r\n\x1a\nimage')
        other = self.root / '回复图.png'
        other.write_bytes(b'\x89PNG\r\n\x1a\nother')
        ARCHIVE.publish({'question': '截图问题', 'answer': '![同图](' + str(image) + ')',
                         'session_id': 'images-session', 'submission_id': 'images-test-001',
                         'attachments': [{'source': 'user', 'path': str(image)},
                                         {'source': 'assistant', 'path': str(other)}]}, self.config)
        images = json.loads(self.jobs()[0]['payload'])['parts'][0]['images']
        self.assertEqual([item['source'] for item in images], ['user', 'assistant'])
        image.unlink()
        self.assertTrue(Path(images[0]['path']).is_file())
        self.assertEqual(Path(images[0]['path']).stat().st_mode & 0o777, 0o600)

    def test_markdown_image_examples_are_not_uploaded(self):
        value = '`![示例](/tmp/example.png)`\n```md\n![示例](/tmp/inside.png)\n```\n![实际](/tmp/real.png)'
        self.assertEqual(ARCHIVE.markdown_images(value, 'assistant'),
                         [{'path': '/tmp/real.png', 'source': 'assistant'}])

    def test_clean_title_footer_and_session_title_cache(self):
        value = {'question': '自然的问题标题', 'answer': '完整回复', 'session_id': 'named-session',
                 'submission_id': 'named-test-001', 'thread_title': '查看后端 MCP 是否可用'}
        ARCHIVE.publish(value, self.config)
        part = json.loads(self.jobs()[0]['payload'])['parts'][0]
        self.assertEqual(part['title'], '')
        self.assertEqual(part['text'], '用户问题：\n自然的问题标题\n\nCodex 最终回答：\n完整回复'
                         '\n\n#Codex #demand-workbench #查看后端MCP是否可用')
        ARCHIVE.publish({**value, 'thread_title': '', 'submission_id': 'named-test-002'}, self.config)
        self.assertTrue(json.loads(self.jobs()[1]['payload'])['parts'][0]['text'].endswith('#查看后端MCP是否可用'))

    def test_attachment_errors_preserve_text_and_bad_contract_rejected(self):
        ARCHIVE.publish({'question': '问题', 'answer': '回复', 'session_id': 'missing-session',
                         'attachments': [{'source': 'user', 'path': str(self.root / 'missing.png')}]}, self.config)
        part = json.loads(self.jobs()[0]['payload'])['parts'][0]
        self.assertEqual(part['images'], [])
        self.assertIn('无法归档', part['text'])
        with self.assertRaises(ValueError):
            ARCHIVE.publish({'question': '问题', 'answer': '回复', 'session_id': 'bad-session',
                             'attachments': [{'source': 'user', 'path': 'relative.png'}]}, self.config)
        self.assertEqual(len(self.jobs()), 1)

    def test_tags_respect_backend_budget_and_long_thread_name(self):
        text = ' '.join('#业务' + str(i) for i in range(9))
        self.assertEqual(ARCHIVE.footer_tags(text, '聊天' * 50), '\n\n#Codex')
        tags = ARCHIVE.footer_tags('', '聊天 # 空格' * 30).split()
        self.assertTrue(all(len(tag[1:]) <= 30 and tag.count('#') == 1 for tag in tags))

    def test_assistant_mode_disables_cached_hooks_and_disabled_publish_does_not_queue(self):
        import io
        config = {**self.config, 'mode': 'assistant'}
        with patch.object(ARCHIVE, 'settings', return_value=config), patch.object(ARCHIVE, 'kick') as kick, \
                patch.object(ARCHIVE, 'capture') as capture, patch('sys.argv', ['archive', 'hook']), \
                patch('sys.stdin', io.StringIO('{}')):
            ARCHIVE.main()
            capture.assert_not_called()
            kick.assert_not_called()
        with patch.object(ARCHIVE, 'settings', return_value={**config, 'enabled': False}), \
                patch('sys.argv', ['archive', 'publish']), patch('sys.stdout', new_callable=io.StringIO) as output:
            ARCHIVE.main()
        self.assertFalse(json.loads(output.getvalue())['queued'])
        self.assertEqual(self.jobs(), [])


if __name__ == '__main__':
    unittest.main()
