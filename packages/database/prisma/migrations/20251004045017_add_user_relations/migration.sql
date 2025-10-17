-- AddForeignKey
ALTER TABLE "arbiter"."eventSessionParticipant" ADD CONSTRAINT "eventSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."divisionMembership" ADD CONSTRAINT "divisionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
