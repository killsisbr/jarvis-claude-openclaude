import { spawn } from 'child_process';
import { promisify } from 'util';

export interface SandboxOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  input?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  error?: string;
}

/**
 * SandboxManager — Isolated command execution via Docker containers
 *
 * Each execution runs in a separate, ephemeral Docker container with:
 * - No network access (--network none)
 * - Memory limit (512MB)
 * - CPU limit (0.5 cores)
 * - Auto-cleanup after completion
 * - Configurable timeout (default 30s)
 */
export class SandboxManager {
  private readonly imageTag = 'jarvis-worker:latest'; // Use worker image
  private readonly limits = { memory: '512m', cpus: '0.5' };
  private readonly networkMode = 'none'; // No internet
  private readonly defaultTimeout = 30_000; // 30 seconds

  async exec(cmd: string, options: SandboxOptions = {}): Promise<SandboxResult> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const cwd = options.cwd ?? '/tmp';
    const env = options.env ?? {};

    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm', // Auto-cleanup
      `--memory=${this.limits.memory}`,
      `--cpus=${this.limits.cpus}`,
      `--network=${this.networkMode}`,
      `--workdir=${cwd}`,
      // Environment variables
      ...Object.entries(env).flatMap(([key, val]) => ['-e', `${key}=${val}`]),
      // Image and command
      this.imageTag,
      'sh',
      '-c',
      cmd,
    ];

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Spawn docker process
      const child = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Capture output
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Timeout handler
      const timer = setTimeout(() => {
        timedOut = true;
        // Kill the container
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // Already dead
          }
        }
      }, timeout);

      // Completion handler
      child.on('close', (code) => {
        clearTimeout(timer);

        const result: SandboxResult = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: timedOut ? null : code,
          timedOut,
          error: timedOut ? `Execution timeout after ${timeout}ms` : undefined,
        };

        resolve(result);
      });

      // Error handler
      child.on('error', (error) => {
        clearTimeout(timer);

        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: null,
          timedOut: false,
          error: `Failed to execute: ${error.message}`,
        });
      });

      // Send input if provided
      if (options.input) {
        child.stdin?.write(options.input);
      }
      child.stdin?.end();
    });
  }

  /**
   * Simple command execution (no Docker, local)
   * Use for testing or when Docker unavailable
   */
  async execLocal(cmd: string, options: SandboxOptions = {}): Promise<SandboxResult> {
    const timeout = options.timeout ?? this.defaultTimeout;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn('sh', ['-c', cmd], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // Already dead
          }
        }
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: timedOut ? null : code,
          timedOut,
          error: timedOut ? `Execution timeout after ${timeout}ms` : undefined,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);

        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: null,
          timedOut: false,
          error: `Failed to execute: ${error.message}`,
        });
      });

      if (options.input) {
        child.stdin?.write(options.input);
      }
      child.stdin?.end();
    });
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['version'], { stdio: 'pipe' });
      child.on('close', (code) => {
        resolve(code === 0);
      });
      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Build or pull sandbox image
   */
  async ensureImage(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['inspect', this.imageTag], {
        stdio: 'pipe',
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[sandbox] Image available: ${this.imageTag}`);
          resolve(true);
        } else {
          console.log(
            `[sandbox] Image not found: ${this.imageTag}. Will use during first exec.`
          );
          resolve(false); // Let it fail gracefully on exec
        }
      });
    });
  }

  getStats(): {
    imageTag: string;
    memoryLimit: string;
    cpuLimit: string;
    networkMode: string;
    defaultTimeout: number;
  } {
    return {
      imageTag: this.imageTag,
      memoryLimit: this.limits.memory,
      cpuLimit: this.limits.cpus,
      networkMode: this.networkMode,
      defaultTimeout: this.defaultTimeout,
    };
  }
}
