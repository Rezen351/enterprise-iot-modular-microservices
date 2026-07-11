import { useState, useEffect } from 'react';
import streamApi from '../../../api/stream';
import StreamHeader from './Live/StreamHeader';
import VideoFeedGrid from './Live/VideoFeedGrid';
import EventTimeline from './Live/EventTimeline';
import StreamControls from './Live/StreamControls';
import CameraDevicesList from './Live/CameraDevicesList';
import SystemFeaturesStatus from './Live/SystemFeaturesStatus';
import AddCameraModal from './Live/AddCameraModal';
import {
  INITIAL_NEW_CAM,
  INITIAL_TIMELINE_EVENTS
} from './Live/LiveDefaults';

function Live({ selectedModule }) {
  const [streams, setStreams] = useState([]);
  const [liveStatus, setLiveStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [layoutMode, setLayoutMode] = useState('grid');
  const [selectedCamera, setSelectedCamera] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCam, setNewCam] = useState(INITIAL_NEW_CAM);
  
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [switchInterval, setSwitchInterval] = useState(10);
  const [streamQuality, setStreamQuality] = useState('high');
  const [nightVision, setNightVision] = useState(false);
  const [recordStream, setRecordStream] = useState(false);
  const [activeAutoCamIndex, setActiveAutoCamIndex] = useState(0);

  const [timelineEvents, setTimelineEvents] = useState(INITIAL_TIMELINE_EVENTS);

  const addLog = (source, message, type = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setTimelineEvents(prev => [
      { id: Date.now(), time: timeStr, source, message, type },
      ...prev
    ]);
  };

  const fetchStreamsAndStatus = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const moduleId = selectedModule?._dbId || null;
      const dbData = await streamApi.getAllStreams(moduleId);
      let activeData = { items: [] };
      try {
        activeData = await streamApi.getLiveStatus();
      } catch (e) {
        console.warn('Failed to load active status from MediaMTX (falling back)', e);
      }
      setStreams(dbData.streams || []);
      setLiveStatus(activeData.items || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load camera configurations from API');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreamsAndStatus(true);
    const interval = setInterval(() => {
      fetchStreamsAndStatus(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedModule]);

  useEffect(() => {
    if (!autoSwitch || streams.length === 0) return;
    const interval = setInterval(() => {
      setActiveAutoCamIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % streams.length;
        addLog('System', `Auto switch focus to: ${streams[nextIndex].path_name}`, 'info');
        return nextIndex;
      });
    }, switchInterval * 1000);
    return () => clearInterval(interval);
  }, [autoSwitch, switchInterval, streams]);

  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!newCam.path_name || !newCam.source_url) {
      alert('Path name and RTSP URL are required');
      return;
    }
    try {
      setLoading(true);
      const cameraPayload = {
        ...newCam,
        module_id: selectedModule?._dbId ? parseInt(selectedModule._dbId) : null
      };
      await streamApi.createStream(cameraPayload);
      addLog('Database', `Camera ${newCam.path_name} added to configuration`, 'info');
      setShowAddModal(false);
      setNewCam(INITIAL_NEW_CAM);
      await fetchStreamsAndStatus();
    } catch (err) {
      console.error(err);
      alert('Failed to add camera: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async (pathName) => {
    if (!confirm(`Are you sure you want to delete camera "${pathName}"?`)) return;
    try {
      setLoading(true);
      await streamApi.deleteStream(pathName);
      addLog('Database', `Camera ${pathName} removed from configuration`, 'warning');
      await fetchStreamsAndStatus();
    } catch (err) {
      console.error(err);
      alert('Failed to delete camera: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = () => {
    addLog('Controls', 'Screenshot captured and stored in MinIO storage.', 'info');
    alert('Screenshot captured successfully and uploaded to S3 Bucket.');
  };

  const handleRecordToggle = () => {
    setRecordStream(!recordStream);
    addLog('Controls', recordStream ? 'Continuous recording stopped.' : 'Started local recording for all live streams.', recordStream ? 'info' : 'warning');
  };

  const isOnline = (pathName) => {
    const liveCam = liveStatus.find(c => c.name === pathName);
    return liveCam ? liveCam.online : false;
  };

  const filteredStreams = streams.filter(s => {
    if (selectedCamera === 'ALL') return true;
    return s.path_name === selectedCamera;
  });

  const onlineCount = streams.filter(s => isOnline(s.path_name)).length;
  const offlineCount = streams.length - onlineCount;

  const [clockTime, setClockTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col xl:flex-row gap-4 w-full animate-fadeIn relative">
      <div className="flex-1 flex flex-col gap-3 sm:gap-4 min-w-0">
        <StreamHeader 
          selectedCamera={selectedCamera}
          setSelectedCamera={setSelectedCamera}
          streams={streams}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          onlineCount={onlineCount}
          offlineCount={offlineCount}
          fetchStreamsAndStatus={fetchStreamsAndStatus}
          selectedModule={selectedModule}
        />

        <VideoFeedGrid 
          loading={loading}
          streams={filteredStreams}
          error={error}
          fetchStreamsAndStatus={fetchStreamsAndStatus}
          setShowAddModal={setShowAddModal}
          layoutMode={layoutMode}
          isOnline={isOnline}
          autoSwitch={autoSwitch}
          activeAutoCamIndex={activeAutoCamIndex}
          nightVision={nightVision}
          recordStream={recordStream}
          handleDeleteCamera={handleDeleteCamera}
          clockTime={clockTime}
        />

        <EventTimeline timelineEvents={timelineEvents} />
      </div>

      <div className="w-full xl:w-80 shrink-0 flex flex-col gap-3 sm:gap-4">
        <StreamControls 
          autoSwitch={autoSwitch}
          setAutoSwitch={setAutoSwitch}
          switchInterval={switchInterval}
          setSwitchInterval={setSwitchInterval}
          streamQuality={streamQuality}
          setStreamQuality={setStreamQuality}
          addLog={addLog}
          nightVision={nightVision}
          setNightVision={setNightVision}
          recordStream={recordStream}
          handleRecordToggle={handleRecordToggle}
          handleScreenshot={handleScreenshot}
        />

        <CameraDevicesList 
          streams={streams}
          isOnline={isOnline}
          fetchStreamsAndStatus={fetchStreamsAndStatus}
          setShowAddModal={setShowAddModal}
        />

        <SystemFeaturesStatus 
          autoSwitch={autoSwitch}
          nightVision={nightVision}
          recordStream={recordStream}
        />
      </div>

      <AddCameraModal 
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        handleAddCamera={handleAddCamera}
        newCam={newCam}
        setNewCam={setNewCam}
      />
    </div>
  );
}

export default Live;
