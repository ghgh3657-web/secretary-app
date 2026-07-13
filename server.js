// 自分専用の秘書アプリ - Node.js標準モジュールのみで動作するサーバー
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MEMOS_FILE = path.join(DATA_DIR, 'memos.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// ---- データ保存まわりのユーティリティ ----

// dataフォルダと保存ファイルが無ければ作る
function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEMOS_FILE)) {
    fs.writeFileSync(MEMOS_FILE, '[]', 'utf8');
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, '[]', 'utf8');
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');
  }
}

// JSONファイルを読み込む（壊れていても空配列を返す）
function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// JSONファイルへ保存する
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// シンプルなユニークID
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- リクエストボディの読み取り ----
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// JSONレスポンスを返す
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ---- APIハンドラ ----

async function handleApi(req, res, url) {
  const { pathname } = url;

  // メモ一覧の取得
  if (pathname === '/api/memos' && req.method === 'GET') {
    return sendJson(res, 200, readJson(MEMOS_FILE));
  }

  // メモの追加
  if (pathname === '/api/memos' && req.method === 'POST') {
    const body = await readBody(req);
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    if (!title && !content) {
      return sendJson(res, 400, { error: 'タイトルまたは本文を入力してください' });
    }
    const memos = readJson(MEMOS_FILE);
    const memo = {
      id: makeId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    memos.unshift(memo);
    writeJson(MEMOS_FILE, memos);
    return sendJson(res, 201, memo);
  }

  // メモの編集
  if (pathname.startsWith('/api/memos/') && req.method === 'PUT') {
    const id = pathname.split('/')[3];
    const body = await readBody(req);
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    if (!title && !content) {
      return sendJson(res, 400, { error: 'タイトルまたは本文を入力してください' });
    }
    const memos = readJson(MEMOS_FILE);
    const memo = memos.find((m) => m.id === id);
    if (!memo) return sendJson(res, 404, { error: 'メモが見つかりません' });
    memo.title = title;
    memo.content = content;
    memo.updatedAt = new Date().toISOString();
    writeJson(MEMOS_FILE, memos);
    return sendJson(res, 200, memo);
  }

  // メモの削除
  if (pathname.startsWith('/api/memos/') && req.method === 'DELETE') {
    const id = pathname.split('/')[3];
    const memos = readJson(MEMOS_FILE).filter((m) => m.id !== id);
    writeJson(MEMOS_FILE, memos);
    return sendJson(res, 200, { ok: true });
  }

  // タスク一覧の取得
  if (pathname === '/api/tasks' && req.method === 'GET') {
    return sendJson(res, 200, readJson(TASKS_FILE));
  }

  // タスクの追加
  if (pathname === '/api/tasks' && req.method === 'POST') {
    const body = await readBody(req);
    const title = (body.title || '').trim();
    if (!title) {
      return sendJson(res, 400, { error: 'タスク内容を入力してください' });
    }
    const tasks = readJson(TASKS_FILE);
    const task = {
      id: makeId(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
    writeJson(TASKS_FILE, tasks);
    return sendJson(res, 201, task);
  }

  // タスクの編集（内容の書き換え）
  if (pathname.startsWith('/api/tasks/') && req.method === 'PUT') {
    const id = pathname.split('/')[3];
    const body = await readBody(req);
    const title = (body.title || '').trim();
    if (!title) {
      return sendJson(res, 400, { error: 'タスク内容を入力してください' });
    }
    const tasks = readJson(TASKS_FILE);
    const task = tasks.find((t) => t.id === id);
    if (!task) return sendJson(res, 404, { error: 'タスクが見つかりません' });
    task.title = title;
    task.updatedAt = new Date().toISOString();
    writeJson(TASKS_FILE, tasks);
    return sendJson(res, 200, task);
  }

  // タスクの完了状態を切り替え
  if (pathname.startsWith('/api/tasks/') && req.method === 'PATCH') {
    const id = pathname.split('/')[3];
    const tasks = readJson(TASKS_FILE);
    const task = tasks.find((t) => t.id === id);
    if (!task) return sendJson(res, 404, { error: 'タスクが見つかりません' });
    task.done = !task.done;
    writeJson(TASKS_FILE, tasks);
    return sendJson(res, 200, task);
  }

  // タスクの削除
  if (pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
    const id = pathname.split('/')[3];
    const tasks = readJson(TASKS_FILE).filter((t) => t.id !== id);
    writeJson(TASKS_FILE, tasks);
    return sendJson(res, 200, { ok: true });
  }

  // 週次振り返り一覧の取得（対象週の新しい順）
  if (pathname === '/api/reviews' && req.method === 'GET') {
    const reviews = readJson(REVIEWS_FILE).sort((a, b) => (a.week < b.week ? 1 : -1));
    return sendJson(res, 200, reviews);
  }

  // 週次振り返りの記録（同じ週があれば上書き＝週ごとに1件）
  if (pathname === '/api/reviews' && req.method === 'POST') {
    const body = await readBody(req);
    const week = (body.week || '').trim(); // 例: "2026-W28"
    const comment = (body.comment || '').trim();
    if (!week) return sendJson(res, 400, { error: '対象週を選択してください' });
    if (!comment) return sendJson(res, 400, { error: '振り返りコメントを入力してください' });
    const reviews = readJson(REVIEWS_FILE);
    const existing = reviews.find((r) => r.week === week);
    if (existing) {
      existing.comment = comment;
      existing.updatedAt = new Date().toISOString();
      writeJson(REVIEWS_FILE, reviews);
      return sendJson(res, 200, existing);
    }
    const review = {
      id: makeId(),
      week,
      comment,
      createdAt: new Date().toISOString(),
    };
    reviews.push(review);
    writeJson(REVIEWS_FILE, reviews);
    return sendJson(res, 201, review);
  }

  // 週次振り返りの削除
  if (pathname.startsWith('/api/reviews/') && req.method === 'DELETE') {
    const id = pathname.split('/')[3];
    const reviews = readJson(REVIEWS_FILE).filter((r) => r.id !== id);
    writeJson(REVIEWS_FILE, reviews);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Not Found' });
}

// ---- 静的ファイル配信 ----
function serveStatic(res) {
  const file = path.join(__dirname, 'public', 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('index.html を読み込めませんでした');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

// ---- サーバー起動 ----
ensureDataFiles();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(() => sendJson(res, 500, { error: 'サーバーエラー' }));
  } else {
    serveStatic(res);
  }
});

server.listen(PORT, () => {
  console.log(`秘書アプリを起動しました → http://localhost:${PORT}`);
});
