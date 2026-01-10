-- DropIndex
DROP INDEX "nexus"."recruitment_application_userId_status_key";

CREATE UNIQUE INDEX "unique_user_org_pending_or_accepted"
ON "nexus"."recruitment_application" ("userId", "organizationId", "status")
WHERE status IN ('pending', 'accepted');
