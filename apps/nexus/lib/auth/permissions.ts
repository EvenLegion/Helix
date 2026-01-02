import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

const statement = {
    ...defaultStatements,
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete', 'apply'],
    admin: ['admin_dashboard', 'moderation']
} as const;

const ac = createAccessControl(statement);
const owner = ac.newRole({
    ...adminAc.statements,
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete', 'apply'],
    admin: ['admin_dashboard', 'moderation']
});

// Admin role for admin plugin - has all admin permissions including impersonate
const adminRole = ac.newRole({
    ...adminAc.statements,
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete', 'apply'],
    admin: ['admin_dashboard', 'moderation']
});

const moderator = ac.newRole({
    user: ['ban', 'list'],
});

const user = ac.newRole({
    recruitment: ['apply']
});

export { ac, owner, adminRole, user, moderator, statement };
