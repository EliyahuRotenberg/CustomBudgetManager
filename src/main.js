const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const Database = require('./database/db');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database
function initDatabase() {
  db = new Database(path.join(app.getPath('userData'), 'budget.db'));
  return db;
}

// IPC Handlers
function setupIPC() {
  // Income operations
  ipcMain.handle('get-income-sources', async () => {
    return db.getIncomeSources();
  });

  ipcMain.handle('add-income-source', async (event, data) => {
    return db.addIncomeSource(data);
  });

  ipcMain.handle('update-income-source', async (event, id, data) => {
    return db.updateIncomeSource(id, data);
  });

  ipcMain.handle('delete-income-source', async (event, id) => {
    return db.deleteIncomeSource(id);
  });

  ipcMain.handle('record-income-received', async (event, data) => {
    return db.recordIncomeReceived(data);
  });

  ipcMain.handle('get-income-received', async (event, month, year) => {
    return db.getIncomeReceived(month, year);
  });

  // Obligation operations
  ipcMain.handle('get-obligations', async () => {
    return db.getObligations();
  });

  ipcMain.handle('add-obligation', async (event, data) => {
    return db.addObligation(data);
  });

  ipcMain.handle('update-obligation', async (event, id, data) => {
    return db.updateObligation(id, data);
  });

  ipcMain.handle('delete-obligation', async (event, id) => {
    return db.deleteObligation(id);
  });

  ipcMain.handle('record-obligation-paid', async (event, data) => {
    return db.recordObligationPaid(data);
  });

  ipcMain.handle('get-obligations-paid', async (event, month, year) => {
    return db.getObligationsPaid(month, year);
  });

  // Variable expenses
  ipcMain.handle('add-expense', async (event, data) => {
    return db.addExpense(data);
  });

  ipcMain.handle('update-expense', async (event, id, data) => {
    return db.updateExpense(id, data);
  });

  ipcMain.handle('delete-expense', async (event, id) => {
    return db.deleteExpense(id);
  });

  ipcMain.handle('get-expenses', async (event, month, year) => {
    return db.getExpenses(month, year);
  });

  ipcMain.handle('get-expense-categories', async () => {
    return db.getExpenseCategories();
  });

  ipcMain.handle('add-expense-category', async (event, name) => {
    return db.addExpenseCategory(name);
  });

  ipcMain.handle('update-expense-category', async (event, id, name) => {
    return db.updateExpenseCategory(id, name);
  });

  ipcMain.handle('delete-expense-category', async (event, id) => {
    return db.deleteExpenseCategory(id);
  });

  // Income received management
  ipcMain.handle('update-income-received', async (event, id, data) => {
    return db.updateIncomeReceived(id, data);
  });

  ipcMain.handle('delete-income-received', async (event, id) => {
    return db.deleteIncomeReceived(id);
  });

  // Obligations paid management
  ipcMain.handle('update-obligation-paid', async (event, id, data) => {
    return db.updateObligationPaid(id, data);
  });

  ipcMain.handle('delete-obligation-paid', async (event, id) => {
    return db.deleteObligationPaid(id);
  });

  // Goals
  ipcMain.handle('get-goals', async () => {
    return db.getGoals();
  });

  ipcMain.handle('update-goal', async (event, type, data) => {
    return db.updateGoal(type, data);
  });

  ipcMain.handle('get-goal-history', async (event, type) => {
    return db.getGoalHistory(type);
  });

  // Monthly snapshots
  ipcMain.handle('get-monthly-snapshot', async (event, month, year) => {
    return db.getMonthlySnapshot(month, year);
  });

  ipcMain.handle('get-monthly-trajectory', async (event, month, year) => {
    return db.getMonthlyTrajectory(month, year);
  });

  ipcMain.handle('get-dashboard-data', async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return {
      incomeSources: db.getIncomeSources(),
      incomeReceived: db.getIncomeReceived(month, year),
      obligations: db.getObligations(),
      obligationsPaid: db.getObligationsPaid(month, year),
      expenses: db.getExpenses(month, year),
      expenseCategories: db.getExpenseCategories(),
      goals: db.getGoals(),
      snapshot: db.getMonthlySnapshot(month, year)
    };
  });

  // Export
  ipcMain.handle('export-csv', async (event, type, month, year) => {
    return db.exportToCSV(type, month, year);
  });

  // System tray notifications
  ipcMain.handle('show-notification', async (event, title, body) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });
}

// Check for upcoming obligations and send notifications
function checkUpcomingObligations() {
  const now = new Date();
  const obligations = db.getObligations();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const obligationsPaid = db.getObligationsPaid(month, year);

  const paidIds = new Set(obligationsPaid.map(o => o.obligation_id));

  obligations.forEach(obligation => {
    if (paidIds.has(obligation.id)) return;

    const daysUntilDue = obligation.due_date - now.getDate();

    if (daysUntilDue >= 0 && daysUntilDue <= 7) {
      if (Notification.isSupported()) {
        new Notification({
          title: 'Upcoming Payment',
          body: `${obligation.name} (₪${obligation.amount}) due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`
        }).show();
      }
    }
  });
}

app.whenReady().then(() => {
  initDatabase();
  setupIPC();
  createWindow();

  // Check for notifications daily
  setInterval(checkUpcomingObligations, 24 * 60 * 60 * 1000);

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
