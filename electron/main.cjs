// Electron main process: window, local profiles, file-backed SQLite storage,
// encrypted API key storage and the Claude photo analysis call.
const { app, BrowserWindow, ipcMain, dialog, safeStorage, nativeTheme, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

const isDev = !!process.env.VITE_DEV_SERVER_URL
const dataRoot = () => path.join(app.getPath('userData'), 'data')
const profilesFile = () => path.join(dataRoot(), 'profiles.json')
const profileDir = (id) => {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Invalid profile id')
  return path.join(dataRoot(), 'profiles', id)
}

// ---------- small fs helpers ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

// ---------- profiles ----------
const unlocked = new Set()
const loadProfiles = () => readJson(profilesFile(), [])
const saveProfiles = (list) => writeAtomic(profilesFile(), JSON.stringify(list, null, 2))
const publicProfile = (p) => ({ id: p.id, name: p.name, color: p.color, hasPin: !!p.pinHash, createdAt: p.createdAt })
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex')

function requireUnlocked(id) {
  if (!unlocked.has(id)) throw new Error('Profile is locked')
}

ipcMain.handle('profiles:list', () => loadProfiles().map(publicProfile))

ipcMain.handle('profiles:create', (_e, { name, pin, color }) => {
  const trimmed = String(name || '').trim().slice(0, 40)
  if (!trimmed) throw new Error('Name is required')
  const list = loadProfiles()
  const p = { id: crypto.randomUUID(), name: trimmed, color: color || 'green', createdAt: new Date().toISOString() }
  if (pin) {
    p.salt = crypto.randomBytes(16).toString('hex')
    p.pinHash = hashPin(pin, p.salt)
  }
  list.push(p)
  saveProfiles(list)
  fs.mkdirSync(profileDir(p.id), { recursive: true })
  unlocked.add(p.id)
  return publicProfile(p)
})

ipcMain.handle('profiles:unlock', (_e, { id, pin }) => {
  const p = loadProfiles().find((x) => x.id === id)
  if (!p) throw new Error('Profile not found')
  if (p.pinHash) {
    const ok = crypto.timingSafeEqual(Buffer.from(hashPin(pin || '', p.salt), 'hex'), Buffer.from(p.pinHash, 'hex'))
    if (!ok) return false
  }
  unlocked.add(id)
  return true
})

ipcMain.handle('profiles:lock', (_e, { id }) => { unlocked.delete(id); return true })

ipcMain.handle('profiles:update', (_e, { id, name, color, pin, clearPin }) => {
  requireUnlocked(id)
  const list = loadProfiles()
  const p = list.find((x) => x.id === id)
  if (!p) throw new Error('Profile not found')
  if (name) p.name = String(name).trim().slice(0, 40)
  if (color) p.color = color
  if (clearPin) { delete p.pinHash; delete p.salt }
  if (pin) { p.salt = crypto.randomBytes(16).toString('hex'); p.pinHash = hashPin(pin, p.salt) }
  saveProfiles(list)
  return publicProfile(p)
})

ipcMain.handle('profiles:delete', (_e, { id }) => {
  requireUnlocked(id)
  saveProfiles(loadProfiles().filter((x) => x.id !== id))
  fs.rmSync(profileDir(id), { recursive: true, force: true })
  unlocked.delete(id)
  return true
})

// ---------- database file ----------
ipcMain.handle('db:load', (_e, { id }) => {
  requireUnlocked(id)
  const file = path.join(profileDir(id), 'data.sqlite')
  return fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : null
})

ipcMain.handle('db:save', (_e, { id, bytes }) => {
  requireUnlocked(id)
  writeAtomic(path.join(profileDir(id), 'data.sqlite'), Buffer.from(bytes))
  return true
})

// ---------- API key (encrypted with the OS keychain via safeStorage / DPAPI on Windows) ----------
const keyFile = (id) => path.join(profileDir(id), 'anthropic-key.bin')
function readKey(id) {
  const f = keyFile(id)
  if (!fs.existsSync(f)) return null
  const raw = fs.readFileSync(f)
  return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8')
}

ipcMain.handle('key:set', (_e, { id, key }) => {
  requireUnlocked(id)
  const k = String(key || '').trim()
  if (!k) throw new Error('Key is empty')
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(k) : Buffer.from(k, 'utf8')
  writeAtomic(keyFile(id), data)
  return { set: true, hint: k.slice(-4), encrypted: safeStorage.isEncryptionAvailable() }
})

ipcMain.handle('key:status', (_e, { id }) => {
  requireUnlocked(id)
  const k = readKey(id)
  return { set: !!k, hint: k ? k.slice(-4) : null, encrypted: safeStorage.isEncryptionAvailable() }
})

ipcMain.handle('key:clear', (_e, { id }) => {
  requireUnlocked(id)
  fs.rmSync(keyFile(id), { force: true })
  return { set: false, hint: null }
})

// ---------- meal photo analysis ----------
const { system: SYSTEM_PROMPT, schema: MEAL_SCHEMA } = require('../shared/meal-prompt.json')

ipcMain.handle('meal:analyze', async (_e, { id, imageBase64, mediaType, model, note }) => {
  requireUnlocked(id)
  const apiKey = readKey(id)
  if (!apiKey) throw new Error('NO_KEY')
  const Anthropic = require('@anthropic-ai/sdk').default
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 })
  const response = await client.beta.messages.create({
    model: model || 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: MEAL_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: note ? `Context from the user: ${note}` : 'Estimate this meal.' },
      ],
    }],
  })
  if (response.stop_reason === 'refusal') throw new Error('The model declined to analyze this photo.')
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return JSON.parse(text)
})

// ---------- backup ----------
ipcMain.handle('backup:export', async (e, { suggestedName, json }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'Forma backup', extensions: ['json'] }],
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, json)
  return filePath
})

ipcMain.handle('backup:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Forma backup', extensions: ['json'] }],
  })
  if (canceled || !filePaths[0]) return null
  return fs.readFileSync(filePaths[0], 'utf8')
})

ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: dataRoot() }))
ipcMain.handle('app:openDataFolder', () => shell.openPath(dataRoot()))

// ---------- window ----------
function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c0d0f' : '#f6f6f4',
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? { color: '#00000000', symbolColor: '#8a8f98', height: 36 } : false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  return win
}

ipcMain.on('theme:set', (e, mode) => {
  nativeTheme.themeSource = mode === 'system' ? 'system' : mode
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win && process.platform === 'win32') {
    win.setTitleBarOverlay({ color: '#00000000', symbolColor: mode === 'light' ? '#5b606a' : '#8a8f98', height: 36 })
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
