import { Activity, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import ModuleBadge from '../ModuleBadge';
import { useState, useEffect, useCallback, useRef } from 'react';

// Import subcomponents
import SystemStatus from './Monitoring/SystemStatus';
import EnvironmentalOverview from './Monitoring/EnvironmentalOverview';
import QuickActions from './Monitoring/QuickActions';
import PlantOverview from './Monitoring/PlantOverview';
import NutrientWaterStatus from './Monitoring/NutrientWaterStatus';
import SensorStatus from './Monitoring/SensorStatus';
import MistSchedule from './Monitoring/MistSchedule';
import IntakeSchedule from './Monitoring/IntakeSchedule';
import CoolingSchedule from './Monitoring/CoolingSchedule';
import ValveSchedule from './Monitoring/ValveSchedule';
import ReservoirStatus from './Monitoring/ReservoirStatus';
import AdditionalSensors from './Monitoring/AdditionalSensors';

function Monitoring({ selectedModule, setActiveTab }) {
  const wsRef = useRef(null);
  const lastToggled = useRef({});

  // Standardize module ID to string format (e.g. "module-01")
  const rawModuleId = selectedModule?._dbId || 1;
  const moduleId = typeof rawModuleId === 'number'
    ? `module-${String(rawModuleId).padStart(2, '0')}`
    : rawModuleId;

  // Global configurations state loaded from Node-RED settings
  const [settings, setSettings] = useState(null);
  const [autoMode, setAutoMode] = useState(true);
  const [systemPower, setSystemPower] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Individual actuator states (controlled via quick actions)
  const [isMistPumpOn, setMistPump] = useState(true);
  const [isInletPumpOn, setInletPump] = useState(true);
  const [isValveOn, setValve] = useState(false);
  const [isCoolingOn, setCooling] = useState(true);

  // Live telemetry data loaded dynamically via WebSocket
  const [liveData, setLiveData] = useState(null);
  const [timersData, setTimersData] = useState(null);
  const [systemHealth, setSystemHealth] = useState({ status: 'healthy', timestamp: new Date().toISOString() });

  // Synchronous module change tracking to reset telemetry/settings immediately
  const [prevModuleId, setPrevModuleId] = useState(null);
  const currentModuleId = selectedModule?._dbId || 1;
  if (currentModuleId !== prevModuleId) {
    setPrevModuleId(currentModuleId);
    setIsLoading(true);
    setSettings(null);
    setLiveData(null);
    setTimersData(null);
  }

  // Fetch settings from Node-RED API for the selected module
  const fetchSettings = useCallback(async () => {
    setLiveData(null); // Clear telemetry of the previous module to prevent stale data display
    setTimersData(null); // Clear timers when switching module
    setIsLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('token');
      const dbId = selectedModuleRef.current?._dbId || selectedModule?._dbId || 5;

      // Fetch parallel dari Go-DAL (configs dan database snapshot sensor terakhir)
      const [configsRes, snapshotRes] = await Promise.all([
        fetch(`/api/v1/iot/modules/${dbId}/configs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(err => ({ ok: false })),
        fetch(`/api/v1/iot/modules/${dbId}/live-snapshot`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(err => ({ ok: false }))
      ]);

      if (configsRes && configsRes.ok) {
        const configs = await configsRes.json();
        const matched = Array.isArray(configs) ? configs.find(c => c.config_key === "full_system_settings") : null;
        if (matched && matched.config_value) {
          const data = matched.config_value;
          setSettings(data);

          // Hydrate state
          if (data.auto_mode !== undefined) setAutoMode(data.auto_mode);
          else if (data.autoMode !== undefined) setAutoMode(data.autoMode);

          if (data.system_power !== undefined) setSystemPower(data.system_power);
          else if (data.systemPower !== undefined) setSystemPower(data.systemPower);

          if (data.actuators) {
            if (Array.isArray(data.actuators)) {
              const mistAct = data.actuators.find(a => a.key === 'mist_pump' || a.key === 'misting_pump');
              const inletAct = data.actuators.find(a => a.key === 'inlet_pump' || a.key === 'intake_pump');
              const valveAct = data.actuators.find(a => a.key === 'valve' || a.key === 'solenoid_valve');
              const coolingAct = data.actuators.find(a => a.key === 'cooling' || a.key === 'cooling_system');

              if (mistAct) setMistPump(mistAct.is_active);
              if (inletAct) setInletPump(inletAct.is_active);
              if (valveAct) setValve(valveAct.is_active);
              if (coolingAct) setCooling(coolingAct.is_active);
            } else {
              setMistPump(data.actuators.misting_pump?.isActive ?? true);
              setInletPump(data.actuators.intake_pump?.isActive ?? true);
              setValve(data.actuators.solenoid_valve?.isActive ?? false);
              setCooling(data.actuators.cooling_system?.isActive ?? true);
            }
          }
        }
      }

      if (snapshotRes && snapshotRes.ok) {
        const snapshot = await snapshotRes.json();
        // Convert snapshot database ke format liveData UI
        const sensorsConverted = {};
        if (snapshot && snapshot.nodes) {
          snapshot.nodes.forEach(node => {
            if (node.sensors) {
              node.sensors.forEach(s => {
                sensorsConverted[s.name] = {
                  id: s.id,
                  value: s.value
                };
              });
            }
          });
        }
        setLiveData(prev => ({
          ...prev,
          sensors: {
            ...prev?.sensors,
            ...sensorsConverted
          }
        }));
      }
    } catch (err) {
      console.warn("Monitoring: Failed to fetch module-specific settings or live snapshot", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedModule, moduleId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const selectedModuleRef = useRef(selectedModule);

  useEffect(() => {
    selectedModuleRef.current = selectedModule;
  }, [selectedModule]);

  // Real-time WebSocket connection to Node-RED telemetry streams
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const token = sessionStorage.getItem('token') || '';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/system-status?token=${token}`;

    let socket = null;
    let reconnectTimer = null;

    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("Monitoring: Connected to System Status WebSocket");
        wsRef.current = socket;
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const msgType = parsed.type || parsed.event;
          
          const currentSelected = selectedModuleRef.current;
          const rawId = currentSelected?.id || 1;
          const currentModuleId = typeof rawId === 'number'
            ? `module-${String(rawId).padStart(2, '0')}`
            : rawId;

          console.log("WS Message received:", { msgType, parsed, currentModuleId, currentSelected });
          // 1. Handle System Health Updates
          if (msgType === "system_health") {
            const data = parsed.data || {};
            setSystemHealth({
              status: data.status,
              timestamp: data.timestamp,
              system: data.system || "Aeroponic System",
              message: data.message
            });
            return;
          }

          // Handle Misting Timer Updates from WebSocket
          if (msgType === "misting_timer_update") {
            const incomingData = parsed.data || {};
            const targetKey = Object.keys(incomingData).find(key => {
              return key === currentSelected?.name || key === `Module Aeroponik ${rawId}` || incomingData[key]?.id === rawId;
            });
            if (targetKey) {
              setTimersData(prev => ({
                ...prev,
                misting: incomingData[targetKey]?.misting
              }));
            }
            return;
          }

          // Handle Intake Timer Updates from WebSocket
          if (msgType === "intake_timer_update") {
            const incomingData = parsed.data || {};
            const targetKey = Object.keys(incomingData).find(key => {
              return key === currentSelected?.name || key === `Module Aeroponik ${rawId}` || incomingData[key]?.id === rawId;
            });
            if (targetKey) {
              setTimersData(prev => ({
                ...prev,
                intake: incomingData[targetKey]?.intake
              }));
            }
            return;
          }

          // Handle Valve Timer Updates from WebSocket
          if (msgType === "valve_timer_update") {
            const incomingData = parsed.data || {};
            const targetKey = Object.keys(incomingData).find(key => {
              return key === currentSelected?.name || key === `Module Aeroponik ${rawId}` || incomingData[key]?.id === rawId;
            });
            if (targetKey) {
              setTimersData(prev => ({
                ...prev,
                valve: incomingData[targetKey]?.valve
              }));
            }
            return;
          }

          // Handle Cooling Timer Updates from WebSocket
          if (msgType === "cooling_timer_update") {
            const incomingData = parsed.data || {};
            const targetKey = Object.keys(incomingData).find(key => {
              return key === currentSelected?.name || key === `Module Aeroponik ${rawId}` || incomingData[key]?.id === rawId;
            });
            if (targetKey) {
              setTimersData(prev => ({
                ...prev,
                cooling: incomingData[targetKey]?.cooling
              }));
            }
            return;
          }

          // 2. Handle Telemetry Updates
          if (msgType === "telemetry_update") {
            // Support moduleId langsung ATAU dari box_info.id (format Node-RED lama)
            const incomingId = parsed.module?.id;

            // Cocokkan ID dalam berbagai format: number, string angka, atau "module-01"
            const idMatch =
              incomingId === rawId ||
              incomingId === currentModuleId ||
              String(incomingId) === String(rawId) ||
              (currentSelected && String(incomingId) === String(currentSelected._dbId));

            if (!idMatch) return;

            // Support key "telemetry" (format baru) ATAU "data" (format Node-RED lama)
            const telemetry = parsed.telemetry || parsed.data;
            if (telemetry) {
              setLiveData(telemetry);
            }

            // Update configurations & actuator states
            if (parsed.settings) {
              setSettings(parsed.settings);

              const now = Date.now();

              if (parsed.settings.autoMode !== undefined) {
                if (!lastToggled.current.autoMode || now - lastToggled.current.autoMode > 2000) {
                  setAutoMode(parsed.settings.autoMode);
                }
              }
              if (parsed.settings.systemPower !== undefined) {
                if (!lastToggled.current.systemPower || now - lastToggled.current.systemPower > 2000) {
                  setSystemPower(parsed.settings.systemPower);
                }
              }
              if (parsed.settings.actuators) {
                if (!lastToggled.current.misting_pump || now - lastToggled.current.misting_pump > 2000) {
                  setMistPump(parsed.settings.actuators.misting_pump?.isActive ?? true);
                }
                if (!lastToggled.current.intake_pump || now - lastToggled.current.intake_pump > 2000) {
                  setInletPump(parsed.settings.actuators.intake_pump?.isActive ?? true);
                }
                if (!lastToggled.current.solenoid_valve || now - lastToggled.current.solenoid_valve > 2000) {
                  setValve(parsed.settings.actuators.solenoid_valve?.isActive ?? false);
                }
                if (!lastToggled.current.cooling_system || now - lastToggled.current.cooling_system > 2000) {
                  setCooling(parsed.settings.actuators.cooling_system?.isActive ?? true);
                }
              }
            }
          }
        } catch (err) {
          console.warn("Monitoring: Failed to parse WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        console.warn("Monitoring: WebSocket disconnected. Reconnecting...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        socket.close();
      };
    }

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Handle saving configurations when QuickActions are toggled
  const saveActuatorState = async (updatedActuators, newAutoMode = autoMode, newSystemPower = systemPower) => {
    if (!settings) return;
    try {
      const token = sessionStorage.getItem('token');
      const dbId = selectedModuleRef.current?._dbId || selectedModule?._dbId || 5;

      let newActuatorsConfig = [];
      if (Array.isArray(settings.actuators)) {
        newActuatorsConfig = settings.actuators.map(act => {
          if (updatedActuators[act.key] !== undefined) {
            const updated = updatedActuators[act.key];
            return {
              ...act,
              is_active: typeof updated === 'object' ? updated.isActive : updated
            };
          }
          const legacyMap = {
            misting_pump: 'mist_pump',
            intake_pump: 'intake_pump',
            solenoid_valve: 'solenoid_valve',
            cooling_system: 'cooling_system'
          };
          const legKey = legacyMap[act.key];
          if (legKey && updatedActuators[legKey] !== undefined) {
            const updated = updatedActuators[legKey];
            return {
              ...act,
              is_active: typeof updated === 'object' ? updated.isActive : updated
            };
          }
          return act;
        });
      } else {
        newActuatorsConfig = {
          ...settings.actuators,
          ...updatedActuators
        };
      }

      const payload = {
        config_key: "full_system_settings",
        config_value: {
          ...settings,
          auto_mode: newAutoMode,
          system_power: newSystemPower,
          actuators: newActuatorsConfig
        },
        description: "Quick Action save via Go-DAL"
      };

      const response = await fetch(`/api/v1/iot/modules/${dbId}/configs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
    } catch (err) {
      console.warn("Monitoring: Failed to sync quick action update to Go-DAL", err);
    }
  };
  // Fungsi pembantu kirim perintah via WebSocket
  const sendWsControl = (actuatorName, state) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: "actuator_control",
        moduleId: moduleId,
        actuator: actuatorName,
        state: state
      };
      wsRef.current.send(JSON.stringify(payload));
      console.log(`Sent WS control: ${actuatorName} -> ${state}`);
    } else {
      console.warn("WebSocket not connected. Falling back to HTTP sync.");
      // Fallback jika WS mati (opsional, bisa panggil saveActuatorState HTTP)
    }
  };
  // Helper toggle wrappers
  const handleToggleMist = (state) => {
    setMistPump(state);
    lastToggled.current.misting_pump = Date.now();
    saveActuatorState({ misting_pump: { ...settings?.actuators?.misting_pump, isActive: state } });
    sendWsControl("misting_pump", state);
  };
  const handleToggleInlet = (state) => {
    setInletPump(state);
    lastToggled.current.intake_pump = Date.now();
    saveActuatorState({ intake_pump: { ...settings?.actuators?.intake_pump, isActive: state } });
    sendWsControl("inlet_pump", state);
  };
  const handleToggleValve = (state) => {
    setValve(state);
    lastToggled.current.solenoid_valve = Date.now();
    saveActuatorState({ solenoid_valve: { ...settings?.actuators?.solenoid_valve, isActive: state } });
    sendWsControl("solenoid_valve", state);
  };
  const handleToggleCooling = (state) => {
    setCooling(state);
    lastToggled.current.cooling_system = Date.now();
    saveActuatorState({ cooling_system: { ...settings?.actuators?.cooling_system, isActive: state } });
    sendWsControl("cooling_system", state);
  };
  const handleToggleAutoMode = (state) => {
    setAutoMode(state);
    lastToggled.current.autoMode = Date.now();
    saveActuatorState({}, state, systemPower);
    sendWsControl("automode", state);
  };
  const handleToggleSystemPower = (state) => {
    setSystemPower(state);
    lastToggled.current.systemPower = Date.now();
    saveActuatorState({}, autoMode, state);
    sendWsControl("system_power", state);
  };



  // Derive real-time actuator states from WebSocket telemetry data if available
  const telemetryMistPump = liveData?.actuators?.misting_pump?.state === 'ON' || liveData?.actuators?.misting_pump?.isActive === true;
  const telemetryInletPump = liveData?.actuators?.intake_pump?.state === 'ON' || liveData?.actuators?.intake_pump?.isActive === true;
  const telemetryValve = liveData?.actuators?.solenoid_valve?.state === 'ON' || liveData?.actuators?.solenoid_valve?.isActive === true;
  const telemetryCooling = liveData?.actuators?.cooling_system?.state === 'ON' || liveData?.actuators?.cooling_system?.isActive === true;

  const currentMistPump = systemPower ? (
    autoMode && timersData?.misting ? (timersData.misting.state === 'ON') : (liveData?.actuators ? telemetryMistPump : isMistPumpOn)
  ) : false;
  const currentInletPump = systemPower ? (
    autoMode && timersData?.intake ? (timersData.intake.state === 'ON') : (liveData?.actuators ? telemetryInletPump : isInletPumpOn)
  ) : false;
  const currentValve = systemPower ? (
    autoMode && timersData?.valve ? (timersData.valve.state === 'ON') : (liveData?.actuators ? telemetryValve : isValveOn)
  ) : false;
  const currentCooling = systemPower ? (
    autoMode && timersData?.cooling ? (timersData.cooling.state === 'ON') : (liveData?.actuators ? telemetryCooling : isCoolingOn)
  ) : false;

  const activeModuleData = {
    ...liveData,
    isMistPumpOn: currentMistPump,
    isInletPumpOn: currentInletPump,
    isValveOn: currentValve,
    isCoolingOn: currentCooling,
    isLaserLeftOn: systemPower ? (
      liveData?.sensors?.laser_1?.value === 1 ||
      liveData?.sensors?.laser_1?.value === true ||
      liveData?.sensors?.laser_1?.value === 'ON' ||
      liveData?.sensors?.laser_1?.value === 'on'
    ) : false,
    isLaserRightOn: systemPower ? (
      liveData?.sensors?.laser_2?.value === 1 ||
      liveData?.sensors?.laser_2?.value === true ||
      liveData?.sensors?.laser_2?.value === 'ON' ||
      liveData?.sensors?.laser_2?.value === 'on'
    ) : false
  };

  console.log('activeModuleData:', activeModuleData);

  // Loading screen while fetching initial settings
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] w-full gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-emerald-500/10 animate-pulse"></div>
          <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-teal-500 animate-spin"></div>
        </div>
        <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase animate-pulse">
          Loading Monitoring Data...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-4 w-full animate-fadeIn">
      {/* 1. Header Area */}
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full">
          <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Activity className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">
              Monitoring
            </h2>
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
              Real-time telemetry streams, crop health indicators, and remote systems automation.
            </p>
            <ModuleBadge selectedModule={selectedModule} className="mt-3" />
          </div>
        </div>
      </div>

      {/* 2. Primary Layout Grid */}
      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Row 1: System Status, Environmental Overview, Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-[0.6fr_1.6fr_0.8fr] gap-3 sm:gap-4">
          <div className="w-full flex flex-col gap-3 sm:gap-4 order-2 xl:order-1">
            <SystemStatus
              isMistPumpOn={currentMistPump}
              isInletPumpOn={currentInletPump}
              isValveOn={currentValve}
              systemPower={systemPower}
              systemHealth={systemHealth}
            />
            <PlantOverview selectedModule={selectedModule} setActiveTab={setActiveTab} />
          </div>
          <div className="w-full order-1 xl:order-2">
            <EnvironmentalOverview
              selectedModule={selectedModule}
              activeModuleData={activeModuleData}
              systemHealth={systemHealth}
            />
          </div>
          <div className="w-full order-3 xl:order-3">
            <QuickActions 
              isMistPumpOn={isMistPumpOn} setMistPump={handleToggleMist}
              isInletPumpOn={isInletPumpOn} setInletPump={handleToggleInlet}
              isValveOn={isValveOn} setValve={handleToggleValve}
              isCoolingOn={isCoolingOn} setCooling={handleToggleCooling}
              autoMode={autoMode} setAutoMode={handleToggleAutoMode}
              systemPower={systemPower} setSystemPower={handleToggleSystemPower}
              setActiveTab={setActiveTab}
            />
          </div>
        </div>

        {/* Row 2: Nutrient and Water Status, Sensor Status */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          <div className="w-full">
            <NutrientWaterStatus activeModuleData={activeModuleData} alertsConfig={settings?.alerts} />
          </div>
          <div className="w-full">
            <SensorStatus activeModuleData={activeModuleData} />
          </div>
        </div>

        {/* Dynamic Row: Auto-detected Additional Sensors */}
        <AdditionalSensors activeModuleData={activeModuleData} />

        {/* Row 3: Timers and Schedules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
          <MistSchedule mistingSchedule={settings?.intervalSchedules?.misting_pump || settings?.mistingSchedule} liveTimer={timersData?.misting} />
          <IntakeSchedule intakeSchedule={settings?.intervalSchedules?.intake_pump || settings?.intakeSchedule} liveTimer={timersData?.intake} />
          <ValveSchedule otherSchedules={settings?.otherSchedules} liveTimer={timersData?.valve} />
          <CoolingSchedule coolingSettings={settings?.coolingSettings} liveTimer={timersData?.cooling} activeModuleData={activeModuleData} />
          <ReservoirStatus activeModuleData={activeModuleData} />
        </div>
      </div>
    </div>
  );
}

export default Monitoring;
