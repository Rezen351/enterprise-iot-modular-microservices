import { useState, useRef, useEffect } from 'react';
import { Usb, UploadCloud, TerminalSquare, AlertTriangle, Network } from 'lucide-react';
import { ESPLoader, Transport } from 'esptool-js';

const WebSerialClient = () => {
  const [port, setPort] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  const [logs, setLogs] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);

  const [authPass, setAuthPass] = useState('');
  const [nodeId, setNodeId] = useState('node-01');
  const [ssid, setSsid] = useState('Wokwi-GUEST');
  const [wifiPass, setWifiPass] = useState('');
  const [mqttServer, setMqttServer] = useState('test.mosquitto.org');
  const [topicPrefix, setTopicPrefix] = useState('smartfarm');

  const [fwFile, setFwFile] = useState(null);
  const logEndRef = useRef(null);
  let readerRef = useRef(null);
  let writerRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      // Cleanup: cancel reader and close port when component unmounts
      if (readerRef.current) {
        readerRef.current.cancel().catch(e => console.error("Error cancelling reader:", e));
      }
      if (port) {
        port.close().catch(e => console.error("Error closing port:", e));
      }
    };
  }, [port]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, msg]);
  };

  const connectUSB = async () => {
    if (!('serial' in navigator)) {
      addLog('Error: WebSerial API not supported in this browser. Use Chrome/Edge.\n');
      return;
    }

    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      
      // Ensure normal run mode (DTR/RTS false)
      await selectedPort.setSignals({ dataTerminalReady: false, requestToSend: false });


      setPort(selectedPort);
      setStatus('Connected (Config Mode)');
      addLog('USB Port Opened Successfully at 115200 bps.');
      readLoop(selectedPort);
    } catch (err) {
      addLog(`Connection Error: ${err.message}`);
    }
  };

  const readLoop = async (currentPort) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = currentPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.trim() !== '') {
          // Add Arduino-style timestamp
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')} -> `;
          
          // Split by newline in case multiple lines arrive in one chunk
          const lines = value.trim().split('\n');
          for (let line of lines) {
            addLog(`${timeStr}${line.replace('\r', '')}`);
          }
        }
      }
    } catch (error) {
      addLog(`Read Error: ${error}`);
    } finally {
      reader.releaseLock();
    }
  };

  const disconnectUSB = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (port) {
        await port.close();
      }
    } catch (e) {
      addLog(`Disconnect Error: ${e.message}`);
    } finally {
      setPort(null);
      setStatus('Disconnected');
      addLog('USB Port Closed.');
    }
  };

  const syncConfig = async () => {
    if (!port) {
      addLog('Error: Please connect USB first.');
      return;
    }
    if (!authPass) {
      addLog('Error: Hardware Admin Password is required.');
      return;
    }

    setIsSyncing(true);
    const payload = {
      auth: { password: authPass },
      device: { node_id: nodeId, fw_version: "1.0.0", description: "SmartFarm Node" },
      protocols: {
        wifi: { ssid: ssid, password: wifiPass, auto_reconnect: true },
        mqtt: { server: mqttServer, port: 1883, topic_prefix: topicPrefix, telemetry_interval_ms: 5000 }
      }
    };

    const jsonString = JSON.stringify(payload) + '\n';
    addLog(`Sending config...`);

    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(jsonString);
      writer.releaseLock();
      addLog('Configuration sent! Waiting for device reboot...');
    } catch (e) {
      addLog(`Sync Error: ${e.message}`);
    }
    setIsSyncing(false);
  };

  const handleFlash = async () => {
    if (!fwFile) {
      addLog('Error: Select a firmware.bin file first.');
      return;
    }
    if (port) {
      addLog('Error: Please disconnect the serial monitor first to allow esptool to take over.');
      // A more robust implementation would close the port and pass it to esptool.
      // For simplicity in this hybrid tool, we ask user to refresh or we auto-close it.
      await readerRef.current?.cancel();
      await port.close();
      setPort(null);
    }

    setIsFlashing(true);
      addLog('Starting ESPTool Flasher...');

    try {
      const flashPort = await navigator.serial.requestPort();
      const transport = new Transport(flashPort, true);
      const term = {
        clean() { },
        writeLine(data) { addLog(`[esptool] ${data}`); }
      };

      const loader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal: term
      });

      await loader.main();
      addLog('ESP32 Chip connected and stub loaded.');

      const fileBuffer = await fwFile.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);

      await loader.writeFlash({
        fileArray: [{ data: fileData, address: 0x10000 }],
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          const pct = Math.round((written / total) * 100);
          setFlashProgress(pct);
        }
      });

      addLog('Flashing Complete! Resetting device...');
      await loader.hardReset();
      await transport.disconnect();
      setStatus('Flash Complete. Disconnected.');
    } catch (e) {
      addLog(`Flashing Error: ${e.message}`);
    }
    setIsFlashing(false);
    setFlashProgress(0);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20">
          <Usb className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-slate-100">WebSerial Tool</h1>
          <p className="text-slate-400">Hardware configuration & flashing via USB</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-7 space-y-6">

          {/* Connection Panel */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-emerald-500" />
                Connection Status
              </h2>
              <span className={`px-3 py-1 text-xs font-bold ${port ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                {status}
              </span>
            </div>
            
            {!port ? (
              <button 
                onClick={connectUSB}
                disabled={isFlashing}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect USB Device
              </button>
            ) : (
              <button 
                onClick={disconnectUSB}
                disabled={isFlashing}
                className="w-full h-12 bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Flash Panel */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <UploadCloud className="w-5 h-5 text-amber-500" />
              Firmware Flasher
            </h2>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 mb-4 flex gap-3 text-amber-400 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>Warning: Uploading firmware requires disconnecting the serial monitor first. The application will be written to memory offset 0x10000.</p>
            </div>

            <input
              type="file"
              accept=".bin"
              onChange={e => setFwFile(e.target.files[0])}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:file:border-0 file:text-sm file:font-semibold file:bg-amber-500/10 file:text-amber-500 hover:file:bg-amber-500/20 mb-4 cursor-pointer"
            />

            {flashProgress > 0 && (
              <div className="w-full bg-slate-800 h-2 mb-4">
                <div className="bg-amber-500 h-2 transition-all" style={{ width: `${flashProgress}%` }}></div>
              </div>
            )}

            <button
              onClick={handleFlash}
              disabled={isFlashing || !fwFile}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isFlashing ? `Flashing... ${flashProgress}%` : 'Upload Firmware (.bin)'}
            </button>
          </div>

        </div>

        {/* Right Column: Terminal Log */}
        <div className="lg:col-span-5 h-[600px] flex flex-col bg-slate-950 border border-slate-800 overflow-hidden">
          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Serial Output</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-emerald-400 leading-relaxed space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="break-words">{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>
          <div className="p-2 border-t border-slate-800 bg-slate-900">
             <button onClick={()=>setLogs([])} className="text-xs text-slate-500 hover:text-slate-300 w-full text-left px-2">Clear Logs</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSerialClient;
