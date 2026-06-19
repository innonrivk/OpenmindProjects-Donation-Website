import { useState } from 'react';

/**
 * CMSUsersAddForm — Form component to pre-assign admin privileges to email addresses.
 *
 * Why? Separates the email pre-assignment form to maintain small, focused component files (under 250 lines).
 * Why black text? Satisfies the strict requirement to ensure input text is colored black for high contrast.
 *
 * @param {object} props
 * @param {(payload: { email: string, role: string }, successCb: () => void) => void} props.onInvite
 * @param {boolean} props.isPending
 * @param {string} props.currentAdminEmail
 * @returns {JSX.Element}
 */
export default function CMSUsersAddForm({ onInvite, isPending, currentAdminEmail }) {
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('CONTENT_ADMIN');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    if (emailInput.toLowerCase().trim() === currentAdminEmail?.toLowerCase().trim()) {
      alert('You cannot invite or add your own email.');
      return;
    }

    onInvite(
      {
        email: emailInput.toLowerCase().trim(),
        role: roleInput,
      },
      {
        onSuccess: () => {
          setEmailInput('');
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="glass" style={{ padding: '20px', borderRadius: '8px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--color-border)' }}>
      <div style={{ flex: '1 1 300px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Email Address</label>
        <input
          type="email"
          placeholder="enter-admin-email@domain.com"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '4px',
            background: '#ffffff',
            color: '#000000', // Strict requirement: make sure the text color is black
            border: '1px solid var(--color-border)',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}
        />
      </div>
      <div style={{ flex: '0 0 200px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Assigned Role</label>
        <select
          value={roleInput}
          onChange={(e) => setRoleInput(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '4px',
            background: '#ffffff',
            color: '#000000',
            border: '1px solid rgba(0, 0, 0, 0.15)',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          <option value="CONTENT_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Content Admin</option>
          <option value="OPERATIONS_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Operations Admin</option>
          <option value="SUPER_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Super Admin</option>
          <option value="SYSADMIN" style={{ color: '#000000', background: '#ffffff' }}>Sysadmin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="btn"
        style={{
          padding: '11px 24px',
          background: 'var(--brand-green)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '600',
          opacity: isPending ? 0.7 : 1
        }}
      >
        {isPending ? 'Adding...' : 'Add Administrator'}
      </button>
    </form>
  );
}
