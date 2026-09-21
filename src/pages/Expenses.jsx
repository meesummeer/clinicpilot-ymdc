import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

// Staff roster for the Salary expense category — edit here to add/remove
// staff or update their base salary.
const STAFF_ROSTER = [
  { name: 'Warsha', baseSalary: 35000 },
  { name: 'Rashid', baseSalary: 55000 },
  { name: 'Rajesh', baseSalary: 25000 },
  { name: 'Gul Yar', baseSalary: 27000 },
  { name: 'Zubair', baseSalary: 25000 },
];

const CATEGORY_LABELS = { general: 'General', utility: 'Utility Bills', salary: 'Salary' };

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

function emptyForm(today) {
  return {
    category: 'general',
    expense_date: today,
    description: '',
    amount: '',
    staff_name: '',
    base_salary: '',
    deduction_amount: '0',
    deduction_reason: '',
  };
}

export default function Expenses({ profile }) {
  const canManage = profile?.role === 'admin' || (profile?.role === 'csr' && profile?.has_expenses_access === true);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(emptyForm(today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', dateFrom)
      .lte('expense_date', dateTo)
      .order('expense_date', { ascending: false });
    if (loadError) console.error(loadError.message);
    setExpenses(data || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const byCategory = useMemo(() => {
    const map = { general: 0, utility: 0, salary: 0 };
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return map;
  }, [expenses]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleStaffChange(name) {
    const staff = STAFF_ROSTER.find((s) => s.name === name);
    setForm((f) => ({ ...f, staff_name: name, base_salary: staff ? String(staff.baseSalary) : f.base_salary }));
  }

  function openNew() {
    setEditingExpense(null);
    setForm(emptyForm(today));
    setShowForm(true);
  }

  function openEdit(expense) {
    setEditingExpense(expense);
    setForm({
      category: expense.category,
      expense_date: expense.expense_date,
      description: expense.description || '',
      amount: expense.amount != null ? String(expense.amount) : '',
      staff_name: expense.staff_name || '',
      base_salary: expense.base_salary != null ? String(expense.base_salary) : '',
      deduction_amount: expense.deduction_amount != null ? String(expense.deduction_amount) : '0',
      deduction_reason: expense.deduction_reason || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingExpense(null);
  }

  const netSalary = Number(form.base_salary || 0) - Number(form.deduction_amount || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const isSalary = form.category === 'salary';
    const payload = isSalary
      ? {
          category: 'salary',
          expense_date: form.expense_date,
          description: form.description || null,
          amount: netSalary,
          staff_name: form.staff_name,
          base_salary: parseFloat(form.base_salary) || 0,
          deduction_amount: parseFloat(form.deduction_amount) || 0,
          deduction_reason: form.deduction_reason || null,
        }
      : {
          category: form.category,
          expense_date: form.expense_date,
          description: form.description,
          amount: parseFloat(form.amount) || 0,
          staff_name: null,
          base_salary: null,
          deduction_amount: null,
          deduction_reason: null,
        };

    const { error: saveError } = editingExpense
      ? await supabase.from('expenses').update(payload).eq('id', editingExpense.id)
      : await supabase.from('expenses').insert({ ...payload, created_by: profile.id });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    closeForm();
    loadExpenses();
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete this expense (${CATEGORY_LABELS[expense.category] || expense.category}, ${formatPKR(expense.amount)})? This can't be undone.`)) return;
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', expense.id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    loadExpenses();
  }

  function detailsFor(expense) {
    if (expense.category !== 'salary') return expense.description || '—';
    const parts = [`${expense.staff_name} — Base ${formatPKR(expense.base_salary)}`];
    if (expense.deduction_amount) {
      parts.push(`Deduction ${formatPKR(expense.deduction_amount)}${expense.deduction_reason ? ` (${expense.deduction_reason})` : ''}`);
    }
    parts.push(`→ Net ${formatPKR(expense.amount)}`);
    return parts.join(', ');
  }

  return (
    <div>
      <div className="card">
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <div className="filter-field">
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => (showForm ? closeForm() : openNew())}>
              {showForm ? 'Close' : '+ Add Expense'}
            </button>
          )}
        </div>
      </div>

      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Total Expenses</div>
          <div className="value">{formatPKR(totalExpenses)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">General</div>
          <div className="value">{formatPKR(byCategory.general)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Utility Bills</div>
          <div className="value">{formatPKR(byCategory.utility)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Salary</div>
          <div className="value">{formatPKR(byCategory.salary)}</div>
        </div>
      </div>

      {showForm && canManage && (
        <form className="card" onSubmit={handleSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
          {error && <div className="error-text">{error}</div>}
          <div className="filters-row">
            <div className="filter-field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)}>
                <option value="general">General</option>
                <option value="utility">Utility Bills</option>
                <option value="salary">Salary</option>
              </select>
            </div>
            <div className="filter-field">
              <label>Date</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => update('expense_date', e.target.value)}
                required
              />
            </div>
          </div>

          {form.category === 'salary' ? (
            <>
              <div className="filters-row">
                <div className="filter-field">
                  <label>Staff Member</label>
                  <select value={form.staff_name} onChange={(e) => handleStaffChange(e.target.value)} required>
                    <option value="">Select…</option>
                    {STAFF_ROSTER.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-field">
                  <label>Base Salary (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.base_salary}
                    onChange={(e) => update('base_salary', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="filters-row">
                <div className="filter-field">
                  <label>Deduction Amount (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.deduction_amount}
                    onChange={(e) => update('deduction_amount', e.target.value)}
                  />
                </div>
                <div className="filter-field">
                  <label>Deduction Reason</label>
                  <input
                    placeholder="e.g. 2 lates, 1 absence"
                    value={form.deduction_reason}
                    onChange={(e) => update('deduction_reason', e.target.value)}
                  />
                </div>
              </div>
              <div className="filter-field" style={{ marginBottom: 14 }}>
                <label>Net Salary</label>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{formatPKR(netSalary)}</div>
              </div>
              <div className="filter-field" style={{ marginBottom: 14 }}>
                <label>Description (optional)</label>
                <input
                  style={{ width: '100%' }}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="filters-row">
              <div className="filter-field">
                <label>Description</label>
                <input value={form.description} onChange={(e) => update('description', e.target.value)} required />
              </div>
              <div className="filter-field">
                <label>Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => update('amount', e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={saving} style={{ marginRight: 8 }}>
            {saving ? 'Saving…' : editingExpense ? 'Save Changes' : 'Add Expense'}
          </button>
          <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
        </form>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Expenses</h3>
        {loading ? (
          <p>Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="empty-state">No expenses for this range.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Details</th><th>Amount</th>{canManage && <th></th>}{canManage && <th></th>}</tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td>{formatDateDMY(exp.expense_date)}</td>
                  <td>{CATEGORY_LABELS[exp.category] || exp.category}</td>
                  <td>{detailsFor(exp)}</td>
                  <td>{formatPKR(exp.amount)}</td>
                  {canManage && (
                    <td><button className="btn-secondary" onClick={() => openEdit(exp)}>Edit</button></td>
                  )}
                  {canManage && (
                    <td><button className="btn-danger-outline" onClick={() => handleDelete(exp)}>Delete</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
