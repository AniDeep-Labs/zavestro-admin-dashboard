import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminUsers } from '../../data/adminMockData';
import styles from './UsersListPage.module.css';

export const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const filtered = adminUsers.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Users</h1>
        <button className={styles.exportBtn}>Export CSV</button>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Active</option>
          <option>Deactivated</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter('All'); }}>Clear All</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Orders</th>
              <th>Credits</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No users found.</td></tr>
            ) : (
              filtered.map(user => (
                <tr key={user.id} className={styles.row} onClick={() => navigate(`/admin/users/${user.id}`)}>
                  <td className={styles.userName}>{user.name}</td>
                  <td className={styles.phone}>{user.phone.replace(/\d{5}$/, 'XXXXX')}</td>
                  <td className={styles.email}>{user.email}</td>
                  <td>{user.city}</td>
                  <td>
                    <button
                      className={styles.ordersLink}
                      onClick={e => { e.stopPropagation(); navigate('/admin/orders'); }}
                    >
                      {user.orders}
                    </button>
                  </td>
                  <td>₹{user.credits}</td>
                  <td className={styles.date}>{user.joined}</td>
                  <td>
                    <span className={`${styles.statusPill} ${user.status === 'Active' ? styles.statusActive : styles.statusDeactivated}`}>
                      {user.status}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => navigate(`/admin/users/${user.id}`)}>👁</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        Showing {filtered.length} of {adminUsers.length} customers
      </div>
    </div>
  );
};
