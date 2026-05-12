import { BrowserWindow } from 'electron'

export interface MigrationWindowProgress {
  current: number
  total: number
  name: string
  status: 'running' | 'applied'
}

function friendlyMigrationName(name: string): string {
  return name
    .replace(/^\d+_/, '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function migrationHtml(total: number): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #020617;
        color: #f8fafc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: grid;
        place-items: center;
      }
      .shell {
        width: 100%;
        height: 100%;
        padding: 42px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.16), transparent 32%),
          linear-gradient(145deg, #08111f, #050914 70%);
      }
      .badge {
        width: 54px;
        height: 54px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: rgba(34, 197, 94, 0.12);
        color: #22c55e;
        margin-bottom: 24px;
      }
      .badge svg {
        width: 28px;
        height: 28px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
        line-height: 1.1;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: #a5b4c7;
        font-size: 15px;
        line-height: 1.6;
      }
      .progress-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-top: 34px;
        color: #cbd5e1;
        font-size: 13px;
      }
      .progress-track {
        height: 12px;
        margin-top: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(148, 163, 184, 0.16);
        border: 1px solid rgba(148, 163, 184, 0.16);
      }
      .progress-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #22c55e, #16a34a);
        transition: width 220ms ease;
      }
      .migration-name {
        margin-top: 16px;
        color: #94a3b8;
        font-size: 13px;
        min-height: 22px;
      }
      .error {
        color: #fca5a5;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </div>
      <h1>Migrando dados para a vers&atilde;o 1.1.1</h1>
      <p>Aguarde enquanto o MoneyCapy atualiza a estrutura dos dados da vers&atilde;o 1.1.0 para a vers&atilde;o 1.1.1.</p>
      <div class="progress-meta">
        <span id="status">Preparando migra&ccedil;&atilde;o</span>
        <strong id="count">0/${total}</strong>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div id="fill" class="progress-fill"></div>
      </div>
      <div id="migrationName" class="migration-name"></div>
    </main>
    <script>
      const fill = document.getElementById('fill');
      const count = document.getElementById('count');
      const status = document.getElementById('status');
      const migrationName = document.getElementById('migrationName');

      window.__setMigrationProgress = (progress) => {
        const total = Math.max(progress.total || 0, 1);
        const current = Math.min(Math.max(progress.current || 0, 0), total);
        const percent = Math.round((current / total) * 100);
        fill.style.width = percent + '%';
        count.textContent = current + '/' + total;
        status.textContent = progress.status === 'applied' ? 'Migra\\u00e7\\u00e3o aplicada' : 'Aplicando migra\\u00e7\\u00e3o';
        migrationName.textContent = progress.name || '';
      };

      window.__setMigrationComplete = () => {
        fill.style.width = '100%';
        status.textContent = 'Migra\\u00e7\\u00e3o conclu\\u00edda';
        count.textContent = '${total}/${total}';
        migrationName.textContent = 'Abrindo o MoneyCapy...';
      };

      window.__setMigrationError = (message) => {
        status.textContent = 'N\\u00e3o foi poss\\u00edvel concluir a migra\\u00e7\\u00e3o';
        migrationName.className = 'migration-name error';
        migrationName.textContent = message || 'Erro desconhecido';
      };
    </script>
  </body>
</html>`
}

export async function createMigrationProgressWindow(iconPath: string, total: number): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 560,
    height: 380,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    backgroundColor: '#020617',
    icon: iconPath,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(migrationHtml(total))}`)
  return window
}

export function updateMigrationProgress(window: BrowserWindow | null, progress: MigrationWindowProgress): void {
  if (!window || window.isDestroyed()) return

  const payload = {
    ...progress,
    name: friendlyMigrationName(progress.name)
  }

  window.webContents.executeJavaScript(`window.__setMigrationProgress(${JSON.stringify(payload)})`).catch(() => {})
}

export function completeMigrationProgress(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return
  window.webContents.executeJavaScript('window.__setMigrationComplete()').catch(() => {})
}

export function failMigrationProgress(window: BrowserWindow | null, error: unknown): void {
  if (!window || window.isDestroyed()) return
  const message = error instanceof Error ? error.message : 'Erro desconhecido'
  window.webContents.executeJavaScript(`window.__setMigrationError(${JSON.stringify(message)})`).catch(() => {})
}
