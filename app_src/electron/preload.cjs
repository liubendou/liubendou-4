const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('liubendou', {
  chat: (payload) => ipcRenderer.invoke('chat:start', payload),
  cancel: (requestId) => ipcRenderer.send('chat:cancel', requestId),
  info: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:open', url),
  onChunk: (cb) => {
    const h = (_e, data) => cb(data)
    ipcRenderer.on('chat:chunk', h)
    return () => ipcRenderer.removeListener('chat:chunk', h)
  },
  onDone: (cb) => {
    const h = (_e, data) => cb(data)
    ipcRenderer.on('chat:done', h)
    return () => ipcRenderer.removeListener('chat:done', h)
  },
  // 六小豆桌宠支持
  togglePet: () => ipcRenderer.invoke('pet:toggle'),
  showMain: () => ipcRenderer.send('pet:show-main'),
  hidePet: () => ipcRenderer.send('pet:hide'),
  setAlwaysOnTop: (val) => ipcRenderer.send('pet:set-top', val),
  petDragStart: () => ipcRenderer.send('pet:drag-start'),
  petDragMove: (dx, dy) => ipcRenderer.send('pet:drag-move', { dx, dy }),
})
