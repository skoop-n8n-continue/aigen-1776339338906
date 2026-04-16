const { useState, useEffect, useMemo, useRef } = React;

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Other'];
const CATEGORY_ICONS = {
  Food: 'utensils',
  Transport: 'car',
  Bills: 'receipt',
  Shopping: 'shopping-bag',
  Other: 'package'
};

const App = () => {
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(1000);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    category: 'All',
    startDate: '',
    endDate: '',
    search: ''
  });

  // Load initial data
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    fetchData();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    if (!isOffline) {
      syncOfflineData();
    }
  }, [isOffline]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Try fetching from API
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        localStorage.setItem('expenses_backup', JSON.stringify(data));
      } else {
        throw new Error('Server unavailable');
      }

      const bRes = await fetch('/api/budget');
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData && bData.amount) {
          setBudget(bData.amount);
          localStorage.setItem('budget_backup', bData.amount);
        }
      }
    } catch (err) {
      console.warn('Using offline data:', err);
      const offlineExps = JSON.parse(localStorage.getItem('expenses_backup') || '[]');
      setExpenses(offlineExps);
      const offlineBudget = localStorage.getItem('budget_backup');
      if (offlineBudget) setBudget(parseFloat(offlineBudget));
    } finally {
      setLoading(false);
      setTimeout(() => lucide.createIcons(), 100);
    }
  };

  const syncOfflineData = async () => {
    const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
    if (pending.length === 0) return;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: pending })
      });
      if (res.ok) {
        localStorage.removeItem('pending_sync');
        fetchData();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const addExpense = async (expense) => {
    const newExpense = { ...expense, createdAt: new Date().toISOString() };

    if (isOffline) {
      const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
      pending.push(newExpense);
      localStorage.setItem('pending_sync', JSON.stringify(pending));

      const updated = [newExpense, ...expenses];
      setExpenses(updated);
      localStorage.setItem('expenses_backup', JSON.stringify(updated));
    } else {
      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expense)
        });
        if (res.ok) {
          const data = await res.json();
          setExpenses([data, ...expenses]);
        }
      } catch (err) {
        // Fallback to offline if request fails
        addExpense({ ...expense, isOffline: true });
      }
    }
    setTimeout(() => lucide.createIcons(), 100);
  };

  const deleteExpense = async (id) => {
    if (isOffline) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem('expenses_backup', JSON.stringify(updated));
    } else {
      try {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setExpenses(expenses.filter(e => e.id !== id));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const updateExpense = async (id, updatedData) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(expenses.map(e => e.id === id ? data : e));
        setEditingExpense(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchCategory = filters.category === 'All' || exp.category === filters.category;
      const matchDate = (!filters.startDate || exp.date >= filters.startDate) &&
                         (!filters.endDate || exp.date <= filters.endDate);
      const matchSearch = !filters.search ||
                          (exp.note && exp.note.toLowerCase().includes(filters.search.toLowerCase())) ||
                          exp.category.toLowerCase().includes(filters.search.toLowerCase());
      return matchCategory && matchDate && matchSearch;
    });
  }, [expenses, filters]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    return {
      today: expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0),
      week: expenses.filter(e => e.date >= oneWeekAgo).reduce((sum, e) => sum + e.amount, 0),
      month: expenses.filter(e => e.date >= firstDayMonth).reduce((sum, e) => sum + e.amount, 0),
    };
  }, [expenses]);

  useEffect(() => {
    lucide.createIcons();
  }, [expenses, editingExpense, filters, budget]);

  return (
    <div className="min-h-screen p-3 md:p-6 lg:p-8">
      <header className="max-w-6xl mx-auto flex flex-row justify-between items-center mb-6 md:mb-8 gap-2">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-primary p-1.5 md:p-2 rounded-lg text-white">
            <i data-lucide="wallet" className="w-5 h-5 md:w-8 md:h-8"></i>
          </div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">ExpenseTracker</h1>
          {isOffline && (
            <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px] md:text-xs flex items-center gap-1">
              <i data-lucide="wifi-off" className="w-2.5 h-2.5 md:w-3 md:h-3"></i>
              <span className="hidden xs:inline">Offline</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 md:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <i data-lucide={isDarkMode ? "sun" : "moon"} className="w-4 h-4 md:w-5 md:h-5"></i>
          </button>
          <BudgetConfig budget={budget} setBudget={async (val) => {
             setBudget(val);
             localStorage.setItem('budget_backup', val);
             try {
               await fetch('/api/budget', {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ amount: val })
               });
             } catch (err) {
               console.error('Failed to save budget to server:', err);
             }
          }} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Stats & Add */}
        <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
          <Dashboard stats={stats} budget={budget} expenses={expenses} />
          <ExpenseForm
            onAdd={addExpense}
            editingExpense={editingExpense}
            onUpdate={updateExpense}
            onCancel={() => setEditingExpense(null)}
          />
        </div>

        {/* Right Column: List & Filters */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8 order-1 lg:order-2">
          <Filters filters={filters} setFilters={setFilters} expenses={expenses} />
          <ExpenseList
            expenses={filteredExpenses}
            onDelete={deleteExpense}
            onEdit={setEditingExpense}
          />
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-500 text-sm">
        <p>Built with React & Node.js &bull; LocalStorage Sync Enabled</p>
      </footer>
    </div>
  );
};

