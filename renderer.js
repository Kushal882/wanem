window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const titleInput = document.getElementById('note-title');
    const saveBtn = document.getElementById('save');
    const saveAsBtn = document.getElementById('save-as');
    const openFileBtn = document.getElementById('open-file');
    const newNoteBtn = document.getElementById('new-note');
    const noteList = document.getElementById('note-list');
    const statusEl = document.getElementById('save_status');
    const lockNoteBtn = document.getElementById('lock-note');


    // State
    let notes = [];
    let currentNoteId = null;
    let lastSavedContent = '';
    let debounceTimer = null;
    let currentFilter = '';

    const confirmUnsavedChanges = async () => {
        if (textarea.value !== lastSavedContent) {
            const res = await window.electronAPI.newNote();
            return res.confirmed;
        }
        return true;
    };

    const notify = (title, body) => {
        if (window.electronAPI.showNotification) {
            window.electronAPI.showNotification({ title, body });
        }
    };

    // Load notes from main process
    try {
        notes = await window.electronAPI.getNotes() || [];
    } catch (err) {
        console.error('Failed to load notes:', err);
        notes = [];
    }

    const createNewNote = async () => {
        if (!(await confirmUnsavedChanges())) return;

        const newNote = {
            id: Date.now().toString(),
            title: 'Untitled',
            content: '',
            pin: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveNoteJson(newNote);
        notes.unshift(newNote);
        currentNoteId = newNote.id;
        titleInput.value = '';
        textarea.value = '';
        lastSavedContent = '';
        renderNoteList();
        titleInput.focus();
        updateWordCount();
        if (statusEl) statusEl.textContent = 'New note created.';
        notify('Quick Note', 'New note created successfully.');
    };

    const renderNoteList = () => {
        noteList.innerHTML = '';

        const sorted = [...notes].sort((a, b) => {
            if (a.pin === b.pin) {
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            }
            return a.pin ? -1 : 1;
        });

        const filtered = currentFilter.trim() === ''
            ? sorted
            : sorted.filter(note => {
                const query = currentFilter.toLowerCase();
                return (note.title || '').toLowerCase().includes(query)
                    || (note.content || '').toLowerCase().includes(query);
            });

        filtered.forEach(note => {
            const item = document.createElement('div');
            item.className = 'note-item' + (note.id === currentNoteId ? ' active' : '');
            item.innerHTML = `
                <button class="note-item-pin" data-id="${note.id}">${note.pin ? '📌' : '📍'}</button>
                <button class="note-item-delete" data-id="${note.id}">x</button>
                <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
            `;

            item.addEventListener('click', async (e) => {
                if (e.target.classList && (e.target.classList.contains('note-item-delete') || e.target.classList.contains('note-item-pin'))) return;
                await switchNote(note.id);
            });

            const pinBtn = item.querySelector('.note-item-pin');
            if (pinBtn) {
                pinBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await togglePin(note.id);
                });
            }

            const delBtn = item.querySelector('.note-item-delete');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await deleteNote(note.id);
                });
            }

            noteList.appendChild(item);
        });
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const switchNote = async (id) => {
        if (!(await confirmUnsavedChanges())) return false;

        const note = notes.find(n => n.id === id);
        if (!note) return false;
        
        currentNoteId = note.id;
        titleInput.value = note.title || '';
        textarea.value = note.content || '';
        lastSavedContent = note.content || '';
        updateWordCount();
        if (statusEl) statusEl.textContent = '';
        renderNoteList();
        return true;
    };

    const saveCurrentNote = async (manualSave = false) => {
        if (!currentNoteId) {
            const newNote = {
                id: Date.now().toString(),
                title: titleInput.value || 'Untitled',
                content: textarea.value,
                pin: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await window.electronAPI.saveNoteJson(newNote);
            notes.unshift(newNote);
            currentNoteId = newNote.id;
            lastSavedContent = textarea.value;
            renderNoteList();
            if (statusEl) statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
            if (manualSave) notify('Quick Note', 'Note saved successfully.');
            return;
        }
        
        const note = {
            id: currentNoteId,
            title: titleInput.value || 'Untitled',
            content: textarea.value
        };
        await window.electronAPI.saveNoteJson(note);
        lastSavedContent = textarea.value;
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) {
            notes[index] = { ...notes[index], ...note, updatedAt: new Date().toISOString() };
        }
        renderNoteList();
        if (statusEl) statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
        if (manualSave) notify('Quick Note', 'Note saved successfully.');
    };

    const deleteNote = async (id) => {
        const res = await window.electronAPI.newNote();
        if (!res.confirmed) return;
        
        await window.electronAPI.deleteNoteJson(id);
        notes = notes.filter(n => n.id !== id);
        
        if (currentNoteId === id) {
            if (notes.length > 0) {
                const nextNote = notes.find(n => n.pin) || notes[0];
                await switchNote(nextNote.id);
            } else {
                currentNoteId = null;
                titleInput.value = '';
                textarea.value = '';
                lastSavedContent = '';
                updateWordCount();
                if (statusEl) statusEl.textContent = 'Note deleted.';
            }
        }
        renderNoteList();
        notify('Quick Note', 'Note deleted successfully.');
    };

    const togglePin = async (id) => {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        
        const updatedNote = { ...note, pin: !note.pin };
        await window.electronAPI.saveNoteJson(updatedNote);
        
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index] = updatedNote;
        }
        
        renderNoteList();
    };

    function updateWordCount() {
        const text = textarea.value;
        const characters = text.length;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const wordCountEl = document.getElementById('word-count');
        if (wordCountEl) {
            wordCountEl.textContent = `Words: ${words} | Characters: ${characters}`;
        }
    }

    const fontIncreaseBtn = document.getElementById('font-increase');
    const fontDecreaseBtn = document.getElementById('font-decrease');
    let currentFontSize = 16;

    function applyFontSize(size) {
        currentFontSize = Math.min(32, Math.max(10, size));
        if (textarea) textarea.style.fontSize = `${currentFontSize}px`;
    }

    const saveCurrentFontSize = async () => {
        try {
            await window.electronAPI.saveSettings({ fontSize: currentFontSize });
        } catch (err) {
            console.error('Failed to save font size setting:', err);
        }
    };

    const darkModeBtn = document.getElementById('dark-mode-toggle');
    let isDarkMode = false;

    function applyDarkMode(enabled) {
        isDarkMode = enabled;
        if (enabled) {
            document.body.classList.add('dark-mode');
            if (darkModeBtn) darkModeBtn.textContent = 'Light mode';
        } else {
            document.body.classList.remove('dark-mode');
            if (darkModeBtn) darkModeBtn.textContent = 'Dark mode';
        }
    }

    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentFilter = searchInput.value;
            renderNoteList();
        });
    }

    // Menu event handlers
    if (window.electronAPI.onMenuNewNote) window.electronAPI.onMenuNewNote(() => createNewNote());
    if (window.electronAPI.onMenuOpenFile) window.electronAPI.onMenuOpenFile(() => { if (openFileBtn) openFileBtn.click(); });
    if (window.electronAPI.onMenuSaveNote) window.electronAPI.onMenuSaveNote(() => saveCurrentNote(true));
    if (window.electronAPI.onMenuSaveAs) window.electronAPI.onMenuSaveAs(() => { if (saveAsBtn) saveAsBtn.click(); });
    if (window.electronAPI.onMenuDeleteNote) window.electronAPI.onMenuDeleteNote(() => { if (currentNoteId) deleteNote(currentNoteId); });

    // UI Events
    if (saveBtn) saveBtn.addEventListener('click', () => saveCurrentNote(true));

    if (saveAsBtn) saveAsBtn.addEventListener('click', async () => {
        try {
            const { canceled, success, filePath } = await window.electronAPI.saveAs(textarea.value);
            if (success && !canceled && filePath) {
                if (statusEl) statusEl.textContent = `Note saved as ${filePath}`;
                notify('Quick Note', 'Note saved as file successfully.');
            }
        } catch (err) {
            console.error('Save As failed:', err);
            if (statusEl) statusEl.textContent = 'Save As failed';
        }
    });

    if (openFileBtn) openFileBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.openFile();
        if (result && result.success) {
            textarea.value = result.content;
            lastSavedContent = result.content;
            updateWordCount();
            if (statusEl) statusEl.textContent = `Opened ${result.filePath}`;
            notify('Quick Note', 'File opened successfully.');
        } else if (result && result.canceled) {
            if (statusEl) statusEl.textContent = 'Open file cancelled';
        } else {
            if (statusEl) statusEl.textContent = 'Open file failed';
        }
    });

    if (newNoteBtn) newNoteBtn.addEventListener('click', createNewNote);

    if (textarea) {
        textarea.addEventListener('input', () => {
            if (statusEl) statusEl.textContent = 'Unsaved changes...';
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => saveCurrentNote(false), 5000);
            updateWordCount();
        });
    }
    
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => saveCurrentNote(false), 5000);
        });
    }

    if (fontIncreaseBtn) {
        fontIncreaseBtn.addEventListener('click', async () => {
            applyFontSize(currentFontSize + 2);
            await saveCurrentFontSize();
        });
    }

    if (fontDecreaseBtn) {
        fontDecreaseBtn.addEventListener('click', async () => {
            applyFontSize(currentFontSize - 2);
            await saveCurrentFontSize();
        });
    }

    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', async () => {
            const newMode = !isDarkMode;
            applyDarkMode(newMode);
            try {
                await window.electronAPI.saveSettings({ darkMode: newMode });
            } catch (err) {
                console.error('Failed to save dark mode setting:', err);
            }
        });
    }

    // Load settings
    try {
        const settings = await window.electronAPI.getSettings() || {};
        applyFontSize(settings.fontSize || 16);
        applyDarkMode(settings.darkMode || false);
    } catch (err) {
        console.error('Failed to load settings:', err);
        applyFontSize(16);
        applyDarkMode(false);
    }

    // Initialize
    if (notes.length > 0) {
        const mostRecent = notes.reduce((a, b) => (new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b));
        await switchNote(mostRecent.id);
    } else {
        await createNewNote();
    }

    renderNoteList();
    updateWordCount();
});