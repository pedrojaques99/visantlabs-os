import { execSync } from 'child_process';

function stopServers() {
  try {
    const isWindows = process.platform === 'win32';
    const currentPid = process.pid;

    if (isWindows) {
      // Use powershell to list processes with their command lines
      const psCommand = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*server/index.ts*\' -and $_.Name -eq \'node.exe\' } | Select-Object -ExpandProperty ProcessId"';
      
      let pidsString = '';
      try {
        pidsString = execSync(psCommand).toString();
      } catch (e) {
        // No processes found or error
        return;
      }

      const pids = pidsString.split(/\s+/)
        .map(p => p.trim())
        .filter(p => /^\d+$/.test(p))
        .map(p => parseInt(p))
        .filter(pid => pid !== currentPid);

      if (pids.length === 0) {
        console.log('No active development servers found.');
        return;
      }

      pids.forEach(pid => {
        try {
          process.kill(pid, 'SIGKILL');
          console.log(`Successfully stopped server process: ${pid}`);
        } catch (e) {
          // Process might have already finished
        }
      });
    } else {
      // Unix-like systems (macOS/Linux)
      try {
        const pgrepCommand = "pgrep -f 'server/index.ts'";
        const pidsString = execSync(pgrepCommand).toString();
        const pids = pidsString.split('\n')
          .map(p => p.trim())
          .filter(p => /^\d+$/.test(p))
          .map(p => parseInt(p))
          .filter(pid => pid !== currentPid);

        pids.forEach(pid => {
          try {
            process.kill(pid, 'SIGKILL');
            console.log(`Successfully stopped server process: ${pid}`);
          } catch (e) {
            // Process might have already finished
          }
        });
      } catch (e) {
        // No processes found or pgrep not available
      }
    }
  } catch (error) {
    console.warn('Error while trying to stop servers:', error.message);
  }
}

stopServers();
process.exit(0);
