/**
 * Role-based access control middleware.
 * Must be used after requireAuth.
 */

const ROLE_HIERARCHY = { superuser: 3, manager: 2, rep: 1 };

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] || 0));

    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = requireRole;
