// Narrow, typed bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron')

const call = (channel, args) => ipcRenderer.invoke(channel, args)

contextBridge.exposeInMainWorld('forma', {
  isDesktop: true,
  profiles: {
    list: () => call('profiles:list'),
    create: (args) => call('profiles:create', args),
    unlock: (args) => call('profiles:unlock', args),
    lock: (args) => call('profiles:lock', args),
    update: (args) => call('profiles:update', args),
    remove: (args) => call('profiles:delete', args),
  },
  db: {
    load: (id) => call('db:load', { id }),
    save: (id, bytes) => call('db:save', { id, bytes }),
  },
  key: {
    set: (id, key) => call('key:set', { id, key }),
    status: (id) => call('key:status', { id }),
    clear: (id) => call('key:clear', { id }),
  },
  meal: { analyze: (args) => call('meal:analyze', args) },
  backup: {
    export: (suggestedName, json) => call('backup:export', { suggestedName, json }),
    import: () => call('backup:import'),
  },
  app: {
    info: () => call('app:info'),
    openDataFolder: () => call('app:openDataFolder'),
    setTheme: (mode) => ipcRenderer.send('theme:set', mode),
  },
})
