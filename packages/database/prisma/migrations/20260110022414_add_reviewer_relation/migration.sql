-- AddForeignKey
ALTER TABLE "nexus"."recruitment_application" ADD CONSTRAINT "recruitment_application_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "nexus"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
