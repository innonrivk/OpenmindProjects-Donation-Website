/**
 * CMSAdminsTable Component — Renders the table list of administrators.
 *
 * Why? Separating the table from the main parent container keeps code modular,
 * simplifies readability, and keeps file line counts below the strict 250-line limit.
 */
export default function CMSAdminsTable({
  users,
  currentAdmin,
  updateRoleMutation,
  handleRoleChange,
  handleRemoveClick,
}) {
  return (
    <div className="cms-table-container glass" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
      <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
            <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Name</th>
            <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Email Address</th>
            <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Role</th>
            <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Status / Joined</th>
            <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = currentAdmin?.id === user.id || currentAdmin?.email?.toLowerCase() === user.email.toLowerCase();

            return (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)', background: isSelf ? 'rgba(66, 133, 244, 0.02)' : 'transparent' }}>
                <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>
                  {user.isPending ? (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pending Sign-up</span>
                  ) : (
                    `${user.firstName} ${user.lastName}`
                  )}
                  {isSelf && <span style={{ fontSize: '0.8rem', background: 'var(--brand-blue)', color: 'white', padding: '2px 6px', borderRadius: '10px', marginLeft: '5px' }}>You</span>}
                </td>
                <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>{user.email}</td>
                <td style={{ padding: '15px' }}>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, user.email, e.target.value)}
                    disabled={isSelf || updateRoleMutation.isPending}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      background: '#ffffff',
                      color: '#000000',
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      cursor: isSelf ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="CONTENT_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Content Admin</option>
                    <option value="OPERATIONS_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Operations Admin</option>
                    <option value="SUPER_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Bookkeeping Admin</option>
                    <option value="SYSADMIN" style={{ color: '#000000', background: '#ffffff' }}>Sysadmin</option>
                  </select>
                </td>
                <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>
                  {user.isPending ? (
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', background: 'rgba(244, 180, 0, 0.15)', color: '#fbbc04' }}>
                      Pending
                    </span>
                  ) : (
                    new Date(user.createdAt).toLocaleDateString()
                  )}
                </td>
                <td style={{ padding: '15px' }}>
                  <button
                    onClick={() => handleRemoveClick(user)}
                    disabled={isSelf}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      background: 'rgba(234, 67, 53, 0.1)',
                      color: '#ea4335',
                      border: '1px solid rgba(234, 67, 53, 0.2)',
                      cursor: isSelf ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'opacity 0.2s',
                      opacity: isSelf ? 0.5 : 1,
                    }}
                  >
                    {user.isPending ? 'Cancel Invite' : 'Remove Admin'}
                  </button>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No administrators found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
