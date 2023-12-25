import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  protocol,
  net,
  session as sessionImport,
} from 'electron';
// @ts-ignore
import randomport from 'random-port';
import chalk from 'chalk';
import createApp from './express';
import path from 'path';
import { readFileSync } from 'fs';
import { z } from 'zod';
import semver from 'semver';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) app.quit();

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
);
const v = pkg.version;
const prefix = `${chalk.grey('[')}${chalk.green(`Cinny Host ${v}`)}${chalk.grey(
  ']',
)}`;

const priv = [
  {
    scheme: 'cinny',
    privileges: {
      bypassCSP: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
];
protocol.registerSchemesAsPrivileged(priv);

const createWindow = (): void => {
  // Create the browser window.
  const partition = 'persist:app';
  const session = sessionImport.fromPartition(partition);
  try {
    if (typeof session.protocol.registerSchemesAsPrivileged === 'function')
      session.protocol.registerSchemesAsPrivileged(priv);
  } catch (error) {
    console.warn(prefix, 'Got error while trying to privelege schema', error);
  }
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      partition,
      session,
    },
    icon: path.resolve(__dirname, 'static', 'favicon.png'),
    darkTheme: true,
    minHeight: 400,
    minWidth: 400,
    title: 'Cinny Desktop',
    backgroundColor: '#1a1a1a',
    hasShadow: false,
    roundedCorners: true,
    // if you want to handle your own taskbar:
    // transparent: true,
    // frame: false,
  });
  // make new tabs open in user browser
  const registerOpenHandler = (window: BrowserWindow) =>
    window.webContents.setWindowOpenHandler(h => {
      shell.openExternal(h.url);
      return {
        action: 'deny',
      };
    });
  registerOpenHandler(mainWindow);
  mainWindow.setMenuBarVisibility(false);
  // load the app
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  console.log(`${prefix} Searching for port & binding to it...`);
  const expressApp = createApp();
  randomport(
    {
      from: 1024,
      to: 42070, // (not 42069 to allow 42069 as an option)
    },
    (p: number) =>
      expressApp.listen(p, '127.0.0.1', () => {
        console.log(
          `${prefix} Listening on http://127.0.0.1:%d/ - Loading page`,
          p,
        );
        session.protocol.handle('cinny', request =>
          net.fetch(
            `http://127.0.0.1:${p}/${request.url.slice('cinny://app/'.length)}`,
          ),
        );
        mainWindow.loadURL(`cinny://app/`);
        (async () => {
          console.log(`${prefix} Checking for updates...`);
          const updCheckRes = z
            .object({
              name: z.string(),
              tag_name: z.string(),
              target_commitish: z.string(),
              draft: z.boolean(),
              prerelease: z.boolean(),
            })
            .parse(
              await fetch(
                'https://api.github.com/repos/Exponential-Workload/cinny-desktop/releases/latest',
              ).then(v => v.json()),
            );
          console.log(
            `${prefix} Found Version ${updCheckRes.name} (current is ${v})`,
          );
          const currentSemver = semver.parse(v);
          const newSemver = semver.parse(updCheckRes.name);
          if (newSemver.compare(currentSemver) === 1) {
            const bw = new BrowserWindow({
              height: 400,
              width: 400,
              webPreferences: {
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
                session,
                partition,
              },
              icon: path.resolve(__dirname, 'static', 'favicon.png'),
              darkTheme: true,
              minHeight: 400,
              minWidth: 400,
              maxHeight: 500,
              maxWidth: 500,
              title: 'Cinny Desktop - Update Checker',
              backgroundColor: '#1a1a1a',
              hasShadow: false,
              roundedCorners: true,
            });
            bw.setMenuBarVisibility(false);
            registerOpenHandler(bw);
            await bw.loadURL(
              `cinny://app/update-notif?old=${encodeURIComponent(
                currentSemver.version,
              )}&new=${encodeURIComponent(newSemver.version)}`,
            );
          }
        })().catch(e =>
          console.error(`${prefix} Error during update check:`, e),
        );
      }),
  );
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('ready', () => {
  // 2nd arg to handle can be asynchronous!
  ipcMain.handle(
    'greet',
    (event, name?: string) =>
      `Hello from Electron Main Process, ${name ?? 'User'}!`,
  );
  ipcMain.handle('close-window', (event, name?: string) => {
    event.sender.close();
  });
  ipcMain.handle('close-app', (event, name?: string) => {
    app.quit();
  });
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('exit', () => {
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
