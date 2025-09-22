# Runs prisma migrate dev and prisma generate in order, with retry for generate on EPERM issues.
param(
  [string]$Name = "schema_change"
)

$ErrorActionPreference = 'Stop'

pnpx prisma migrate dev --name $Name

# Retry generate up to 3 times if EPERM occurs (OneDrive can lock dll briefly)
for ($i = 1; $i -le 3; $i++) {
  try {
    pnpx prisma generate
    break
  } catch {
    if ($i -eq 3) { throw }
    Start-Sleep -Seconds 2
  }
}
