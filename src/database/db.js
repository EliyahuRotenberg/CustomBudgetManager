const Database = require('better-sqlite3');

class BudgetDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  initTables() {
    // Income sources table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS income_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        expected_amount_min REAL NOT NULL,
        expected_amount_max REAL,
        expected_day INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Income received table (monthly records)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS income_received (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        income_source_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        received_date DATE NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (income_source_id) REFERENCES income_sources(id) ON DELETE CASCADE
      )
    `);

    // Obligations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS obligations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('loan', 'rent', 'credit_card', 'subscription', 'regular', 'other')),
        total_balance REAL DEFAULT 0,
        interest_rate REAL DEFAULT 0,
        payoff_target_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Obligations paid table (monthly records)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS obligations_paid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obligation_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        paid_date DATE NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE
      )
    `);

    // Expense categories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Variable expenses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        expense_date DATE NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id)
      )
    `);

    // Goals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE CHECK(type IN ('emergency_fund', 'university_debt', 'monthly_savings')),
        target_amount REAL DEFAULT 0,
        current_amount REAL DEFAULT 0,
        monthly_target REAL DEFAULT 0,
        minimum_payment REAL DEFAULT 0,
        chip_away_enabled INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Goal history table (for tracking progress over time)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goal_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_type TEXT NOT NULL,
        amount REAL NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Monthly snapshots table (cached calculations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        total_expected_income REAL DEFAULT 0,
        total_received_income REAL DEFAULT 0,
        total_obligations REAL DEFAULT 0,
        total_obligations_paid REAL DEFAULT 0,
        total_variable_spending REAL DEFAULT 0,
        safe_to_spend REAL DEFAULT 0,
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month, year)
      )
    `);

    // Initialize default expense categories
    const defaultCategories = ['Dog', 'Groceries', 'Entertainment', 'Transportation', 'Health', 'Other'];
    const insertCategory = this.db.prepare('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)');
    defaultCategories.forEach(cat => insertCategory.run(cat));

    // Initialize goals
    const initGoals = this.db.prepare(`
      INSERT OR IGNORE INTO goals (type, target_amount, current_amount, monthly_target)
      VALUES (?, 0, 0, 0)
    `);
    initGoals.run('emergency_fund');
    initGoals.run('university_debt');
    initGoals.run('monthly_savings');
  }

  // ===== Income Sources =====
  getIncomeSources() {
    return this.db.prepare('SELECT * FROM income_sources ORDER BY name').all();
  }

  addIncomeSource(data) {
    const stmt = this.db.prepare(`
      INSERT INTO income_sources (name, expected_amount_min, expected_amount_max, expected_day)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.expected_amount_min,
      data.expected_amount_max || data.expected_amount_min,
      data.expected_day
    );
    return result.lastInsertRowid;
  }

  updateIncomeSource(id, data) {
    const stmt = this.db.prepare(`
      UPDATE income_sources
      SET name = ?, expected_amount_min = ?, expected_amount_max = ?, expected_day = ?
      WHERE id = ?
    `);
    stmt.run(
      data.name,
      data.expected_amount_min,
      data.expected_amount_max || data.expected_amount_min,
      data.expected_day,
      id
    );
  }

  deleteIncomeSource(id) {
    this.db.prepare('DELETE FROM income_sources WHERE id = ?').run(id);
  }

  recordIncomeReceived(data) {
    const date = new Date(data.received_date);
    const stmt = this.db.prepare(`
      INSERT INTO income_received (income_source_id, amount, received_date, month, year, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.income_source_id,
      data.amount,
      data.received_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null
    );
    return result.lastInsertRowid;
  }

  updateIncomeReceived(id, data) {
    const date = new Date(data.received_date);
    const stmt = this.db.prepare(`
      UPDATE income_received
      SET income_source_id = ?, amount = ?, received_date = ?, month = ?, year = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      data.income_source_id,
      data.amount,
      data.received_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null,
      id
    );
  }

  deleteIncomeReceived(id) {
    this.db.prepare('DELETE FROM income_received WHERE id = ?').run(id);
  }

  getIncomeReceived(month, year) {
    return this.db.prepare(`
      SELECT ir.*, ins.name as source_name
      FROM income_received ir
      JOIN income_sources ins ON ir.income_source_id = ins.id
      WHERE ir.month = ? AND ir.year = ?
      ORDER BY ir.received_date DESC
    `).all(month, year);
  }

  // ===== Obligations =====
  getObligations() {
    return this.db.prepare('SELECT * FROM obligations ORDER BY due_date').all();
  }

  addObligation(data) {
    const stmt = this.db.prepare(`
      INSERT INTO obligations (name, amount, due_date, category, total_balance, interest_rate, payoff_target_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.amount,
      data.due_date,
      data.category,
      data.total_balance || 0,
      data.interest_rate || 0,
      data.payoff_target_date || null
    );
    return result.lastInsertRowid;
  }

  updateObligation(id, data) {
    const stmt = this.db.prepare(`
      UPDATE obligations
      SET name = ?, amount = ?, due_date = ?, category = ?, total_balance = ?, interest_rate = ?, payoff_target_date = ?
      WHERE id = ?
    `);
    stmt.run(
      data.name,
      data.amount,
      data.due_date,
      data.category,
      data.total_balance || 0,
      data.interest_rate || 0,
      data.payoff_target_date || null,
      id
    );
  }

  deleteObligation(id) {
    this.db.prepare('DELETE FROM obligations WHERE id = ?').run(id);
  }

  recordObligationPaid(data) {
    const date = new Date(data.paid_date);
    const stmt = this.db.prepare(`
      INSERT INTO obligations_paid (obligation_id, amount, paid_date, month, year, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.obligation_id,
      data.amount,
      data.paid_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null
    );
    return result.lastInsertRowid;
  }

  updateObligationPaid(id, data) {
    const date = new Date(data.paid_date);
    const stmt = this.db.prepare(`
      UPDATE obligations_paid
      SET obligation_id = ?, amount = ?, paid_date = ?, month = ?, year = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      data.obligation_id,
      data.amount,
      data.paid_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null,
      id
    );
  }

  deleteObligationPaid(id) {
    this.db.prepare('DELETE FROM obligations_paid WHERE id = ?').run(id);
  }

  getObligationsPaid(month, year) {
    return this.db.prepare(`
      SELECT op.*, o.name as obligation_name, o.category
      FROM obligations_paid op
      JOIN obligations o ON op.obligation_id = o.id
      WHERE op.month = ? AND op.year = ?
      ORDER BY op.paid_date DESC
    `).all(month, year);
  }

  // ===== Expenses =====
  getExpenseCategories() {
    return this.db.prepare('SELECT * FROM expense_categories ORDER BY name').all();
  }

  addExpenseCategory(name) {
    const stmt = this.db.prepare('INSERT INTO expense_categories (name) VALUES (?)');
    const result = stmt.run(name);
    return result.lastInsertRowid;
  }

  updateExpenseCategory(id, name) {
    const stmt = this.db.prepare('UPDATE expense_categories SET name = ? WHERE id = ?');
    stmt.run(name, id);
  }

  deleteExpenseCategory(id) {
    // Check if category is in use
    const expensesWithCategory = this.db.prepare('SELECT COUNT(*) as count FROM expenses WHERE category_id = ?').get(id);
    if (expensesWithCategory.count > 0) {
      throw new Error('Cannot delete category that has existing expenses');
    }
    this.db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id);
  }

  addExpense(data) {
    const date = new Date(data.expense_date);
    const stmt = this.db.prepare(`
      INSERT INTO expenses (category_id, amount, expense_date, month, year, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.category_id,
      data.amount,
      data.expense_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null
    );
    return result.lastInsertRowid;
  }

  updateExpense(id, data) {
    const date = new Date(data.expense_date);
    const stmt = this.db.prepare(`
      UPDATE expenses
      SET category_id = ?, amount = ?, expense_date = ?, month = ?, year = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      data.category_id,
      data.amount,
      data.expense_date,
      date.getMonth() + 1,
      date.getFullYear(),
      data.notes || null,
      id
    );
  }

  deleteExpense(id) {
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  }

  getExpenses(month, year) {
    return this.db.prepare(`
      SELECT e.*, ec.name as category_name
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.month = ? AND e.year = ?
      ORDER BY e.expense_date DESC
    `).all(month, year);
  }

  getExpensesByCategory(month, year) {
    return this.db.prepare(`
      SELECT ec.name as category, SUM(e.amount) as total
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.month = ? AND e.year = ?
      GROUP BY ec.id, ec.name
      ORDER BY total DESC
    `).all(month, year);
  }

  // ===== Goals =====
  getGoals() {
    return this.db.prepare('SELECT * FROM goals').all();
  }

  updateGoal(type, data) {
    const stmt = this.db.prepare(`
      UPDATE goals
      SET target_amount = ?, current_amount = ?, monthly_target = ?, minimum_payment = ?, chip_away_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE type = ?
    `);
    stmt.run(
      data.target_amount !== undefined ? data.target_amount : 0,
      data.current_amount !== undefined ? data.current_amount : 0,
      data.monthly_target !== undefined ? data.monthly_target : 0,
      data.minimum_payment !== undefined ? data.minimum_payment : 0,
      data.chip_away_enabled !== undefined ? (data.chip_away_enabled ? 1 : 0) : 0,
      type
    );
  }

  addGoalHistory(type, amount, month, year) {
    const stmt = this.db.prepare(`
      INSERT INTO goal_history (goal_type, amount, month, year)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(type, amount, month, year);
  }

  getGoalHistory(type) {
    return this.db.prepare(`
      SELECT * FROM goal_history
      WHERE goal_type = ?
      ORDER BY year, month
    `).all(type);
  }

  // ===== Monthly Snapshot =====
  getMonthlySnapshot(month, year) {
    // Calculate all values
    const incomeSources = this.getIncomeSources();
    const incomeReceived = this.getIncomeReceived(month, year);
    const obligations = this.getObligations();
    const obligationsPaid = this.getObligationsPaid(month, year);
    const expenses = this.getExpenses(month, year);

    const totalExpectedIncome = incomeSources.reduce((sum, source) => sum + source.expected_amount_min, 0);
    const totalReceivedIncome = incomeReceived.reduce((sum, income) => sum + income.amount, 0);
    const totalObligations = obligations.reduce((sum, obl) => sum + obl.amount, 0);
    const totalObligationsPaid = obligationsPaid.reduce((sum, obl) => sum + obl.amount, 0);
    const totalVariableSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate pending obligations (not yet paid this month)
    const paidObligationIds = new Set(obligationsPaid.map(o => o.obligation_id));
    const pendingObligations = obligations
      .filter(o => !paidObligationIds.has(o.id))
      .reduce((sum, o) => sum + o.amount, 0);

    // Safe to spend = income received - obligations paid - variable spending
    // Note: We only count what's actually happened (received/paid/spent), not expected/pending
    const safeToSpend = totalReceivedIncome - totalObligationsPaid - totalVariableSpending;

    return {
      month,
      year,
      totalExpectedIncome,
      totalReceivedIncome,
      totalObligations,
      totalObligationsPaid,
      pendingObligations,
      totalVariableSpending,
      safeToSpend
    };
  }

  // ===== Monthly Trajectory =====
  getMonthlyTrajectory(month, year) {
    // Get all transactions for the month
    const incomeSources = this.getIncomeSources();
    const incomeReceived = this.getIncomeReceived(month, year);
    const obligations = this.getObligations();
    const obligationsPaid = this.getObligationsPaid(month, year);
    const expenses = this.getExpenses(month, year);

    // Combine all transactions with dates
    const transactions = [];

    // Add received income (actual)
    incomeReceived.forEach(income => {
      transactions.push({
        date: income.received_date,
        type: 'income',
        amount: income.amount,
        description: income.source_name,
        status: 'actual'
      });
    });

    // Add expected income (not yet received)
    const receivedSourceIds = new Set(incomeReceived.map(i => i.income_source_id));
    incomeSources.forEach(source => {
      if (!receivedSourceIds.has(source.id)) {
        const expectedDate = new Date(year, month - 1, source.expected_day);
        transactions.push({
          date: expectedDate.toISOString().split('T')[0],
          type: 'income',
          amount: source.expected_amount_min,
          description: source.name,
          status: 'expected'
        });
      }
    });

    // Add paid obligations (actual)
    obligationsPaid.forEach(obl => {
      transactions.push({
        date: obl.paid_date,
        type: 'obligation',
        amount: -obl.amount,
        description: obl.obligation_name,
        status: 'actual'
      });
    });

    // Add unpaid obligations (expected)
    const paidObligationIds = new Set(obligationsPaid.map(o => o.obligation_id));
    obligations.forEach(obligation => {
      if (!paidObligationIds.has(obligation.id)) {
        const dueDate = new Date(year, month - 1, obligation.due_date);
        transactions.push({
          date: dueDate.toISOString().split('T')[0],
          type: 'obligation',
          amount: -obligation.amount,
          description: obligation.name,
          status: 'expected'
        });
      }
    });

    // Add expenses (always actual)
    expenses.forEach(exp => {
      transactions.push({
        date: exp.expense_date,
        type: 'expense',
        amount: -exp.amount,
        description: exp.category_name,
        status: 'actual'
      });
    });

    // Sort by date, then by status (actual before expected)
    transactions.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      // If same date, actual comes before expected
      if (a.status === 'actual' && b.status === 'expected') return -1;
      if (a.status === 'expected' && b.status === 'actual') return 1;
      return 0;
    });

    // Calculate running balance
    let runningBalance = 0;
    const trajectory = transactions.map(tx => {
      runningBalance += tx.amount;
      return {
        ...tx,
        balance: runningBalance
      };
    });

    return trajectory;
  }

  // ===== Export =====
  exportToCSV(type, month, year) {
    let data = [];
    let headers = [];

    if (type === 'income') {
      data = this.getIncomeReceived(month, year);
      headers = ['ID', 'Source', 'Amount', 'Date', 'Notes'];
    } else if (type === 'obligations') {
      data = this.getObligationsPaid(month, year);
      headers = ['ID', 'Obligation', 'Amount', 'Date', 'Category', 'Notes'];
    } else if (type === 'expenses') {
      data = this.getExpenses(month, year);
      headers = ['ID', 'Category', 'Amount', 'Date', 'Notes'];
    }

    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      const values = Object.values(row).map(v => `"${v || ''}"`);
      csv += values.join(',') + '\n';
    });

    return csv;
  }

  close() {
    this.db.close();
  }
}

module.exports = BudgetDatabase;
