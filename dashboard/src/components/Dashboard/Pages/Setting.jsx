import { useState, useEffect } from 'react';
import { SlidersHorizontal, ShieldAlert, Sliders, Loader2, AlertTriangle, Sprout } from 'lucide-react';
import SettingsHeader from './Settings/SettingsHeader';
import ActuatorSettings from './Settings/ActuatorSettings';
import ScheduleSettings from './Settings/ScheduleSettings';
import AlertSettings from './Settings/AlertSettings';
import CalibrationSettings from './Settings/CalibrationSettings';
import DatabaseOperations from './Settings/DatabaseOperations';
import CropSettings from './Settings/CropSettings';

function Setting({ selectedModule }) {
  // Fallback default templates
  const defaultAlerts = {
    cwt_luar_temp:   { name: 'Air Temp Outdoor',  min: 18.0, max: 35.0, unit: '°C', severity: 'warning', isActive: true, channelUi: true, channelEmail: false, channelTelegram: false },
    cwt_dalam_temp:  { name: 'Air Temp Indoor',   min: 18.0, max: 28.0, unit: '°C', severity: 'warning', isActive: true, channelUi: true, channelEmail: true,  channelTelegram: false },
    npk_temp_air:    { name: 'Water Temperature', min: 15.0, max: 22.0, unit: '°C', severity: 'warning', isActive: true, channelUi: true, channelEmail: false, channelTelegram: false },
    cwt_luar_hum:    { name: 'Humidity Outdoor',  min: 50.0, max: 95.0, unit: '%',  severity: 'warning', isActive: true, channelUi: true, channelEmail: false, channelTelegram: false },
    cwt_dalam_hum:   { name: 'Humidity Indoor',   min: 70.0, max: 90.0, unit: '%',  severity: 'warning', isActive: true, channelUi: true, channelEmail: false, channelTelegram: false },
    npk_ph:          { name: 'pH Level',          min: 5.5,  max: 6.5,  unit: 'pH', severity: 'critical', isActive: true, channelUi: true, channelEmail: true,  channelTelegram: true },
    npk_ec:          { name: 'EC Level',          min: 1.0,  max: 2.0,  unit: 'mS/cm', severity: 'critical', isActive: true, channelUi: true, channelEmail: true,  channelTelegram: true },
    reservoir_status:{ name: 'Reservoir Level', severity: 'warning', isActive: true, channelUi: true, channelEmail: false, channelTelegram: false, isBoolean: true }
  };

  const defaultCalibrations = {
    cwt_luar_temp:   { name: 'Air Temp Outdoor Sensor', method: 'offset', offset: 0.0, formula: 'x', rawValue: 24.5 },
    cwt_dalam_temp:  { name: 'Air Temp Indoor Sensor',  method: 'offset', offset: -0.4, formula: 'x - 0.4', rawValue: 24.5 },
    npk_temp_air:    { name: 'Water Temp Sensor',        method: 'offset', offset: 0.0, formula: 'x', rawValue: 20.1 },
    cwt_luar_hum:    { name: 'Humidity Outdoor Sensor',  method: 'offset', offset: 0.0, formula: 'x', rawValue: 78.0 },
    cwt_dalam_hum:   { name: 'Humidity Indoor Sensor',   method: 'offset', offset: 1.2, formula: 'x + 1.2', rawValue: 78.0 },
    npk_ph:          { name: 'pH Level Sensor',          method: 'formula', offset: 0.15, formula: 'x * 1.02 - 0.05', rawValue: 5.8 },
    npk_ec:          { name: 'EC Level Sensor',          method: 'formula', offset: -0.05, formula: 'x * 0.98 + 0.01', rawValue: 1.45 }
  };

  // Global Save & Auto States
  const [autoMode, setAutoMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Loading & Connection States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab State for HMI Touch Screen Optimization
  const [activeTab, setActiveTab] = useState('automation'); // 'automation' | 'alerts' | 'system'

  // Dynamic configuration states
  const [actuatorsList, setActuatorsList] = useState([]);
  const [availableActuators, setAvailableActuators] = useState([]);
  const [availableSensors, setAvailableSensors] = useState([]);

  // Stored secondary states (alert limits, calibrations)
  const [alerts, setAlerts] = useState([]);
  const [calibrations, setCalibrations] = useState([]);

  // Synchronous module change handler to prevent flashing stale data
  const [prevModuleId, setPrevModuleId] = useState(null);
  const currentModuleId = selectedModule?._dbId || 5;
  if (currentModuleId !== prevModuleId) {
    setPrevModuleId(currentModuleId);
    setIsLoading(true);
    setError(null);
    setActuatorsList([]);
    setAvailableActuators([]);
    setAvailableSensors([]);
  }

  // Local helper states for test calculator in calibration
  const [activeCalibTest, setActiveCalibTest] = useState('npk_ph');
  const [testRawInput, setTestRawInput] = useState('5.8');
  const [testResult, setTestResult] = useState('');

  // Hydration helpers
  const hydrateFromConfig = (configValue) => {
    setAutoMode(configValue.auto_mode ?? true);
    setActuatorsList(configValue.actuators || []);
    if (configValue.alerts && !Array.isArray(configValue.alerts)) {
      setAlerts([]);
    } else {
      setAlerts(configValue.alerts || []);
    }
    if (configValue.calibrations && !Array.isArray(configValue.calibrations)) {
      setCalibrations([]);
    } else {
      setCalibrations(configValue.calibrations || []);
    }
  };

  const initializeDefaults = (dbActuators) => {
    setAutoMode(true);
    setAlerts([]);
    setCalibrations([]);
    setActuatorsList([]);
  };

  // Fetch settings from Go-DAL API
  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('token');
      const moduleId = selectedModule?._dbId || 5;

      // 1. Fetch assigned database actuators
      const nodesRes = await fetch(`/api/v1/iot/modules/${moduleId}/nodes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!nodesRes.ok) {
        throw new Error(`Failed to fetch module nodes: status ${nodesRes.status}`);
      }
      const nodesData = await nodesRes.json();
      const dbActuators = [];
      const dbSensors = [];
      if (Array.isArray(nodesData)) {
        nodesData.forEach(node => {
          if (Array.isArray(node.actuators)) {
            node.actuators.forEach(act => {
              dbActuators.push({
                db_id: act.id,
                name: act.name || 'Unnamed',
                pin: act.pin_mapping || 'GPIO ?',
                type: act.type?.name || 'Unknown'
              });
            });
          }
          if (Array.isArray(node.sensors)) {
            node.sensors.forEach(sens => {
              if (sens.id) {
                dbSensors.push({
                  db_id: sens.id,
                  name: sens.name || 'Unnamed',
                  pin: sens.pin_mapping || 'GPIO ?',
                  type: sens.type?.name || 'Unknown'
                });
              }
            });
          }
        });
      }
      setAvailableActuators(dbActuators);
      setAvailableSensors(dbSensors);

      // 2. Fetch configurations from Go-DAL
      const configsRes = await fetch(`/api/v1/iot/modules/${moduleId}/configs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!configsRes.ok) {
        throw new Error(`Failed to fetch configurations: status ${configsRes.status}`);
      }
      const configsData = await configsRes.json();

      let matchedConfig = null;
      if (Array.isArray(configsData)) {
        matchedConfig = configsData.find(c => c.config_key === "full_system_settings");
      }

      if (matchedConfig && matchedConfig.config_value) {
        hydrateFromConfig(matchedConfig.config_value);
      } else {
        initializeDefaults(dbActuators);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Error loading settings:", err);
      setError(err.message || 'Failed to fetch settings from Go-DAL');
      setIsLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm("Apakah Anda yakin ingin menyetel ulang semua pengaturan ke default?")) {
      initializeDefaults(availableActuators);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [selectedModule]);

  // Handle saving configurations to Go-DAL API
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const payload = {
        config_key: "full_system_settings",
        config_value: {
          auto_mode: autoMode,
          actuators: actuatorsList,
          alerts,
          calibrations
        },
        description: "Full system settings config directly via Go-DAL"
      };

      const token = sessionStorage.getItem('token');
      const moduleId = selectedModule?._dbId || 5;
      const response = await fetch(`/api/v1/iot/modules/${moduleId}/configs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Error saving settings:", err);
      setSaveError(err.message || 'Failed to save settings to Go-DAL backend');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle single actuator manual control
  const toggleActuator = (key) => {
    setActuatorsList(prev => prev.map(act => {
      if (act.key === key) {
        return { ...act, is_active: !act.is_active };
      }
      return act;
    }));
  };

  // Run test calibration calculation
  const handleRunCalibrationTest = (keyOrIndex) => {
    const sensor = Array.isArray(calibrations)
      ? calibrations.find(c => c.key === keyOrIndex)
      : calibrations[keyOrIndex];
    if (!sensor) return;
    const rawVal = parseFloat(testRawInput);
    if (isNaN(rawVal)) {
      setTestResult('Invalid raw value');
      return;
    }

    if (sensor.method === 'offset') {
      const val = rawVal + sensor.offset;
      setTestResult(`${val.toFixed(2)} (using offset ${sensor.offset > 0 ? '+' : ''}${sensor.offset})`);
    } else {
      try {
        const sanitizedFormula = sensor.formula.toLowerCase().replace(/x/g, rawVal.toString());
        const calculated = Function(`"use strict"; return (${sanitizedFormula})`)();
        if (typeof calculated === 'number' && !isNaN(calculated)) {
          setTestResult(`${calculated.toFixed(2)} (using formula: ${sensor.formula})`);
        } else {
          setTestResult('Calculation error');
        }
      } catch (err) {
        setTestResult(`Error in formula syntax: ${err.message}`);
      }
    }
  };

  // Loading UI Screen (optimized for HMI tablet visibility)
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh] gap-4 sm:gap-6 w-full border border-emerald-500/10 bg-[#030705]/80 backdrop-blur-md p-4 sm:p-8">
        <Loader2 className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-400 animate-spin" />
        <div className="text-center">
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">Loading...</h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-medium">Fetching from Node-RED...</p>
        </div>
      </div>
    );
  }

  // Error UI Screen (optimized for HMI tablet visibility, touch targets >= 48px)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh] gap-4 sm:gap-6 w-full border border-red-500/20 bg-[#0c0404]/80 backdrop-blur-md p-4 sm:p-8">
        <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-10 h-10 sm:w-14 sm:h-14" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">Connection Error</h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-medium">
            Could not reach Node-RED. Check server and network.
          </p>
          <div className="mt-3 px-3 py-2 bg-red-950/20 border border-red-500/10 text-[10px] sm:text-xs font-mono break-all">
            Error: {error}
          </div>
        </div>
        <button
          onClick={fetchSettings}
          className="flex items-center justify-center gap-2 h-12 sm:h-16 px-6 sm:px-10 text-sm sm:text-base font-black text-black bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 border border-red-500/20 hover:scale-[1.02] active:scale-[0.97] transition-all cursor-pointer select-none"
        >
          RETRY CONNECTION
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 text-slate-200">
      <SettingsHeader 
        autoMode={autoMode}
        setAutoMode={setAutoMode}
        isSaving={isSaving}
        handleSave={handleSave}
        saveSuccess={saveSuccess}
        selectedModule={selectedModule}
        handleReset={handleResetToDefaults}
      />

      {/* Save Error Alert Notification Toast */}
      {saveError && (
        <div className="border border-red-500/30 bg-[#160404] text-red-400 p-4 sm:p-6 flex items-center gap-4 animate-fadeIn">
          <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 text-red-500" />
          <div className="text-xs sm:text-sm font-black tracking-wide uppercase">
            Save failed: {saveError}
          </div>
        </div>
      )}

      {/* HMI Navigation Tabs - Extra Large Touch Targets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2.5 border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-1 sm:p-2">
        <button
          onClick={() => setActiveTab('automation')}
          className={`py-2.5 px-2 sm:py-4 sm:px-3 text-[10px] xs:text-xs sm:text-sm font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
            activeTab === 'automation'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-emerald-950/10'
          }`}
        >
          <SlidersHorizontal className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Control & Schedules</span>
          <span className="sm:hidden">Schedules</span>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-2.5 px-2 sm:py-4 sm:px-3 text-[10px] xs:text-xs sm:text-sm font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
            activeTab === 'alerts'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-emerald-950/10'
          }`}
        >
          <ShieldAlert className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Alert Limits</span>
          <span className="sm:hidden">Alerts</span>
        </button>
        <button
          onClick={() => setActiveTab('crops')}
          className={`py-2.5 px-2 sm:py-4 sm:px-3 text-[10px] xs:text-xs sm:text-sm font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
            activeTab === 'crops'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-emerald-950/10'
          }`}
        >
          <Sprout className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Crop Settings</span>
          <span className="sm:hidden">Crops</span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`py-2.5 px-2 sm:py-4 sm:px-3 text-[10px] xs:text-xs sm:text-sm font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
            activeTab === 'system'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-emerald-950/10'
          }`}
        >
          <Sliders className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Calibration & DB</span>
          <span className="sm:hidden">System</span>
        </button>
      </div>

      {/* Tab Content Display - Full Width Layout for Comfort on HMI Tablets */}
      <div className="w-full flex flex-col gap-6">
        {activeTab === 'automation' && (
          <>
            <ActuatorSettings 
              actuators={actuatorsList}
              setActuators={setActuatorsList}
              toggleActuator={toggleActuator}
              autoMode={autoMode}
              availableActuators={availableActuators}
            />
            <ScheduleSettings 
              actuators={actuatorsList}
              setActuators={setActuatorsList}
            />
          </>
        )}

        {activeTab === 'alerts' && (
          <AlertSettings 
            alerts={alerts}
            setAlerts={setAlerts}
            availableSensors={availableSensors}
          />
        )}

        {activeTab === 'crops' && (
          <CropSettings 
            selectedModule={selectedModule}
          />
        )}

        {activeTab === 'system' && (
          <>
            <CalibrationSettings 
              calibrations={calibrations}
              setCalibrations={setCalibrations}
              availableSensors={availableSensors}
              activeCalibTest={activeCalibTest}
              setActiveCalibTest={setActiveCalibTest}
              testRawInput={testRawInput}
              setTestRawInput={setTestRawInput}
              testResult={testResult}
              handleRunCalibrationTest={handleRunCalibrationTest}
            />
            <DatabaseOperations />
          </>
        )}
      </div>
    </div>
  );
}

export default Setting;
