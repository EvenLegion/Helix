import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
    project: ['create', 'read', 'update', 'delete'],
    admin: ['admin_dashboard', 'manage_users', 'manage_organizations'],
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete']
} as const;

const ac = createAccessControl(statement);
const owner = ac.newRole({
    ac: ['create', 'update', 'delete'],
    project: ['create', 'read', 'update', 'delete'],
    admin: ['admin_dashboard', 'manage_users', 'manage_organizations'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete']
});

export { ac, owner, statement };