const Dashboard = ({ stats, budget, expenses }) => {
  const chartRef = useRef(null);
  const pieRef = useRef(null);
  const chartInstance = useRef(null);
  const pieInstance = useRef(null);

  useEffect(() => {
    if (expenses.length === 0) return;

    // Bar Chart - Last 7 Days
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dailyData = last7Days.map(date => {
      return expenses.filter(e => e.date === date).reduce((sum, e) => sum + e.amount, 0);
    });

    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: last7Days.map(d => d.split('-').slice(1).join('/')),
        datasets: [{
          label: 'Spending',
          data: dailyData,
          backgroundColor: '#00b7af',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Pie Chart - Category distribution
    const catData = CATEGORIES.map(cat => {
      return expenses.reduce((sum, e) => e.category === cat ? sum + e.amount : sum, 0);
    });

    if (pieInstance.current) pieInstance.current.destroy();
    const pCtx = pieRef.current.getContext('2d');
    pieInstance.current = new Chart(pCtx, {
      type: 'doughnut',
      data: {
        labels: CATEGORIES,
        datasets: [{
          data: catData,
          backgroundColor: ['#00b7af', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }, [expenses]);

  const percentUsed = budget > 0 ? Math.min(Math.round((stats.month / budget) * 100), 100) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 text-[10px] md:text-sm uppercase font-bold tracking-wider">Today</p>
          <h3 className="text-lg md:text-xl font-bold">${stats.today.toFixed(2)}</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 text-[10px] md:text-sm uppercase font-bold tracking-wider">Month</p>
          <h3 className="text-lg md:text-xl font-bold">${stats.month.toFixed(2)}</h3>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs md:text-sm font-medium">Monthly Budget</span>
          <span className="text-[10px] md:text-sm text-gray-500 font-mono">${stats.month.toFixed(0)} / ${budget}</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 md:h-2.5">
          <div
            className={`h-2 md:h-2.5 rounded-full transition-all duration-500 ${percentUsed > 90 ? 'bg-red-500' : 'bg-primary'}`}
            style={{ width: `${percentUsed}%` }}
          ></div>
        </div>
        {percentUsed > 90 && (
          <p className="text-red-500 text-[10px] md:text-xs mt-2 flex items-center gap-1">
            <i data-lucide="alert-triangle" className="w-3 h-3"></i> Budget limit reached!
          </p>
        )}
      </div>

      {/* Visuals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h4 className="text-xs md:text-sm font-bold mb-3 md:mb-4">Weekly Spending</h4>
          <div className="h-[200px] md:h-[250px] relative w-full">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h4 className="text-xs md:text-sm font-bold mb-3 md:mb-4">By Category</h4>
          <div className="h-[200px] md:h-[250px] relative w-full">
            <canvas ref={pieRef}></canvas>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpenseForm = ({ onAdd, editingExpense, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Food',
    note: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [quickAdd, setQuickAdd] = useState('');

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        amount: editingExpense.amount,
        category: editingExpense.category,
        note: editingExpense.note || '',
        date: editingExpense.date
      });
    } else {
      setFormData({
        amount: '',
        category: 'Food',
        note: '',
        date: new Date().toISOString().split('T')[0]
      });
    }
  }, [editingExpense]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    if (editingExpense) {
      onUpdate(editingExpense.id, { ...formData, amount: parseFloat(formData.amount) });
    } else {
      onAdd({ ...formData, amount: parseFloat(formData.amount) });
    }

    setFormData({
      amount: '',
      category: 'Food',
      note: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleQuickAdd = (e) => {
    if (e.key === 'Enter' && quickAdd.trim()) {
      const parts = quickAdd.trim().split(' ');
      let amount = parseFloat(parts[0]);
      let category = 'Other';
      let note = '';

      if (isNaN(amount)) {
        // Try parsing "category amount note"
        amount = parseFloat(parts[1]);
        if (!isNaN(amount)) {
          category = parts[0];
          note = parts.slice(2).join(' ');
        }
      } else {
        // "amount category note"
        category = parts[1] || 'Other';
        note = parts.slice(2).join(' ');
      }

      // Auto-categorize
      const catMatch = CATEGORIES.find(c =>
        category.toLowerCase().includes(c.toLowerCase()) ||
        note.toLowerCase().includes(c.toLowerCase()) ||
        (c === 'Food' && (note.toLowerCase().includes('burger') || note.toLowerCase().includes('lunch') || note.toLowerCase().includes('coffee'))) ||
        (c === 'Transport' && (note.toLowerCase().includes('uber') || note.toLowerCase().includes('gas') || note.toLowerCase().includes('taxi')))
      );

      onAdd({
        amount: isNaN(amount) ? 0 : amount,
        category: catMatch || 'Other',
        note: note || category,
        date: new Date().toISOString().split('T')[0]
      });
      setQuickAdd('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in">
      <h3 className="text-lg font-bold mb-4">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h3>

      {!editingExpense && (
        <div className="mb-6">
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block uppercase font-bold tracking-wider">Quick Add (e.g. "50 food lunch")</label>
          <input
            type="text"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="Type and press Enter..."
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] md:text-xs text-gray-500 mb-1 block uppercase font-bold tracking-wider">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-[10px] md:text-xs text-gray-500 mb-1 block uppercase font-bold tracking-wider">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 dark:text-gray-100"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block uppercase font-bold tracking-wider">Note (optional)</label>
          <input
            type="text"
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
            placeholder="What was this for?"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block uppercase font-bold tracking-wider">Date</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition-opacity text-sm shadow-md shadow-primary/20"
          >
            {editingExpense ? 'Update Expense' : 'Add Expense'}
          </button>
          {editingExpense && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

const Filters = ({ filters, setFilters, expenses }) => {
  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Note', 'Amount'];
    const rows = expenses.map(e => [e.date, e.category, e.note || '', e.amount]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end gap-3 md:gap-4">
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <i data-lucide="search" className="w-3 md:w-4 h-3 md:h-4 absolute left-3 top-2.5 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search notes..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block">Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 md:px-4 py-2 text-sm outline-none"
          >
            <option value="All">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block">From</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 md:px-4 py-2 text-sm outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] md:text-xs text-gray-500 mb-1 block">To</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 md:px-4 py-2 text-sm outline-none"
          />
        </div>

        <div className="flex gap-2">
           <button onClick={exportCSV} className="flex-1 md:flex-none p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex justify-center" title="Export CSV">
             <i data-lucide="download" className="w-5 h-5"></i>
           </button>
           <button onClick={exportJSON} className="flex-1 md:flex-none p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex justify-center" title="Export JSON">
             <i data-lucide="file-json" className="w-5 h-5"></i>
           </button>
        </div>
      </div>
    </div>
  );
};

const ExpenseList = ({ expenses, onDelete, onEdit }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-[10px] md:text-xs uppercase font-bold">
            <tr>
              <th className="px-3 md:px-6 py-4">Date</th>
              <th className="px-3 md:px-6 py-4">Category</th>
              <th className="hidden sm:table-cell px-3 md:px-6 py-4">Note</th>
              <th className="px-3 md:px-6 py-4">Amount</th>
              <th className="px-3 md:px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center">
                    <i data-lucide="inbox" className="w-12 h-12 mb-2 opacity-20"></i>
                    <p>No expenses found</p>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id || exp.createdAt} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors group">
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm">
                    {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${getCatColor(exp.category)}`}>
                        <i data-lucide={CATEGORY_ICONS[exp.category] || 'package'} className="w-3.5 h-3.5"></i>
                      </div>
                      <span className="text-xs md:text-sm font-medium">{exp.category}</span>
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-3 md:px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
                    {exp.note || '-'}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap font-bold text-xs md:text-sm">
                    ${exp.amount.toFixed(2)}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1 md:gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(exp)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                      >
                        <i data-lucide="edit-2" className="w-4 h-4"></i>
                      </button>
                      <button
                        onClick={() => onDelete(exp.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                      >
                        <i data-lucide="trash-2" className="w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BudgetConfig = ({ budget, setBudget }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [val, setVal] = useState(budget);

  useEffect(() => {
    setVal(budget);
  }, [budget]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 md:px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
      >
        <i data-lucide="settings" className="w-4 h-4"></i>
        <span className="hidden xs:inline">Budget:</span> ${budget}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50 animate-fade-in">
          <h4 className="font-bold text-sm mb-3">Set Monthly Budget</h4>
          <div className="flex gap-2">
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={() => {
                const parsed = parseFloat(val);
                if (!isNaN(parsed) && parsed >= 0) {
                  setBudget(parsed);
                  setIsOpen(false);
                }
              }}
              className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-bold"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const getCatColor = (cat) => {
  switch(cat) {
    case 'Food': return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30';
    case 'Transport': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30';
    case 'Bills': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30';
    case 'Shopping': return 'bg-red-100 text-red-600 dark:bg-red-900/30';
    default: return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30';
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
lucide.createIcons();
setTimeout(() => lucide.createIcons(), 500); // Second pass for dynamic elements
