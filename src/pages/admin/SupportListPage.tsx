import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supportTickets } from '../../data/adminMockData';
import styles from './SupportListPage.module.css';

export const SupportListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [priorityFilter, setPriorityFilter] = React.useState('All');

  const filtered = supportTickets.filter(t => {
    const matchSearch = !search || t.id.toLowerCase().includes(search.toLowerCase()) || t.customer.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const open = supportTickets.filter(t => t.status === 'Open').length;
  const inProgress = supportTickets.filter(t => t.status === 'In Progress').length;
  const unassigned = supportTickets.filter(t => !t.assignedTo).length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Support Tickets</h1>
      </div>

      {/* KPI Row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}><span className={styles.kpiValue}>{open}</span><span className={styles.kpiLabel}>Open</span></div>
        <div className={styles.kpi}><span className={styles.kpiValue}>{inProgress}</span><span className={styles.kpiLabel}>In Progress</span></div>
        <div className={styles.kpi}><span className={styles.kpiValue}>3</span><span className={styles.kpiLabel}>Resolved today</span></div>
        <div className={styles.kpi}><span className={styles.kpiValue}>4.2h</span><span className={styles.kpiLabel}>Avg. Response</span></div>
        <div className={`${styles.kpi} ${unassigned > 0 ? styles.kpiDanger : ''}`}>
          <span className={styles.kpiValue}>{unassigned}</span>
          <span className={styles.kpiLabel}>Unassigned &gt;24h</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by ticket ID, customer, or subject…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Open</option>
          <option value="In Progress">In Progress</option>
          <option>Resolved</option>
          <option>Closed</option>
        </select>
        <select className={styles.filterSelect} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter('All'); setPriorityFilter('All'); }}>Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Customer</th>
              <th>Subject</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No tickets match your filters.</td></tr>
            ) : (
              filtered.map(ticket => (
                <tr
                  key={ticket.id}
                  className={`${styles.row} ${!ticket.assignedTo ? styles.rowUnread : ''}`}
                  onClick={() => navigate(`/admin/support/${ticket.id}`)}
                >
                  <td className={styles.ticketId}>{ticket.id}</td>
                  <td>
                    <div className={styles.customerName}>{ticket.customer}</div>
                    <div className={styles.customerPhone}>{ticket.phone}</div>
                  </td>
                  <td className={styles.subject}>{ticket.subject}</td>
                  <td><span className={styles.categoryPill}>{ticket.category}</span></td>
                  <td>
                    <span className={`${styles.priorityPill} ${styles[`priority${ticket.priority}`]}`}>{ticket.priority}</span>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${ticket.status.replace(' ', '')}`]}`}>{ticket.status}</span>
                  </td>
                  <td className={ticket.assignedTo ? '' : styles.unassigned}>
                    {ticket.assignedTo || 'Unassigned'}
                  </td>
                  <td className={styles.time}>{ticket.created}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button className={styles.viewBtn} onClick={() => navigate(`/admin/support/${ticket.id}`)}>View</button>
                      {!ticket.assignedTo && <button className={styles.assignBtn}>Assign</button>}
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
