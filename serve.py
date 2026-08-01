#!/usr/bin/env python3
"""开发服务器：与 python -m http.server 相同，但为所有响应附加
Cache-Control: no-store，根治浏览器启发式缓存旧版 JS 模块的问题
（ES module 链式 import 无法逐文件加版本 query，服务器端禁缓存是一劳永逸的正解）。

用法: python3 serve.py [端口=8080]
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):  # 静默请求日志，保持控制台干净
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with http.server.ThreadingHTTPServer(('', port), NoCacheHandler) as srv:
        print(f'🎯 dev server @ http://localhost:{port} (Cache-Control: no-store)')
        srv.serve_forever()
