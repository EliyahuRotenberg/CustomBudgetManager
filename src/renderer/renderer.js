const { ipcRenderer } = require('electron');

// State
let currentData = {
  incomeSources: [],
  incomeReceived: [],
  obligations: [],
  obligationsPaid: [],
  expenses: [],
  expenseCategories: [],
  goals: [],
  snapshot: {}
};

// Selected month/year (can be navigated)
const todayDate = new Date();
let selectedMonth = todayDate.getMonth() + 1;
let selectedYear = todayDate.getFullYear();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadDashboard();
  setCurrentMonth();
  setupKeyboardShortcuts();
});

// Display current month
function setCurrentMonth() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('currentMonth').textContent =
    `${monthNames[selectedMonth - 1]} ${selectedYear}`;

  // Show/hide "Today" button based on whether we're viewing current month
  const isCurrentMonth = selectedMonth === (todayDate.getMonth() + 1) && selectedYear === todayDate.getFullYear();
  document.getElementById('todayBtn').style.display = isCurrentMonth ? 'none' : 'inline-flex';
}

// Month navigation functions
function goToPreviousMonth() {
  selectedMonth--;
  if (selectedMonth < 1) {
    selectedMonth = 12;
    selectedYear--;
  }
  setCurrentMonth();
  loadDashboard();
}

function goToNextMonth() {
  selectedMonth++;
  if (selectedMonth > 12) {
    selectedMonth = 1;
    selectedYear++;
  }
  setCurrentMonth();
  loadDashboard();
}

function goToCurrentMonth() {
  selectedMonth = todayDate.getMonth() + 1;
  selectedYear = todayDate.getFullYear();
  setCurrentMonth();
  loadDashboard();
}

