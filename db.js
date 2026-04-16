const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'expenses.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budget (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    amount REAL NOT NULL
  );
`);

// Insert default budget if not exists
db.prepare('INSERT OR IGNORE INTO budget (id, amount) VALUES (1, 1000)').run();

// Seed data helper
const seedData = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;
  if (count === 0) {
    const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Other'];
    const now = new Date();
    const insert = db.prepare('INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)');

    for (let i = 0; i < 15; i++) {
      const date = new Date();
      date.setDate(now.getDate() - Math.floor(Math.random() * 10));
      const amount = (Math.random() * 100 + 10).toFixed(2);
      const category = categories[Math.floor(Math.random() * categories.length)];
      const note = `Sample ${category} expense ${i + 1}`;
      insert.run(amount, category, note, date.toISOString().split('T')[0]);
    }
    console.log('Database seeded with sample data.');
  }
};

seedData();

module.exports = db;
