import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
    project: ['create', 'read', 'update', 'delete'],
    admin: ['access_admin_panel', 'manage_users', 'manage_organizations'],
} as const;

const ac = createAccessControl(statement);

const member = ac.newRole({
    project: ['create'],
});

const admin = ac.newRole({
    project: ['create', 'read', 'update', 'delete'],
});

const owner = ac.newRole({
    project: ['create', 'read', 'update', 'delete'],
});

const staff = ac.newRole({
    project: ['read'],
    admin: ['access_admin_panel']
});

export { ac, owner, admin, member, staff, statement };