// Load dashboard data
async function loadDashboard() {
  try {
    const data = await ipcRenderer.invoke('get-dashboard-data', selectedMonth, selectedYear);
    currentData = data;
    renderDashboard();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// Render all dashboard components
function renderDashboard() {
  renderSafeToSpend();
  renderSummaryCards();
  renderIncomeChecklist();
  renderObligationsChecklist();
  renderExpensesByCategory();
  renderGoals();
  renderAlerts();
  renderSuggestions();
  renderTrajectory();
}

// Render summary cards
function renderSummaryCards() {
  const snapshot = currentData.snapshot;

  // Income summary
  const totalReceivedIncome = currentData.incomeReceived.reduce((sum, i) => sum + i.amount, 0);
  const receivedCount = new Set(currentData.incomeReceived.map(i => i.income_source_id)).size;
  const totalSources = currentData.incomeSources.length;
  document.getElementById('summaryIncome').textContent = formatCurrency(totalReceivedIncome);
  document.getElementById('summaryIncomeDetail').textContent = `${receivedCount} / ${totalSources} sources received`;

  // Obligations summary
  const totalPaidObligations = currentData.obligationsPaid.reduce((sum, o) => sum + o.amount, 0);
  const paidCount = new Set(currentData.obligationsPaid.map(o => o.obligation_id)).size;
  const totalObligations = currentData.obligations.length;
  document.getElementById('summaryObligations').textContent = formatCurrency(totalPaidObligations);
  document.getElementById('summaryObligationsDetail').textContent = `${paidCount} / ${totalObligations} paid`;

  // Expenses summary
  const totalExpenses = currentData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseCount = currentData.expenses.length;
  document.getElementById('summaryExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('summaryExpensesDetail').textContent = `${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`;

  // Net calculation
  const net = totalReceivedIncome - totalPaidObligations - totalExpenses;
  const netEl = document.getElementById('summaryNet');
  netEl.textContent = formatCurrency(net);
  netEl.className = 'summary-value ' + (net >= 0 ? 'positive' : 'negative');
  document.getElementById('summaryNetDetail').textContent = net >= 0 ? 'Surplus' : 'Deficit';
}

// Render Safe to Spend
function renderSafeToSpend() {
  const amount = currentData.snapshot.safeToSpend || 0;
  const amountEl = document.getElementById('safeToSpendAmount');
  const statusEl = document.getElementById('safeToSpendStatus');

  amountEl.textContent = formatCurrency(amount);

  // Color coding
  amountEl.className = 'safe-to-spend-amount';
  statusEl.className = 'safe-to-spend-status';

  if (amount >= 500) {
    amountEl.classList.add('positive');
    statusEl.classList.add('positive');
    statusEl.textContent = 'Healthy Buffer';
  } else if (amount >= 100) {
    amountEl.classList.add('warning');
    statusEl.classList.add('warning');
    statusEl.textContent = 'Tight but Okay';
  } else {
    amountEl.classList.add('danger');
    statusEl.classList.add('danger');
    statusEl.textContent = 'Danger Zone';
  }
}

// Render income checklist
function renderIncomeChecklist() {
  const list = document.getElementById('incomeChecklist');
  const subtitle = document.getElementById('incomeSubtitle');

  const totalExpected = currentData.incomeSources.reduce((sum, s) => sum + s.expected_amount_min, 0);
  const totalReceived = currentData.incomeReceived.reduce((sum, i) => sum + i.amount, 0);

  subtitle.textContent = `${formatCurrency(totalReceived)} / ${formatCurrency(totalExpected)}`;

  if (currentData.incomeSources.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No income sources. Add one in Settings.</div></div>';
    return;
  }

  const receivedMap = new Map();
  currentData.incomeReceived.forEach(income => {
    receivedMap.set(income.income_source_id, income);
  });

  list.innerHTML = currentData.incomeSources.map(source => {
    const received = receivedMap.get(source.id);
    const isCompleted = !!received;

    return `
      <li class="checklist-item ${isCompleted ? 'completed' : ''}">
        <div class="item-info">
          <div class="item-name">${source.name}</div>
          <div class="item-details">
            Expected: ${formatCurrency(source.expected_amount_min)} on day ${source.expected_day}
            ${received ? ` • Received: ${formatCurrency(received.amount)} on ${formatDate(received.received_date)}` : ''}
          </div>
        </div>
        <div class="item-actions">
          ${!isCompleted ? `<button class="btn btn-small btn-success" onclick="recordIncomeQuick(${source.id}, '${source.name}', ${source.expected_amount_min})">✓ Received</button>` : ''}
        </div>
      </li>
    `;
  }).join('');
}

// Render obligations checklist
function renderObligationsChecklist() {
  const list = document.getElementById('obligationsChecklist');
  const subtitle = document.getElementById('obligationsSubtitle');

  const totalDue = currentData.obligations.reduce((sum, o) => sum + o.amount, 0);
  const totalPaid = currentData.obligationsPaid.reduce((sum, o) => sum + o.amount, 0);

  subtitle.textContent = `${formatCurrency(totalPaid)} / ${formatCurrency(totalDue)}`;

  if (currentData.obligations.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No obligations. Add one in Settings.</div></div>';
    return;
  }

  const paidMap = new Map();
  currentData.obligationsPaid.forEach(paid => {
    paidMap.set(paid.obligation_id, paid);
  });

  list.innerHTML = currentData.obligations.map(obligation => {
    const paid = paidMap.get(obligation.id);
    const isCompleted = !!paid;
    const daysUntilDue = obligation.due_date - todayDate.getDate();

    return `
      <li class="checklist-item ${isCompleted ? 'completed' : ''}">
        <div class="item-info">
          <div class="item-name">${obligation.name}</div>
          <div class="item-details">
            ${formatCurrency(obligation.amount)} due on day ${obligation.due_date}
            ${!isCompleted && daysUntilDue >= 0 && daysUntilDue <= 7 ? ` • <span class="text-warning">Due in ${daysUntilDue} days</span>` : ''}
            ${paid ? ` • Paid: ${formatCurrency(paid.amount)} on ${formatDate(paid.paid_date)}` : ''}
          </div>
        </div>
        <div class="item-actions">
          ${!isCompleted ? `<button class="btn btn-small btn-success" onclick="recordObligationQuick(${obligation.id}, '${obligation.name}', ${obligation.amount})">✓ Mark Paid</button>` : ''}
        </div>
      </li>
    `;
  }).join('');
}

// Render expenses by category
function renderExpensesByCategory() {
  const list = document.getElementById('expensesCategoryList');
  const subtitle = document.getElementById('expensesSubtitle');

  const totalSpent = currentData.expenses.reduce((sum, e) => sum + e.amount, 0);
  subtitle.textContent = `Total: ${formatCurrency(totalSpent)}`;

  if (currentData.expenses.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No expenses this month.</div></div>';
    return;
  }

  // Group by category
  const categoryTotals = new Map();
  currentData.expenses.forEach(expense => {
    const current = categoryTotals.get(expense.category_name) || 0;
    categoryTotals.set(expense.category_name, current + expense.amount);
  });

  const maxAmount = Math.max(...categoryTotals.values());

  const categories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => {
      const percentage = (total / maxAmount) * 100;
      return `
        <li class="category-item">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span class="category-name">${name}</span>
              <span class="category-amount">${formatCurrency(total)}</span>
            </div>
            <div class="category-bar">
              <div class="category-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        </li>
      `;
    }).join('');

  list.innerHTML = categories;
}

// Render goals
function renderGoals() {
  const container = document.getElementById('goalsContainer');

  if (currentData.goals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No goals set.</div></div>';
    return;
  }

  const goalData = {
    emergency_fund: { name: 'Emergency Fund', icon: '🛡️' },
    university_debt: { name: 'University Debt', icon: '🎓' },
    monthly_savings: { name: 'Monthly Savings', icon: '💰' }
  };

  container.innerHTML = currentData.goals.map(goal => {
    const info = goalData[goal.type] || { name: goal.type, icon: '📊' };
    const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
    const progressClass = progress >= 100 ? 'positive' : progress >= 50 ? '' : 'warning';

    let meta = '';
    if (goal.type === 'emergency_fund') {
      const monthsCovered = currentData.snapshot.totalObligations > 0
        ? goal.current_amount / currentData.snapshot.totalObligations
        : 0;
      meta = `${monthsCovered.toFixed(1)} months covered`;
    } else if (goal.type === 'university_debt') {
      meta = `Balance: ${formatCurrency(goal.target_amount)}`;
    } else if (goal.type === 'monthly_savings') {
      meta = `Target: ${formatCurrency(goal.monthly_target)}/month`;
    }

    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${info.icon} ${info.name}</div>
          <div class="goal-value">${formatCurrency(goal.current_amount)}</div>
        </div>
        ${meta ? `<div class="goal-meta">${meta}</div>` : ''}
        ${goal.target_amount > 0 ? `
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${Math.min(progress, 100)}%"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} (${progress.toFixed(0)}%)
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Render upcoming alerts
function renderAlerts() {
  const panel = document.getElementById('alertsPanel');
  const list = document.getElementById('alertsList');

  const today = todayDate.getDate();
  const upcomingItems = [];

  // Check income
  currentData.incomeSources.forEach(source => {
    const received = currentData.incomeReceived.find(i => i.income_source_id === source.id);
    if (!received) {
      const daysUntil = source.expected_day - today;
      if (daysUntil >= 0 && daysUntil <= 7) {
        upcomingItems.push({
          type: 'income',
          title: `${source.name} expected`,
          description: `${formatCurrency(source.expected_amount_min)} expected on day ${source.expected_day}`,
          days: daysUntil,
          urgent: daysUntil <= 2
        });
      }
    }
  });

  // Check obligations
  currentData.obligations.forEach(obligation => {
    const paid = currentData.obligationsPaid.find(p => p.obligation_id === obligation.id);
    if (!paid) {
      const daysUntil = obligation.due_date - today;
      if (daysUntil >= 0 && daysUntil <= 7) {
        upcomingItems.push({
          type: 'obligation',
          title: `${obligation.name} due`,
          description: `${formatCurrency(obligation.amount)} due on day ${obligation.due_date}`,
          days: daysUntil,
          urgent: daysUntil <= 2
        });
      }
    }
  });

  if (upcomingItems.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  upcomingItems.sort((a, b) => a.days - b.days);

  list.innerHTML = upcomingItems.map(item => {
    const icon = item.type === 'income' ? '💰' : '📅';
    const daysText = item.days === 0 ? 'Today' : item.days === 1 ? 'Tomorrow' : `In ${item.days} days`;

    return `
      <div class="alert-item ${item.urgent ? 'urgent' : ''}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-title">${item.title}</div>
          <div class="alert-description">${item.description} • ${daysText}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Render monthly suggestions
function renderSuggestions() {
  const panel = document.getElementById('suggestionsPanel');
  const list = document.getElementById('suggestionsList');

  // Only show suggestions if all expected income is received
  const allIncomeReceived = currentData.incomeSources.every(source =>
    currentData.incomeReceived.some(i => i.income_source_id === source.id)
  );

  if (!allIncomeReceived || currentData.snapshot.safeToSpend <= 0) {
    panel.style.display = 'none';
    return;
  }

  const suggestions = [];
  const surplus = currentData.snapshot.safeToSpend;

  // Emergency fund suggestion
  const emergencyGoal = currentData.goals.find(g => g.type === 'emergency_fund');
  if (emergencyGoal && emergencyGoal.current_amount < emergencyGoal.target_amount) {
    const needed = emergencyGoal.target_amount - emergencyGoal.current_amount;
    const suggested = Math.min(surplus * 0.5, needed);
    suggestions.push(`💡 Consider putting ₪${suggested.toFixed(2)} toward your emergency fund`);
  }

  // Debt suggestion
  const debtGoal = currentData.goals.find(g => g.type === 'university_debt');
  if (debtGoal && debtGoal.target_amount > 0) {
    const extraPayment = Math.min(surplus * 0.3, 500);
    if (extraPayment > 50) {
      suggestions.push(`💡 You could pay an extra ₪${extraPayment.toFixed(2)} toward university debt`);
    }
  }

  if (suggestions.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  list.innerHTML = suggestions.map(s => `<div style="padding: 10px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">${s}</div>`).join('');
}

// Render monthly trajectory
async function renderTrajectory() {
  const view = document.getElementById('trajectoryView');
  const panel = document.getElementById('trajectoryPanel');

  try {
    const trajectory = await ipcRenderer.invoke('get-monthly-trajectory', selectedMonth, selectedYear);

    if (trajectory.length === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';

    view.innerHTML = trajectory.map(tx => {
      const date = new Date(tx.date);
      const formattedDate = `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })}`;
      const amountClass = tx.amount >= 0 ? 'positive' : 'negative';
      const balanceColor = tx.balance >= 0 ? 'var(--green)' : 'var(--red)';
      const statusClass = tx.status === 'expected' ? 'expected' : '';
      const statusLabel = tx.status === 'expected' ? 'expected' : tx.type;

      return `
        <div class="trajectory-item ${tx.type} ${statusClass}">
          <div class="trajectory-date">${formattedDate}</div>
          <div class="trajectory-info">
            <div class="trajectory-description">${tx.description}</div>
            <div class="trajectory-type">${statusLabel}</div>
          </div>
          <div class="trajectory-amount ${amountClass}">
            ${tx.amount >= 0 ? '+' : ''}${formatCurrency(tx.amount)}
          </div>
          <div class="trajectory-balance" style="color: ${balanceColor};">
            ${formatCurrency(tx.balance)}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading trajectory:', error);
    panel.style.display = 'none';
  }
}

// Quick record functions (called from inline buttons)
window.recordIncomeQuick = async (sourceId, sourceName, expectedAmount) => {
  const amount = prompt(`Record income from ${sourceName}:`, expectedAmount);
  if (!amount) return;

  try {
    await ipcRenderer.invoke('record-income-received', {
      income_source_id: sourceId,
      amount: parseFloat(amount),
      received_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    await loadDashboard();
  } catch (error) {
    alert('Error recording income: ' + error.message);
  }
};

window.recordObligationQuick = async (obligationId, obligationName, expectedAmount) => {
  const amount = prompt(`Mark ${obligationName} as paid:`, expectedAmount);
  if (!amount) return;

  try {
    await ipcRenderer.invoke('record-obligation-paid', {
      obligation_id: obligationId,
      amount: parseFloat(amount),
      paid_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    await loadDashboard();
  } catch (error) {
    alert('Error recording payment: ' + error.message);
  }
};

// Quick Entry Modal
function setupEventListeners() {
  // Quick entry
  document.getElementById('quickEntryBtn').addEventListener('click', openQuickEntry);
  document.getElementById('closeQuickEntry').addEventListener('click', closeQuickEntry);

  // Month navigation
  document.getElementById('prevMonthBtn').addEventListener('click', goToPreviousMonth);
  document.getElementById('nextMonthBtn').addEventListener('click', goToNextMonth);
  document.getElementById('todayBtn').addEventListener('click', goToCurrentMonth);

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);

  // Tab switching in modals
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab, e.target.closest('.modal'));
    });
  });

  // Forms
  document.getElementById('incomeForm').addEventListener('submit', handleIncomeSubmit);
  document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
  document.getElementById('obligationForm').addEventListener('submit', handleObligationSubmit);

  // Settings forms
  document.getElementById('incomeSourceForm').addEventListener('submit', handleIncomeSourceSubmit);
  document.getElementById('obligationMgmtForm').addEventListener('submit', handleObligationMgmtSubmit);
  document.getElementById('goalForm').addEventListener('submit', handleGoalSubmit);

  // Settings buttons
  document.getElementById('addIncomeSourceBtn').addEventListener('click', () => openIncomeSourceModal());
  document.getElementById('addObligationBtn').addEventListener('click', () => openObligationModal());
  document.getElementById('closeIncomeSourceModal').addEventListener('click', closeIncomeSourceModal);
  document.getElementById('closeObligationModal').addEventListener('click', closeObligationModal);
  document.getElementById('closeGoalModal').addEventListener('click', closeGoalModal);

  // Export button
  document.getElementById('exportBtn').addEventListener('click', handleExport);

  // Category management
  document.getElementById('addCategoryBtn').addEventListener('click', handleAddCategory);

  // Dashboard section manage buttons
  document.getElementById('manageIncomeBtn').addEventListener('click', () => openSettingsToTab('income-sources'));
  document.getElementById('manageObligationsBtn').addEventListener('click', () => openSettingsToTab('obligations-mgmt'));
  document.getElementById('manageGoalsBtn').addEventListener('click', () => openSettingsToTab('goals-mgmt'));
  document.getElementById('viewExpensesBtn').addEventListener('click', openExpensesView);
  document.getElementById('viewIncomeRecordsBtn').addEventListener('click', openIncomeReceivedView);
  document.getElementById('viewObligationPaymentsBtn').addEventListener('click', openObligationsPaidView);

  // Expenses view modal
  document.getElementById('closeExpensesView').addEventListener('click', closeExpensesView);
  document.getElementById('closeEditExpenseModal').addEventListener('click', closeEditExpenseModal);
  document.getElementById('editExpenseForm').addEventListener('submit', handleEditExpenseSubmit);

  // Income received view modal
  document.getElementById('closeIncomeReceivedView').addEventListener('click', closeIncomeReceivedView);
  document.getElementById('closeEditIncomeReceivedModal').addEventListener('click', closeEditIncomeReceivedModal);
  document.getElementById('editIncomeReceivedForm').addEventListener('submit', handleEditIncomeReceivedSubmit);

  // Obligations paid view modal
  document.getElementById('closeObligationsPaidView').addEventListener('click', closeObligationsPaidView);
  document.getElementById('closeEditObligationPaidModal').addEventListener('click', closeEditObligationPaidModal);
  document.getElementById('editObligationPaidForm').addEventListener('submit', handleEditObligationPaidSubmit);

  // Category edit modal
  document.getElementById('closeEditCategoryModal').addEventListener('click', closeEditCategoryModal);
  document.getElementById('editCategoryForm').addEventListener('submit', handleEditCategorySubmit);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function switchTab(tabName, modal) {
  const tabs = modal.querySelectorAll('.tab');
  const contents = modal.querySelectorAll('.tab-content');

  tabs.forEach(t => t.classList.remove('active'));
  contents.forEach(c => c.classList.add('hidden'));

  const activeTab = modal.querySelector(`[data-tab="${tabName}"]`);
  activeTab.classList.add('active');

  // Show corresponding content
  if (tabName === 'income') {
    document.getElementById('incomeForm').classList.remove('hidden');
  } else if (tabName === 'expense') {
    document.getElementById('expenseForm').classList.remove('hidden');
  } else if (tabName === 'obligation') {
    document.getElementById('obligationForm').classList.remove('hidden');
  } else if (tabName === 'income-sources') {
    document.getElementById('incomeSourcesTab').classList.remove('hidden');
  } else if (tabName === 'obligations-mgmt') {
    document.getElementById('obligationsMgmtTab').classList.remove('hidden');
  } else if (tabName === 'categories-mgmt') {
    document.getElementById('categoriesMgmtTab').classList.remove('hidden');
  } else if (tabName === 'goals-mgmt') {
    document.getElementById('goalsMgmtTab').classList.remove('hidden');
  }
}

async function openQuickEntry() {
  // Populate dropdowns
  const incomeSelect = document.getElementById('incomeSourceSelect');
  incomeSelect.innerHTML = '<option value="">Select source...</option>' +
    currentData.incomeSources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const expenseSelect = document.getElementById('expenseCategorySelect');
  expenseSelect.innerHTML = '<option value="">Select category...</option>' +
    currentData.expenseCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const obligationSelect = document.getElementById('obligationSelect');
  obligationSelect.innerHTML = '<option value="">Select obligation...</option>' +
    currentData.obligations.map(o => `<option value="${o.id}">${o.name} (₪${o.amount})</option>`).join('');

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('incomeDate').value = today;
  document.getElementById('expenseDate').value = today;
  document.getElementById('obligationDate').value = today;

  document.getElementById('quickEntryModal').classList.add('active');
}

function closeQuickEntry() {
  document.getElementById('quickEntryModal').classList.remove('active');
  document.getElementById('incomeForm').reset();
  document.getElementById('expenseForm').reset();
  document.getElementById('obligationForm').reset();
}

async function handleIncomeSubmit(e) {
  e.preventDefault();

  try {
    await ipcRenderer.invoke('record-income-received', {
      income_source_id: parseInt(document.getElementById('incomeSourceSelect').value),
      amount: parseFloat(document.getElementById('incomeAmount').value),
      received_date: document.getElementById('incomeDate').value,
      notes: document.getElementById('incomeNotes').value
    });

    closeQuickEntry();
    await loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  try {
    await ipcRenderer.invoke('add-expense', {
      category_id: parseInt(document.getElementById('expenseCategorySelect').value),
      amount: parseFloat(document.getElementById('expenseAmount').value),
      expense_date: document.getElementById('expenseDate').value,
      notes: document.getElementById('expenseNotes').value
    });

    closeQuickEntry();
    await loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function handleObligationSubmit(e) {
  e.preventDefault();

  try {
    await ipcRenderer.invoke('record-obligation-paid', {
      obligation_id: parseInt(document.getElementById('obligationSelect').value),
      amount: parseFloat(document.getElementById('obligationAmount').value),
      paid_date: document.getElementById('obligationDate').value,
      notes: document.getElementById('obligationNotes').value
    });

    closeQuickEntry();
    await loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Settings Modal
async function openSettings() {
  await loadSettingsData();
  document.getElementById('settingsModal').classList.add('active');
}

async function openSettingsToTab(tabName) {
  await openSettings();
  switchTab(tabName, document.getElementById('settingsModal'));
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

// Expenses View Modal
function openExpensesView() {
  renderExpensesDetailView();
  document.getElementById('expensesViewModal').classList.add('active');
}

function closeExpensesView() {
  document.getElementById('expensesViewModal').classList.remove('active');
}

function renderExpensesDetailView() {
  const list = document.getElementById('expensesDetailList');

  if (currentData.expenses.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No expenses this month.</div></div>';
    return;
  }

  // Sort expenses by date (most recent first)
  const sortedExpenses = [...currentData.expenses].sort((a, b) =>
    new Date(b.expense_date) - new Date(a.expense_date)
  );

  list.innerHTML = sortedExpenses.map(expense => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${expense.category_name}</div>
        <div class="item-details">
          ${formatCurrency(expense.amount)} on ${formatDate(expense.expense_date)}
          ${expense.notes ? ` • ${expense.notes}` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editExpense(${expense.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteExpense(${expense.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function loadSettingsData() {
  renderIncomeSourcesList();
  renderObligationsList();
  renderCategoriesList();
  renderGoalsManagement();
}

function renderIncomeSourcesList() {
  const list = document.getElementById('incomeSourcesList');

  if (currentData.incomeSources.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No income sources yet.</div></div>';
    return;
  }

  list.innerHTML = currentData.incomeSources.map(source => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${source.name}</div>
        <div class="item-details">
          ${formatCurrency(source.expected_amount_min)}${source.expected_amount_max !== source.expected_amount_min ? ` - ${formatCurrency(source.expected_amount_max)}` : ''}
          on day ${source.expected_day}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editIncomeSource(${source.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteIncomeSource(${source.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderObligationsList() {
  const list = document.getElementById('obligationsList');

  if (currentData.obligations.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No obligations yet.</div></div>';
    return;
  }

  list.innerHTML = currentData.obligations.map(obl => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${obl.name}</div>
        <div class="item-details">
          ${formatCurrency(obl.amount)} due on day ${obl.due_date} • ${obl.category}
          ${obl.total_balance > 0 ? ` • Balance: ${formatCurrency(obl.total_balance)}` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editObligation(${obl.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteObligation(${obl.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderCategoriesList() {
  const list = document.getElementById('categoriesList');

  if (currentData.expenseCategories.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No categories yet.</div></div>';
    return;
  }

  list.innerHTML = currentData.expenseCategories.map(category => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${category.name}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editCategory(${category.id}, '${category.name.replace(/'/g, "\\'")}')">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteCategory(${category.id}, '${category.name.replace(/'/g, "\\'")}')">Delete</button>
      </div>
    </div>
  `).join('');
}

async function handleAddCategory() {
  const nameInput = document.getElementById('newCategoryName');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter a category name');
    return;
  }

  try {
    await ipcRenderer.invoke('add-expense-category', name);
    nameInput.value = '';
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error adding category: ' + error.message);
  }
}

window.deleteCategory = async (id, name) => {
  if (!confirm(`Are you sure you want to delete the category "${name}"?`)) return;

  try {
    await ipcRenderer.invoke('delete-expense-category', id);
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error deleting category: ' + error.message);
  }
};

window.editCategory = (id, name) => {
  document.getElementById('editCategoryId').value = id;
  document.getElementById('editCategoryName').value = name;
  document.getElementById('editCategoryModal').classList.add('active');
};

function closeEditCategoryModal() {
  document.getElementById('editCategoryModal').classList.remove('active');
}

async function handleEditCategorySubmit(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('editCategoryId').value);
  const name = document.getElementById('editCategoryName').value.trim();

  if (!name) {
    alert('Please enter a category name');
    return;
  }

  try {
    await ipcRenderer.invoke('update-expense-category', id, name);
    closeEditCategoryModal();
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error updating category: ' + error.message);
  }
}

function renderGoalsManagement() {
  const list = document.getElementById('goalsManagementList');

  const goalData = {
    emergency_fund: { name: 'Emergency Fund', icon: '🛡️' },
    university_debt: { name: 'University Debt', icon: '🎓' },
    monthly_savings: { name: 'Monthly Savings', icon: '💰' }
  };

  list.innerHTML = currentData.goals.map(goal => {
    const info = goalData[goal.type] || { name: goal.type, icon: '📊' };

    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${info.icon} ${info.name}</div>
          <button class="btn btn-small btn-secondary" onclick="editGoal('${goal.type}')">Edit</button>
        </div>
        <div class="goal-meta">
          Current: ${formatCurrency(goal.current_amount)} • Target: ${formatCurrency(goal.target_amount)}
          ${goal.monthly_target > 0 ? ` • Monthly: ${formatCurrency(goal.monthly_target)}` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Income Source Management
function openIncomeSourceModal(id = null) {
  const modal = document.getElementById('incomeSourceModal');
  const title = document.getElementById('incomeSourceModalTitle');

  if (id) {
    const source = currentData.incomeSources.find(s => s.id === id);
    title.textContent = 'Edit Income Source';
    document.getElementById('incomeSourceId').value = id;
    document.getElementById('incomeSourceName').value = source.name;
    document.getElementById('incomeSourceMin').value = source.expected_amount_min;
    document.getElementById('incomeSourceMax').value = source.expected_amount_max;
    document.getElementById('incomeSourceDay').value = source.expected_day;
  } else {
    title.textContent = 'Add Income Source';
    document.getElementById('incomeSourceForm').reset();
    document.getElementById('incomeSourceId').value = '';
  }

  modal.classList.add('active');
}

function closeIncomeSourceModal() {
  document.getElementById('incomeSourceModal').classList.remove('active');
}

async function handleIncomeSourceSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('incomeSourceId').value;
  const data = {
    name: document.getElementById('incomeSourceName').value,
    expected_amount_min: parseFloat(document.getElementById('incomeSourceMin').value),
    expected_amount_max: parseFloat(document.getElementById('incomeSourceMax').value) || parseFloat(document.getElementById('incomeSourceMin').value),
    expected_day: parseInt(document.getElementById('incomeSourceDay').value)
  };

  try {
    if (id) {
      await ipcRenderer.invoke('update-income-source', parseInt(id), data);
    } else {
      await ipcRenderer.invoke('add-income-source', data);
    }

    closeIncomeSourceModal();
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

window.editIncomeSource = (id) => {
  openIncomeSourceModal(id);
};

window.deleteIncomeSource = async (id) => {
  if (!confirm('Are you sure you want to delete this income source?')) return;

  try {
    await ipcRenderer.invoke('delete-income-source', id);
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

// Obligation Management
function openObligationModal(id = null) {
  const modal = document.getElementById('obligationModal');
  const title = document.getElementById('obligationModalTitle');

  if (id) {
    const obl = currentData.obligations.find(o => o.id === id);
    title.textContent = 'Edit Obligation';
    document.getElementById('obligationId').value = id;
    document.getElementById('obligationName').value = obl.name;
    document.getElementById('obligationAmountMgmt').value = obl.amount;
    document.getElementById('obligationDueDate').value = obl.due_date;
    document.getElementById('obligationCategory').value = obl.category;
    document.getElementById('obligationBalance').value = obl.total_balance;
  } else {
    title.textContent = 'Add Obligation';
    document.getElementById('obligationMgmtForm').reset();
    document.getElementById('obligationId').value = '';
  }

  modal.classList.add('active');
}

function closeObligationModal() {
  document.getElementById('obligationModal').classList.remove('active');
}

async function handleObligationMgmtSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('obligationId').value;
  const data = {
    name: document.getElementById('obligationName').value,
    amount: parseFloat(document.getElementById('obligationAmountMgmt').value),
    due_date: parseInt(document.getElementById('obligationDueDate').value),
    category: document.getElementById('obligationCategory').value,
    total_balance: parseFloat(document.getElementById('obligationBalance').value) || 0
  };

  try {
    if (id) {
      await ipcRenderer.invoke('update-obligation', parseInt(id), data);
    } else {
      await ipcRenderer.invoke('add-obligation', data);
    }

    closeObligationModal();
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

window.editObligation = (id) => {
  openObligationModal(id);
};

window.deleteObligation = async (id) => {
  if (!confirm('Are you sure you want to delete this obligation?')) return;

  try {
    await ipcRenderer.invoke('delete-obligation', id);
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

// Goal Management
function openGoalModal(type) {
  const goal = currentData.goals.find(g => g.type === type);
  const modal = document.getElementById('goalModal');
  const title = document.getElementById('goalModalTitle');

  const names = {
    emergency_fund: 'Emergency Fund',
    university_debt: 'University Debt',
    monthly_savings: 'Monthly Savings'
  };

  title.textContent = `Edit ${names[type] || type}`;
  document.getElementById('goalType').value = type;
  document.getElementById('goalTargetAmount').value = goal.target_amount;
  document.getElementById('goalCurrentAmount').value = goal.current_amount;
  document.getElementById('goalMonthlyTarget').value = goal.monthly_target;

  modal.classList.add('active');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
}

async function handleGoalSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('goalType').value;
  const data = {
    target_amount: parseFloat(document.getElementById('goalTargetAmount').value),
    current_amount: parseFloat(document.getElementById('goalCurrentAmount').value),
    monthly_target: parseFloat(document.getElementById('goalMonthlyTarget').value) || 0
  };

  try {
    await ipcRenderer.invoke('update-goal', type, data);
    closeGoalModal();
    await loadDashboard();
    await loadSettingsData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

window.editGoal = (type) => {
  openGoalModal(type);
};

// Export functionality
async function handleExport() {
  const options = ['Income', 'Obligations', 'Expenses', 'Cancel'];
  const choice = prompt('Export data:\n1. Income\n2. Obligations\n3. Expenses\n\nEnter number (1-3):');

  if (!choice || choice === '4') return;

  let type;
  switch (choice) {
    case '1':
      type = 'income';
      break;
    case '2':
      type = 'obligations';
      break;
    case '3':
      type = 'expenses';
      break;
    default:
      alert('Invalid choice');
      return;
  }

  try {
    const csv = await ipcRenderer.invoke('export-csv', type, selectedMonth, selectedYear);

    // Create a blob and download it
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_${type}_${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`${type} data exported successfully!`);
  } catch (error) {
    alert('Error exporting data: ' + error.message);
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N or Cmd+N for quick entry
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openQuickEntry();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });
}

// ===== Expense Management =====
function closeEditExpenseModal() {
  document.getElementById('editExpenseModal').classList.remove('active');
}

window.editExpense = (id) => {
  const expense = currentData.expenses.find(e => e.id === id);
  if (!expense) return;

  // Populate category dropdown
  const categorySelect = document.getElementById('editExpenseCategorySelect');
  categorySelect.innerHTML = currentData.expenseCategories.map(c =>
    `<option value="${c.id}" ${c.id === expense.category_id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  document.getElementById('editExpenseId').value = id;
  document.getElementById('editExpenseAmount').value = expense.amount;
  document.getElementById('editExpenseDate').value = expense.expense_date;
  document.getElementById('editExpenseNotes').value = expense.notes || '';

  document.getElementById('editExpenseModal').classList.add('active');
};

async function handleEditExpenseSubmit(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('editExpenseId').value);
  const data = {
    category_id: parseInt(document.getElementById('editExpenseCategorySelect').value),
    amount: parseFloat(document.getElementById('editExpenseAmount').value),
    expense_date: document.getElementById('editExpenseDate').value,
    notes: document.getElementById('editExpenseNotes').value
  };

  try {
    await ipcRenderer.invoke('update-expense', id, data);
    closeEditExpenseModal();
    await loadDashboard();
    renderExpensesDetailView();
  } catch (error) {
    alert('Error updating expense: ' + error.message);
  }
}

window.deleteExpense = async (id) => {
  if (!confirm('Are you sure you want to delete this expense?')) return;

  try {
    await ipcRenderer.invoke('delete-expense', id);
    await loadDashboard();
    renderExpensesDetailView();
  } catch (error) {
    alert('Error deleting expense: ' + error.message);
  }
};

// ===== Income Received Management =====
function openIncomeReceivedView() {
  renderIncomeReceivedDetailView();
  document.getElementById('incomeReceivedViewModal').classList.add('active');
}

function closeIncomeReceivedView() {
  document.getElementById('incomeReceivedViewModal').classList.remove('active');
}

function closeEditIncomeReceivedModal() {
  document.getElementById('editIncomeReceivedModal').classList.remove('active');
}

function renderIncomeReceivedDetailView() {
  const list = document.getElementById('incomeReceivedDetailList');

  if (currentData.incomeReceived.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No income received this month.</div></div>';
    return;
  }

  const sortedIncome = [...currentData.incomeReceived].sort((a, b) =>
    new Date(b.received_date) - new Date(a.received_date)
  );

  list.innerHTML = sortedIncome.map(income => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${income.source_name}</div>
        <div class="item-details">
          ${formatCurrency(income.amount)} on ${formatDate(income.received_date)}
          ${income.notes ? ` • ${income.notes}` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editIncomeReceived(${income.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteIncomeReceived(${income.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

window.editIncomeReceived = (id) => {
  const income = currentData.incomeReceived.find(i => i.id === id);
  if (!income) return;

  // Populate source dropdown
  const sourceSelect = document.getElementById('editIncomeReceivedSourceSelect');
  sourceSelect.innerHTML = currentData.incomeSources.map(s =>
    `<option value="${s.id}" ${s.id === income.income_source_id ? 'selected' : ''}>${s.name}</option>`
  ).join('');

  document.getElementById('editIncomeReceivedId').value = id;
  document.getElementById('editIncomeReceivedAmount').value = income.amount;
  document.getElementById('editIncomeReceivedDate').value = income.received_date;
  document.getElementById('editIncomeReceivedNotes').value = income.notes || '';

  document.getElementById('editIncomeReceivedModal').classList.add('active');
};

async function handleEditIncomeReceivedSubmit(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('editIncomeReceivedId').value);
  const data = {
    income_source_id: parseInt(document.getElementById('editIncomeReceivedSourceSelect').value),
    amount: parseFloat(document.getElementById('editIncomeReceivedAmount').value),
    received_date: document.getElementById('editIncomeReceivedDate').value,
    notes: document.getElementById('editIncomeReceivedNotes').value
  };

  try {
    await ipcRenderer.invoke('update-income-received', id, data);
    closeEditIncomeReceivedModal();
    await loadDashboard();
    renderIncomeReceivedDetailView();
  } catch (error) {
    alert('Error updating income record: ' + error.message);
  }
}

window.deleteIncomeReceived = async (id) => {
  if (!confirm('Are you sure you want to delete this income record?')) return;

  try {
    await ipcRenderer.invoke('delete-income-received', id);
    await loadDashboard();
    renderIncomeReceivedDetailView();
  } catch (error) {
    alert('Error deleting income record: ' + error.message);
  }
};

// ===== Obligations Paid Management =====
function openObligationsPaidView() {
  renderObligationsPaidDetailView();
  document.getElementById('obligationsPaidViewModal').classList.add('active');
}

function closeObligationsPaidView() {
  document.getElementById('obligationsPaidViewModal').classList.remove('active');
}

function closeEditObligationPaidModal() {
  document.getElementById('editObligationPaidModal').classList.remove('active');
}

function renderObligationsPaidDetailView() {
  const list = document.getElementById('obligationsPaidDetailList');

  if (currentData.obligationsPaid.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No obligations paid this month.</div></div>';
    return;
  }

  const sortedPayments = [...currentData.obligationsPaid].sort((a, b) =>
    new Date(b.paid_date) - new Date(a.paid_date)
  );

  list.innerHTML = sortedPayments.map(payment => `
    <div class="checklist-item">
      <div class="item-info">
        <div class="item-name">${payment.obligation_name}</div>
        <div class="item-details">
          ${formatCurrency(payment.amount)} on ${formatDate(payment.paid_date)}
          ${payment.notes ? ` • ${payment.notes}` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-small btn-secondary" onclick="editObligationPaid(${payment.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteObligationPaid(${payment.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

window.editObligationPaid = (id) => {
  const payment = currentData.obligationsPaid.find(p => p.id === id);
  if (!payment) return;

  // Populate obligation dropdown
  const oblSelect = document.getElementById('editObligationPaidSelect');
  oblSelect.innerHTML = currentData.obligations.map(o =>
    `<option value="${o.id}" ${o.id === payment.obligation_id ? 'selected' : ''}>${o.name}</option>`
  ).join('');

  document.getElementById('editObligationPaidId').value = id;
  document.getElementById('editObligationPaidAmount').value = payment.amount;
  document.getElementById('editObligationPaidDate').value = payment.paid_date;
  document.getElementById('editObligationPaidNotes').value = payment.notes || '';

  document.getElementById('editObligationPaidModal').classList.add('active');
};

async function handleEditObligationPaidSubmit(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('editObligationPaidId').value);
  const data = {
    obligation_id: parseInt(document.getElementById('editObligationPaidSelect').value),
    amount: parseFloat(document.getElementById('editObligationPaidAmount').value),
    paid_date: document.getElementById('editObligationPaidDate').value,
    notes: document.getElementById('editObligationPaidNotes').value
  };

  try {
    await ipcRenderer.invoke('update-obligation-paid', id, data);
    closeEditObligationPaidModal();
    await loadDashboard();
    renderObligationsPaidDetailView();
  } catch (error) {
    alert('Error updating payment record: ' + error.message);
  }
}

window.deleteObligationPaid = async (id) => {
  if (!confirm('Are you sure you want to delete this payment record?')) return;

  try {
    await ipcRenderer.invoke('delete-obligation-paid', id);
    await loadDashboard();
    renderObligationsPaidDetailView();
  } catch (error) {
    alert('Error deleting payment record: ' + error.message);
  }
};

// Utility functions
function formatCurrency(amount) {
  return `₪${amount.toFixed(2)}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`;
}
