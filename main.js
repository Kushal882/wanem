const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

// Initialize settings file if it doesn't exist
if (!fs.existsSync(settingsFilePath)) {
    fs.writeFileSync(settingsFilePath, JSON.stringify({}));
}

app.disableHardwareAcceleration();

// Path to JSON storage for notes (use correct userData key)
const notesFilePath = path.join(app.getPath('userData'), 'notes.json');
const textFileFilter = [{ name: 'Text Files', extensions: ['txt'] }];

function createTextDialogOptions(options) {
    return {
        ...options,
        filters: textFileFilter
    };
}

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
    //hide window instead od closing
    win.on('close', (event) => {
        event.preventDefault(); // stop the window from actually closing
        win.hide(); //  hide it instead
    });
}

function createMenuItem(label, accelerator, channel) {
    return {
        label,
        accelerator,
        click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
                win.webContents.send(channel);
            }
        }
    };
}

function createMenu() {
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                createMenuItem('New Note', 'CmdOrCtrl+N', 'menu-new-note'),
                createMenuItem('Open File', 'CmdOrCtrl+O', 'menu-open-file'),
                createMenuItem('Save', 'CmdOrCtrl+S', 'menu-save-note'),
                createMenuItem('Save As', 'CmdOrCtrl+Shift+S', 'menu-save-as'),
                createMenuItem('Delete Note', 'CmdOrCtrl+D', 'menu-delete-note'),
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();
    createMenu();

    // Create system tray
    let tray = null;
    try {
        tray = new Tray(path.join(__dirname, '5394835.png'));
        const trayMenu = Menu.buildFromTemplate([
            { label: 'Show App', click: () => { const w = BrowserWindow.getAllWindows()[0]; if (w) w.show(); } },
            { label: 'Quit', click: () => app.quit() }
        ]);
        tray.setToolTip('Quick Note Taker');
        tray.setContextMenu(trayMenu);

        tray.on('double-click', () => {
            const w = BrowserWindow.getAllWindows()[0];
            if (!w) return;
            if (w.isVisible()) w.hide(); else w.show();
        });
    } catch (err) {
        // If tray cannot be created (some platforms), continue without it
        console.warn('Tray icon not available:', err && err.message);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Legacy single-text-file handlers removed — app now uses JSON storage and
// explicit 'save-as' / 'open-file' handlers for importing/exporting text files.

// Save as handler
ipcMain.handle('save-as', async (event, text) => {
    const { canceled, filePath } = await dialog.showSaveDialog(createTextDialogOptions({
        title: 'Save Note As',
        defaultPath: path.join(app.getPath('documents'), 'quick-note.txt')
    }));

    if (canceled || !filePath) {
        return { canceled: true };
    }

    fs.writeFileSync(filePath, text, 'utf-8');
    return { canceled: false, success: true, filePath };
});

// New note handler
ipcMain.handle('new-note', async () => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['discard changes', 'cancel'],
        defaultId: 1,
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Do you want to discard them and start a new note?'
    });
    return { confirmed: result.response === 0 };
});

// Open file handler
ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog(createTextDialogOptions({
        properties: ['openFile']
    }));

    if (result.canceled) {
        return { canceled: true, success: false };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
});

// Duplicate tray setup removed (already created during initial `app.whenReady`)
// NEW: Helper — read all notes from the JSON file
function readNotes() {
    if (!fs.existsSync(notesFilePath)) {
        return []; // return empty array if file does not exist yet
    }
    const raw = fs.readFileSync(notesFilePath, 'utf-8');
    const notes = JSON.parse(raw);
    return Array.isArray(notes)
        ? notes.map(note => ({ ...note, pin: note.pin ?? false }))
        : [];
}

// NEW: Helper — write all notes to the JSON file
function writeNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

// NEW: Get all notes
ipcMain.handle('get-notes', async () => {
    return readNotes();
});

// NEW: Delete a note (JSON storage)
ipcMain.handle('delete-note-json', async (event, id) => {
    const notes = readNotes();
    const filtered = notes.filter(n => n.id !== id);
    writeNotes(filtered);
    return { success: true };
});

// NEW: Save a note (create or update)
ipcMain.handle('save-note-json', async (event, note) => {
    const notes = readNotes();
    const index = notes.findIndex(n => n.id === note.id);
    const now = new Date().toISOString();

    console.log('Saving note:', note.id, note.title);

    if (index === -1) {
        // Note does not exist yet - create it
        notes.push({ ...note, pin: note.pin ?? false, createdAt: now, updatedAt: now });
    } else {
        // Note already exists - update it
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }

    writeNotes(notes);
    return { success: true };
});

// Notification helper
ipcMain.handle('show-notification', async (event, { title, body }) => {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
        return { success: true };
    }
    return { success: false, error: 'Notifications not supported' };
});

// NEW: Read settings from file
function readSettings() {
    if (!fs.existsSync(settingsFilePath)) {
        return { fontSize: 16 }; // default settings
    }

    const raw = fs.readFileSync(settingsFilePath, 'utf-8');
    return JSON.parse(raw);
}

// NEW: Write settings to file
function writeSettings(settings) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
}

// NEW: Get settings
ipcMain.handle('get-settings', async () => {
    return readSettings();
});

// NEW: Save settings
ipcMain.handle('save-settings', async (event, settings) => {
    const current = readSettings();
    const updated = { ...current, ...settings };
    writeSettings(updated);
    return { success: true };


});

// Toggle pin state of a note
ipcMain.handle('toggle-pin', async (event, id) => {
    const notes = readNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
        return { success: false };
    }
    // Use `pin` consistently across the app
    notes[index].pin = !notes[index].pin;
    writeNotes(notes);
    return { success: true, pin: notes[index].pin };
});



