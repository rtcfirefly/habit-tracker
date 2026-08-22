class ImportExportManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.onDataChanged = null;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    const exportButton = document.getElementById('export-button');
    const importButton = document.getElementById('import-button');
    const fileInput = document.getElementById('import-file-input');

    exportButton.addEventListener('click', () => {
      this.exportData();
    });

    importButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
      this.handleFileImport(event);
    });
  }

  exportData() {
    try {
      this.dataManager.downloadExport();
      this.showMessage('Data exported successfully!', 'success');
    } catch (error) {
      this.showMessage(`Export failed: ${error.message}`, 'error');
    }
  }

  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      this.showMessage('Please select a valid JSON file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!this.confirmReplace()) {
        return;
      }

      const result = this.dataManager.importData(e.target.result);
      
      if (result.success) {
        this.showMessage(result.message, 'success');
        if (this.onDataChanged) {
          this.onDataChanged();
        }
      } else {
        this.showMessage(result.message, 'error');
      }
    };

    reader.onerror = () => {
      this.showMessage('Failed to read file', 'error');
    };

    reader.readAsText(file);
    event.target.value = '';
  }

  confirmReplace() {
    const habitCount = this.dataManager.getHabits().length;
    const dayCount = Object.keys(this.dataManager.getCompletions()).length;

    if (habitCount === 0 && dayCount === 0) {
      return true;
    }

    return confirm(
      `Importing replaces your ${habitCount} habit(s) and ${dayCount} day(s) of ` +
      `history. This cannot be undone - export first if you want a backup.\n\nContinue?`
    );
  }

  showMessage(message, type) {
    const existingMessage = document.querySelector('.import-export-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `import-export-message ${type}`;
    messageDiv.textContent = message;
    
    const form = document.querySelector('.form');
    form.insertAdjacentElement('afterend', messageDiv);

    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 4000);
  }
}