<<<<<<< HEAD
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // File import/export and dialogs
    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    openFile: () => ipcRenderer.invoke('open-file'),
    newNote: () => ipcRenderer.invoke('new-note'),

    // Menu event listeners (main -> renderer)
    onMenuNewNote: (callback) => ipcRenderer.on('menu-new-note', callback),
    onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', callback),
    onMenuSaveNote: (callback) => ipcRenderer.on('menu-save-note', callback),
    onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
    onMenuDeleteNote: (callback) => ipcRenderer.on('menu-delete-note', callback),

    // JSON storage APIs
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNoteJson: (id) => ipcRenderer.invoke('delete-note-json', id),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    showNotification: (notification) => ipcRenderer.invoke('show-notification', notification),
    togglePin: (id) => ipcRenderer.invoke('toggle-pin', id)

});
=======
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // File import/export and dialogs
    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    openFile: () => ipcRenderer.invoke('open-file'),
    newNote: () => ipcRenderer.invoke('new-note'),

    // Menu event listeners (main -> renderer)
    onMenuNewNote: (callback) => ipcRenderer.on('menu-new-note', callback),
    onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', callback),
    onMenuSaveNote: (callback) => ipcRenderer.on('menu-save-note', callback),
    onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
    onMenuDeleteNote: (callback) => ipcRenderer.on('menu-delete-note', callback),

    // JSON storage APIs
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNoteJson: (id) => ipcRenderer.invoke('delete-note-json', id),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    showNotification: (notification) => ipcRenderer.invoke('show-notification', notification),
    togglePin: (id) => ipcRenderer.invoke('toggle-pin', id)

});
>>>>>>> 8a8b15e65fd6958b6c3687628dcb901b34844c82
