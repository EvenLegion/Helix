import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
    project: ['create', 'read', 'update', 'delete'],
    admin: ['admin_dashboard', 'manage_users', 'manage_organizations' ],
    ac: ['create', 'update', 'delete'],
} as const;

const ac = createAccessControl(statement);
const owner = ac.newRole({
    ac: ['create', 'update', 'delete'],
    project: ['create', 'read', 'update', 'delete'],
    admin: ['admin_dashboard', 'manage_users', 'manage_organizations'],
});

export { ac, owner, statement };
