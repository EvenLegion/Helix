// Orchestrate a full database restore:
// 1) Import from a backup directory/stamp (or 'latest')
// 2) Reset all sequences to MAX(id)
// 3) Verify sequences and print final status
// Usage: pnpm --filter @workspace/db run db:restore [latest | YYYYMMDD-HHMMSS | path]
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runNodeScript(relPath, args = []) {
    const full = path.resolve(__dirname, relPath);
    return new Promise((resolve, reject) => {
        const cp = spawn(process.execPath, [full, ...args], {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '..'),
            env: process.env,
        });
        cp.on('error', reject);
        cp.on('exit', (code) => {
            if (code === 0) resolve(undefined); else reject(new Error(`${path.basename(relPath)} exited with code ${code}`));
        });
    });
}

async function main() {
    const backupArg = process.argv[2] || 'latest';
    console.log(`[Restore] Starting restore for backup: ${backupArg}`);

    // 1) Import
    console.log('[Restore] Step 1/3: Importing backup…');
    await runNodeScript('./import-all.js', [backupArg]);

    // 2) Reset sequences
    console.log('[Restore] Step 2/3: Resetting sequences to MAX(id)…');
    await runNodeScript('./reset-sequences.js', []);

    // 3) Verify
    console.log('[Restore] Step 3/3: Verifying sequences…');
    await runNodeScript('./verify-sequences.js', []);

    console.log('[Restore] Done.');
}

main().catch((err) => {
    console.error('[Restore] Failed:', err?.message || err);
    process.exit(1);
});
