import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

const statement = {
    ...defaultStatements,
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete']
} as const;

const ac = createAccessControl(statement);
const owner = ac.newRole({
    ...adminAc.statements,
    ac: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'read'],
    organization: ['update', 'delete'],
    invitation: ['create', 'cancel'],
    recruitment: ['accept', 'reject', 'update', 'delete']
});

export { ac, owner, statement };
