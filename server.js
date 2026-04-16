const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('.')); // Serve the frontend from root

// --- API Endpoints ---

// GET /api/expenses - Get all expenses with filters
app.get('/api/expenses', (appReq, res) => {
  try {
    const { category, startDate, endDate, search } = appReq.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    if (search) {
      query += ' AND note LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY date DESC, createdAt DESC';
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses - Create expense
app.post('/api/expenses', (appReq, res) => {
  try {
    const { amount, category, note, date } = appReq.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    if (!category) return res.status(400).json({ error: 'Category is required' });

    const stmt = db.prepare('INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)');
    const info = stmt.run(amount, category, note, date || new Date().toISOString().split('T')[0]);

    const newExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id - Update expense
app.put('/api/expenses/:id', (appReq, res) => {
  try {
    const { id } = appReq.params;
    const { amount, category, note, date } = appReq.body;

    const stmt = db.prepare('UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?');
    const info = stmt.run(amount, category, note, date, id);

    if (info.changes === 0) return res.status(404).json({ error: 'Expense not found' });

    const updatedExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(updatedExpense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id - Delete expense
app.delete('/api/expenses/:id', (appReq, res) => {
  try {
    const { id } = appReq.params;
    const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

    if (info.changes === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget - Get budget
app.get('/api/budget', (appReq, res) => {
  const budget = db.prepare('SELECT amount FROM budget WHERE id = 1').get();
  res.json(budget);
});

// PUT /api/budget - Update budget
app.put('/api/budget', (appReq, res) => {
  const { amount } = appReq.body;
  db.prepare('UPDATE budget SET amount = ? WHERE id = 1').run(amount);
  res.json({ amount });
});

// Sync endpoint for batch uploads (offline mode support)
app.post('/api/sync', (appReq, res) => {
  try {
    const { expenses } = appReq.body;
    const insert = db.prepare('INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction((exps) => {
      for (const exp of exps) {
        insert.run(exp.amount, exp.category, exp.note, exp.date);
      }
    });

    transaction(expenses);
    res.json({ message: 'Sync successful', count: expenses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
