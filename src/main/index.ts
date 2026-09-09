import { readProductsExcel } from './product-import';
import { copyFileSync } from 'node:fs';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  session,
} from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Store } from './database';
import { DocumentView, documentStyles } from '../shared/DocumentView';
import { errorMessage } from '../shared/domain';
let store: Store;
let main: BrowserWindow;
let dataDir: string;
const rendererPath = join(__dirname, '../renderer/index.html');
const devUrl = !app.isPackaged ? process.env.TESIR_DEV_URL : undefined;
const entryUrl = devUrl
  ? new URL(devUrl).href
  : pathToFileURL(rendererPath).href;
if (!app.isPackaged && process.env.TESIR_DATA_DIR)
  app.setPath('userData', process.env.TESIR_DATA_DIR);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (main) {
      if (main.isMinimized()) main.restore();
      main.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      dataDir = app.getPath('userData');
      store = new Store(join(dataDir, 'tesir.db'));
      session.defaultSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      registerHandlers();
      await createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox('تعذر فتح تأثير', errorMessage(error));
      app.quit();
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => {
    if (!store) return;
    try {
      automaticBackup();
    } catch (error) {
      dialog.showErrorBox('تعذر النسخ الاحتياطي', errorMessage(error));
    }
    store.close();
  });
}
async function createWindow() {
  main = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1050,
    minHeight: 720,
    backgroundColor: '#f5f7f6',
    title: 'تأثير | Tesir Invoice',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  main.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  main.webContents.on('will-navigate', (event) => event.preventDefault());
  main.webContents.on('will-attach-webview', (event) => event.preventDefault());
  main.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(main, {
      type: 'question',
      buttons: ['البقاء', 'تجاهل التغييرات وإغلاق'],
      defaultId: 0,
      cancelId: 0,
      title: 'تغييرات غير محفوظة',
      message: 'هل تريد إغلاق التطبيق دون حفظ التغييرات؟',
    });
    if (choice === 1) event.preventDefault();
  });
  await main.loadURL(entryUrl);
}
function registerHandlers() {
  const handle = (channel: string, work: (input: unknown) => unknown) =>
    ipcMain.handle(`tesir:${channel}`, async (event, input) => {
      try {
        if (
          event.sender !== main.webContents ||
          event.senderFrame !== main.webContents.mainFrame ||
          event.senderFrame.url.split('#')[0] !== entryUrl
        )
          throw new Error('طلب غير مسموح');
        return { ok: true, value: await work(input) };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    });
  handle('import-products', (input) => store.importProducts(input));
  handle('read-products-excel', async () => {
    const result = await dialog.showOpenDialog(main, {
      title: 'استيراد المنتجات من Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const data = store.bootstrap();
    return readProductsExcel(
      result.filePaths[0],
      data.settings.currency,
      data.products,
    );
  });
  handle('download-products-template', async () => {
    const result = await dialog.showSaveDialog(main, {
      title: 'حفظ قالب المنتجات',
      defaultPath: 'Tesir-Products-Template.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return false;
    copyFileSync(
      join(__dirname, '../assets/products-template.xlsx'),
      result.filePath,
    );
    return true;
  });
  handle('bootstrap', () => store.bootstrap());
  handle('save-customer', (input) => store.saveCustomer(input));
  handle('save-product', (input) => store.saveProduct(input));
  handle('get-document', (id) => store.getDocument(id));
  handle('save-document', (input) => store.saveDocument(input));
  handle('save-settings', (input) => store.saveSettings(input));
  handle('save-template', (input) => store.saveTemplate(input));
  handle('add-type', (input) => store.addType(input));
  handle('import-image', async () => {
    const result = await dialog.showOpenDialog(main, {
      title: 'اختيار صورة القالب أو الختم',
      filters: [{ name: 'صور PNG / JPEG', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    const buffer = readFileSync(result.filePaths[0]);
    if (buffer.byteLength > 8 * 1024 * 1024)
      throw new Error('الحد الأقصى للصورة 8 ميغابايت');
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) throw new Error('الصورة غير صالحة');
    const size = image.getSize();
    if (size.width > 8000 || size.height > 8000)
      throw new Error('أبعاد الصورة كبيرة جداً');
    const png = image.toPNG();
    if (png.byteLength > 8 * 1024 * 1024)
      throw new Error('الصورة بعد المعالجة تتجاوز 8 ميغابايت');
    return `data:image/png;base64,${png.toString('base64')}`;
  });
  handle('backup', async () => {
    const result = await dialog.showSaveDialog(main, {
      title: 'حفظ نسخة احتياطية',
      defaultPath: `tesir-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite backup', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return false;
    if (existsSync(result.filePath))
      throw new Error(
        'اختر اسماً جديداً للنسخة الاحتياطية للحفاظ على الملفات الموجودة',
      );
    store.backup(result.filePath);
    return true;
  });
  handle('export-pdf', (id) => outputDocument(id, false));
  handle('print', (id) => outputDocument(id, true));
}
function automaticBackup() {
  const directory = join(dataDir, 'backups');
  mkdirSync(directory, { recursive: true });
  const filename = `tesir-auto-${Date.now()}.db`;
  store.backup(join(directory, filename));
  const files = readdirSync(directory)
    .filter((name) => /^tesir-auto-\d+\.db$/.test(name))
    .sort()
    .reverse();
  for (const old of files.slice(7)) unlinkSync(join(directory, old));
}
async function outputDocument(id: unknown, print: boolean): Promise<boolean> {
  const doc = store.getDocument(id);
  let output: string | undefined;
  if (!print) {
    const result = await dialog.showSaveDialog(main, {
      title: 'تصدير المستند إلى PDF',
      defaultPath: `${doc.number}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return false;
    output = result.filePath;
  }
  const top = doc.template?.marginTop ?? 20;
  const bottom = doc.template?.marginBottom ?? 20;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>${documentStyles}
    @page{size:A4;margin:${top}mm 14mm ${bottom}mm}html,body{margin:0;padding:0}.document-paper{width:auto;min-height:0;padding:0!important}.paper-background{position:fixed;left:-14mm;top:-${top}mm;width:210mm;height:297mm;max-width:none}.paper-stamp{position:fixed;left:${(doc.template?.stampX ?? 0) * 2.1 - 14}mm!important;top:${(doc.template?.stampY ?? 0) * 2.97 - top}mm!important;width:${(doc.template?.stampWidth ?? 18) * 2.1}mm!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body>${renderToStaticMarkup(createElement(DocumentView, { document: doc }))}</body></html>`;
  const temp = join(
    app.getPath('temp'),
    `tesir-print-${crypto.randomUUID()}.html`,
  );
  writeFileSync(temp, html, 'utf8');
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  try {
    await window.loadFile(temp);
    await window.webContents.executeJavaScript(
      'Promise.all(Array.from(document.images).map(i => i.decode())).then(() => document.fonts.ready).then(() => true)',
    );
    if (print)
      return await new Promise<boolean>((resolve, reject) =>
        window.webContents.print(
          { silent: false, printBackground: true, pageSize: 'A4' },
          (success, reason) => {
            if (success) resolve(true);
            else if (reason === 'cancelled') resolve(false);
            else reject(new Error(reason || 'تعذرت الطباعة'));
          },
        ),
      );
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    writeFileSync(output!, pdf);
    return true;
  } finally {
    window.destroy();
    unlinkSync(temp);
  }
}
