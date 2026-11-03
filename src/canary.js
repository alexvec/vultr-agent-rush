import net from 'node:net';

export const CANARY_NOTE = 'Weak evidence. Zero hits means nothing connected to this one address. It does not prove nothing left the sandbox, and a hit may come from another run or process on the host.';
const MAX_KEPT_HITS = 200;

/**
 * A host-side TCP listener that counts connections and reads nothing from them. It runs
 * in the backend, outside every container, and changes no sandbox flag: the containers
 * still have no network. A sandbox run can only hit it if the network wall has failed.
 */
export class CanaryListener {
  constructor({ bindHost = '127.0.0.1', port = 0, targetHost = 'host.docker.internal', log = () => {} } = {}) {
    this.bindHost = bindHost;
    this.port = port;
    this.targetHost = targetHost;
    this.log = log;
    this.count = 0;
    this.hits = [];
    this.server = null;
  }

  get listening() {
    return Boolean(this.server?.listening);
  }

  /** Never throws: if the bind fails, the app still runs and the record says "not measured". */
  start() {
    return new Promise((resolve) => {
      const server = net.createServer((socket) => {
        this.count += 1;
        if (this.hits.length < MAX_KEPT_HITS) {
          this.hits.push({ at: new Date().toISOString(), remote_address: socket.remoteAddress ?? 'unknown' });
        }
        socket.on('error', () => {});
        socket.destroy();
      });
      server.once('error', (err) => {
        this.log('canary_listener_failed', { error: err.message });
        this.server = null;
        resolve(false);
      });
      server.listen(this.port, this.bindHost, () => {
        this.server = server;
        this.port = server.address().port;
        server.unref();
        resolve(true);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) { resolve(); return; }
      const { server } = this;
      this.server = null;
      server.close(() => resolve());
    });
  }

  /** The address a container would have to reach. Null when the listener is not running. */
  target() {
    return this.listening ? { host: this.targetHost, port: this.port } : null;
  }

  /** Read on the host. `since` is the count taken when the run began. */
  report(since = null) {
    if (!this.listening) {
      return { listening: false, hits_during_run: 'not measured', hits_since_listener_start: 'not measured', evidence_strength: 'none: the listener was not running', note: CANARY_NOTE };
    }
    return {
      listening: true,
      bound_to: `${this.bindHost}:${this.port}`,
      target_from_a_container: `${this.targetHost}:${this.port}`,
      read_from: 'host side: the backend process counts connections to its own listener',
      hits_during_run: since === null ? 'not measured' : this.count - since,
      hits_since_listener_start: this.count,
      recent_hits: this.hits.slice(-20),
      evidence_strength: 'weak',
      note: CANARY_NOTE,
    };
  }
}
