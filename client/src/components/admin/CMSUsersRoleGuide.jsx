import { motion } from 'framer-motion';

/**
 * CMSUsersRoleGuide — Panel showing the exact permissions and accesses for each admin role.
 *
 * Why? Provides administrators with a visual reference detailing privileges when
 * managing roles, and keeps files modular and strictly under the 250-line limit.
 * Why Framer Motion? Adds premium micro-interactions and smooth entry transitions.
 * Why high contrast? Satisfies strict WCAG accessibility rules to eliminate hidden/white text.
 */
export default function CMSUsersRoleGuide() {
  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.08
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  const guideCards = [
    {
      role: 'CONTENT_ADMIN',
      title: 'Content Admin',
      color: '#5f6368',
      access: [
        'Edit main website text content',
        'Manage and edit active projects'
      ]
    },
    {
      role: 'OPERATIONS_ADMIN',
      title: 'Operations Admin',
      color: '#1a73e8',
      access: [
        'Edit website content & projects',
        'Manage tiers & donation boxes',
        'Customize receipt settings',
        '❌ No access to transactions'
      ]
    },
    {
      role: 'SUPER_ADMIN',
      title: 'Super Admin',
      color: '#b06000', // High contrast yellow-brown for WCAG compliance
      access: [
        'All content & operations privileges',
        'View transactions & donor histories',
        '❌ No user management privileges'
      ]
    },
    {
      role: 'SYSADMIN',
      title: 'Sysadmin',
      color: '#d93025', // High contrast red
      access: [
        'Full administrative privileges',
        'Add, edit & demote administrators',
        'Complete control over backend config'
      ]
    }
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="glass"
      style={{
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '25px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-card)'
      }}
    >
      <h3 style={{
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--color-text-primary)',
        marginBottom: '15px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>🛡️</span> Admin Role Access & Permissions Guide
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        {guideCards.map((card) => (
          <motion.div
            key={card.role}
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }}
            style={{
              background: 'var(--color-bg-secondary)',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease'
            }}
          >
            <h4 style={{ color: card.color, fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>
              {card.title}
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '16px',
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.4',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {card.access.map((item, idx) => (
                <li key={idx} style={{
                  color: item.startsWith('❌') ? 'var(--brand-red)' : 'var(--color-text-secondary)'
                }}>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

