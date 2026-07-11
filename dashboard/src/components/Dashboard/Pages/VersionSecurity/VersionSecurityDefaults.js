import { Cpu, Server, ShieldCheck, Database, Terminal } from 'lucide-react';

export const INITIAL_SERVICES = [
  {
    id: 'go-dal',
    name: 'API Service (go-dal)',
    version: 'v1.2.4',
    latestVersion: 'v1.2.4',
    status: 'Running',
    port: '8080',
    icon: Cpu,
    type: 'Backend'
  },
  {
    id: 'mediamtx',
    name: 'RTSP Streamer (mediamtx)',
    version: 'v1.8.2',
    latestVersion: 'v1.8.2',
    status: 'Running',
    port: '8554',
    icon: Server,
    type: 'Streaming'
  },
  {
    id: 'nginx',
    name: 'Reverse Proxy (nginx)',
    version: 'v1.25.3',
    latestVersion: 'v1.25.3',
    status: 'Running',
    port: '80/443',
    icon: ShieldCheck,
    type: 'Security/Routing'
  },
  {
    id: 'mariadb',
    name: 'Database (mariadb)',
    version: 'v11.2.2',
    latestVersion: 'v11.2.2',
    status: 'Running',
    port: '3306',
    icon: Database,
    type: 'Database'
  },
  {
    id: 'dashboard',
    name: 'React Web UI',
    version: 'v1.0.0',
    latestVersion: 'v1.0.0',
    status: 'Running',
    port: '5173',
    icon: Terminal,
    type: 'Frontend'
  },
  {
    id: 'firmware',
    name: 'ESP32 Controller',
    version: 'v2.1.0-alpha',
    latestVersion: 'v2.1.0-stable',
    status: 'Update Available',
    port: 'Wireless (OTA)',
    icon: Cpu,
    type: 'Hardware Firmware'
  }
];

export const INITIAL_LOGS = [
  {
    id: 1,
    time: '2026-05-21 15:32:10',
    type: 'AUTH',
    message: 'User almuzky logged in successfully from 192.168.1.50',
    severity: 'INFO'
  },
  {
    id: 2,
    time: '2026-05-21 14:05:00',
    type: 'CONN',
    message: 'ESP32 controller handshake established (Encrypted AES-GCM)',
    severity: 'INFO'
  },
  {
    id: 3,
    time: '2026-05-21 12:00:00',
    type: 'SEC',
    message: 'SSL/TLS certificate auto-renewal check passed (Valid for 284 days)',
    severity: 'INFO'
  },
  {
    id: 4,
    time: '2026-05-21 10:15:32',
    type: 'SYS',
    message: 'Automatic configuration database backup created successfully',
    severity: 'INFO'
  },
  {
    id: 5,
    time: '2026-05-21 08:00:15',
    type: 'SCAN',
    message: 'Daily vulnerability scan passed (0 critical CVEs found)',
    severity: 'INFO'
  },
  {
    id: 6,
    time: '2026-05-21 07:30:12',
    type: 'SYS',
    message: 'ESP32 controller is running pre-release firmware v2.1.0-alpha',
    severity: 'WARNING'
  }
];
