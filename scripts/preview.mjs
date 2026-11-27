import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../docs/', import.meta.url));
const port = Number(process.env.GUIDE_PORT ?? '8799');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.sb3': 'application/octet-stream'
};

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {Allow: 'GET, HEAD'}).end();
    return;
  }
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const local = path.resolve(root, '.' + pathname);
    const relative = path.relative(root, local);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(404).end();
      return;
    }
    const info = await stat(local);
    if (info.isDirectory() && !url.pathname.endsWith('/')) {
      response.writeHead(302, {Location: url.pathname + '/' + url.search}).end();
      return;
    }
    const filename = info.isDirectory() ? path.join(local, 'index.html') : local;
    const contentType = mime[path.extname(filename)];
    if (!contentType) {
      response.writeHead(404).end();
      return;
    }
    const bytes = await readFile(filename);
    response.writeHead(200, {'Content-Type': contentType, 'Content-Length': bytes.length});
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400).end();
  }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port + '/'));
