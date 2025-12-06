# Budget Manager

A local Windows desktop budget manager built with Electron, JavaScript, and SQLite. Designed for managing irregular income and fixed obligations with a focus on answering: **"What can I safely spend right now?"**

## Features

### Core Functionality
- **Safe to Spend Calculation**: Real-time display of available funds with color-coded status (green/amber/red)
- **Income Tracking**: Track expected vs received income from multiple sources
- **Obligation Management**: Monitor fixed payments (loans, rent, subscriptions) with due dates
- **Variable Expenses**: Categorize and track discretionary spending
- **Goals Progress**: Track emergency fund, debt payoff, and savings targets
- **Upcoming Alerts**: 7-day lookout for pending income and due obligations

### User Experience
- **Dark Mode**: Eye-friendly dark theme with strategic color coding
- **Quick Entry**: Fast transaction logging with keyboard shortcut (Ctrl+N)
- **Monthly Reset**: Clean monthly view aligned with billing cycles
- **Smart Suggestions**: Automated recommendations for surplus allocation

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **SQLite** (better-sqlite3): Local database for data persistence
- **Vanilla JavaScript**: Simple, lightweight frontend
- **No external dependencies**: Runs completely offline

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd CustomBudgetManager
```

2. Install dependencies:
```bash
npm install
```

3. Run the app:
```bash
npm start
```

For development with DevTools:
```bash
npm run dev
```

## First-Time Setup

When you first launch the app:

1. **Add Income Sources**:
   - Click "Settings" → "Income Sources" tab
   - Add your expected income sources with amounts and dates

2. **Add Obligations**:
   - Click "Settings" → "Obligations" tab
   - Add your fixed monthly payments

3. **Set Goals**:
   - Click "Settings" → "Goals" tab
   - Configure your emergency fund target, debt balances, and savings goals

## Daily Usage

### Recording Income
1. Click the green "+" button (or press Ctrl+N)
2. Select "Income" tab
3. Choose source, enter amount, and date
4. Click "Record Income"

### Recording Expenses
1. Click the green "+" button (or press Ctrl+N)
2. Select "Expense" tab
3. Choose category, enter amount, and date
4. Click "Add Expense"

### Marking Obligations as Paid
1. Click the green "+" button (or press Ctrl+N)
2. Select "Obligation" tab
3. Choose obligation, enter amount, and date
4. Click "Mark as Paid"

**Quick Tip**: Use the "✓" buttons on the dashboard for one-click recording of expected amounts.

## Understanding "Safe to Spend"

The Safe to Spend amount is calculated as:

```
Income Received - Obligations Paid - Pending Obligations - Variable Expenses
```

### Color Coding:
- **Green** (£500+): Healthy buffer - you're in good shape
- **Amber** (£100-£499): Tight but okay - be cautious
- **Red** (<£100): Danger zone - minimize spending

## Data Storage

All data is stored locally on your machine in:
```
%APPDATA%/budget-manager/budget.db (Windows)
~/Library/Application Support/budget-manager/budget.db (macOS)
~/.config/budget-manager/budget.db (Linux)
```

Your financial data **never leaves your computer**.

## Keyboard Shortcuts

- **Ctrl+N** (Cmd+N on Mac): Open Quick Entry
- **Escape**: Close any modal

## Alerts & Notifications

The app will:
- Display upcoming items (next 7 days) on the dashboard
- Send system notifications for payments due within 7 days
- Highlight urgent items (2 days or less) in red

## Monthly Suggestions

After all expected income is received, the app suggests:
- How much to allocate to emergency fund
- Extra payments toward debt
- Based on your remaining surplus after all obligations

## Project Structure

```
CustomBudgetManager/
├── src/
│   ├── main.js                 # Electron main process
│   ├── database/
│   │   └── db.js              # SQLite database layer
│   └── renderer/
│       ├── index.html         # Main UI
│       ├── styles.css         # Dark mode styling
│       └── renderer.js        # UI logic
├── package.json
└── README.md
```

## Development Roadmap

### Current Features ✓
- Income & expense tracking
- Obligation management
- Goals tracking
- Quick entry
- Alerts panel
- Monthly suggestions
- Keyboard shortcuts

### Planned Features
- [ ] CSV export for backup
- [ ] Trajectory view with charts
- [ ] Month-over-month comparison
- [ ] Recurring transaction templates
- [ ] Customizable alert thresholds

## Out of Scope

This app intentionally **does not** include:
- Bank sync or automatic imports
- Mobile version
- Multi-currency support
- Shared/family budgets
- Cloud backup

The goal is to keep it simple, fast, and completely local.

## Troubleshooting

### App won't start
- Ensure Node.js is installed: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Database errors
- The database is created automatically on first run
- If corrupted, delete the `.db` file from the app data directory

### Missing data
- Check that you're adding data for the current month
- The app resets checklists each calendar month

## Contributing

This is a personal budget tool, but contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with a clear description

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ for people with irregular income and a need for clarity.**
