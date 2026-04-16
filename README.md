# Daily Expense Tracker

A lightweight, production-ready daily expense tracker built with React, Node.js, and SQLite.

## 🚀 Features

- **Quick Add**: Parse input like "50 food lunch" automatically.
- **Offline First**: Works without internet using LocalStorage and syncs when back online.
- **Visual Insights**: Real-time charts for spending habits and category distribution.
- **Budget Tracking**: Set a monthly budget and get alerts when approaching limits.
- **Export**: Download your data as CSV or JSON.
- **Dark Mode**: Supports system preferences and manual toggle.
- **Privacy**: No login required. Data stays on your machine.

## 🧱 Tech Stack

- **Frontend**: React 18, Tailwind CSS, Chart.js, Lucide Icons.
- **Backend**: Node.js, Express, Better-SQLite3.

## 🛠️ Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open the App**:
   Visit `http://localhost:3000` in your browser.

## 📁 Folder Structure

- `server.js`: Express server and API endpoints.
- `db.js`: SQLite database initialization and seeding.
- `index.html`: Main application entry point.
- `app.js`: React frontend logic and components.
- `styles.css`: Custom styles and animations.
- `expenses.db`: SQLite database file (generated on first run).

## 💡 Quick Tips

- Use the search bar to filter by note or category.
- Click the settings icon to change your monthly budget.
- The app automatically categorizes common terms (e.g., "burger" -> Food).
- Hover over expenses in the list to see Edit and Delete actions.

🤖 Generated with Skoop Agent
