import { useState, useMemo, useEffect } from 'react';
import SnapshotHeader from './Snapshot/SnapshotHeader';
import SnapshotGrid from './Snapshot/SnapshotGrid';
import SnapshotPagination from './Snapshot/SnapshotPagination';
import SnapshotInfo from './Snapshot/SnapshotInfo';
import TagFilter from './Snapshot/TagFilter';
import SnapshotActions from './Snapshot/SnapshotActions';
import ModuleBadge from '../ModuleBadge';


function Snapshot({ selectedModule }) {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const moduleId = selectedModule?._dbId || 5;

  useEffect(() => {
    let isMounted = true;
    
    const fetchSnapshots = async () => {
      try {
        const response = await fetch(`/api/v1/vision/detections?module_id=${moduleId}&limit=50`);
        if (!response.ok) {
          throw new Error('Failed to fetch snapshots');
        }
        const data = await response.json();
        if (isMounted) {
          const mapped = data.map(item => {
          let image = item.result_media_url || item.input_media_url || 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=600&q=80';

          // Metode Paling Sederhana: Selalu gunakan path relatif /storage/NAMA_BUCKET/...
          // Ini berfungsi di localhost:5173 (Vite), localhost:82 (Nginx), dan Domain Publik
          if (image.includes('/visionapi-bucket/')) {
            const parts = image.split('/visionapi-bucket/');
            const pathAfterBucket = parts[1].split('?')[0];
            image = `/storage/visionapi-bucket/${pathAfterBucket}`;
          }

          const dateObj = new Date(item.created_at);
            const dateStr = dateObj.toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            let predictions = [];
            let counts = {};
            try {
              if (item.raw_inference_output) {
                const parsed = typeof item.raw_inference_output === 'string' 
                  ? JSON.parse(item.raw_inference_output) 
                  : item.raw_inference_output;
                
                if (Array.isArray(parsed)) {
                  predictions = parsed;
                  parsed.forEach(p => {
                    const cls = p.class || 'unknown';
                    counts[cls] = (counts[cls] || 0) + 1;
                  });
                }
              }
            } catch (err) {
              console.error("Error parsing inference output:", err);
            }

            let category = 'System';
            if (counts.root || counts['root-rot'] || counts['hairy-root'] || counts['healthy-root']) {
              category = 'Root Health';
            } else if (counts.leaf || counts['leaf-spot'] || counts['healthy-leaf']) {
              category = 'Leaf Health';
            } else if (counts.plant || counts.sprout) {
              category = 'Growth';
            }

            let notes = '';
            if (predictions.length > 0) {
              const summaries = Object.entries(counts).map(([cls, count]) => `${count} ${cls}`);
              notes = `YOLO Detection: ${summaries.join(', ')}. Execution time: ${item.execution_time_ms ? item.execution_time_ms.toFixed(1) : 0}ms.`;
            } else {
              notes = `No objects detected. Checked at ${dateStr}.`;
            }

            let cam = 'CAM 01';
            if (item.input_media_url) {
              const camMatch = item.input_media_url.match(/_cam_([a-zA-Z0-9\-]+)/i) || 
                               item.input_media_url.match(/[\/_](cam_?[\w\-]+|live\d+|cam\d+)/i);
              if (camMatch) {
                let extracted = camMatch[1];
                if (extracted.toLowerCase().startsWith('cam')) {
                  extracted = extracted.replace(/^cam[-_]?/i, '');
                }
                if (/^\d+$/.test(extracted)) {
                  cam = 'CAM ' + extracted.padStart(2, '0');
                } else {
                  cam = 'CAM ' + extracted.toUpperCase();
                }
              } else {
                const parts = item.input_media_url.split('_cam_');
                if (parts.length > 1) {
                  cam = 'CAM ' + parts[1].split('_')[0].toUpperCase();
                }
              }
            }

            return {
              id: item.id,
              title: `Snapshot ${item.id} - ${cam}`,
              category: category,
              tagColor: category === 'Root Health' ? 'text-fuchsia-400 bg-fuchsia-950/80 border-fuchsia-500/30' :
                        category === 'Leaf Health' ? 'text-lime-400 bg-lime-950/80 border-lime-500/30' :
                        category === 'Growth' ? 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30' :
                        'text-blue-400 bg-blue-950/80 border-blue-500/30',
              dotColor: category === 'Root Health' ? 'bg-fuchsia-400' :
                        category === 'Leaf Health' ? 'bg-lime-400' :
                        category === 'Growth' ? 'bg-emerald-400' :
                        'bg-blue-400',
              image: image,
              date: dateStr,
              cam: cam,
              resolution: '1920 x 1080 (1080p)',
              fileSize: '1.2 MB',
              notes: notes,
              predictions: predictions
            };
          });
          
          setSnapshots(mapped);
          if (mapped.length > 0) {
            setActiveId(mapped[0].id);
          } else {
            setActiveId(null);
          }
        }
      } catch (err) {
        console.error("Error fetching snapshots:", err);
      }
    };

    fetchSnapshots();
    const interval = setInterval(fetchSnapshots, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [moduleId]);

  // Filters
  const [cameraFilter, setCameraFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique cameras from all snapshots
  const availableCameras = useMemo(() => {
    const cams = snapshots.map(s => s.cam).filter(Boolean);
    return ['ALL', ...Array.from(new Set(cams))];
  }, [snapshots]);
  
  // Note editing
  const [notesEditMode, setNotesEditMode] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  // Menu trigger per snapshot (simulated)
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Find active snapshot details
  const activeSnapshot = useMemo(() => {
    return snapshots.find(s => s.id === activeId) || snapshots[0] || null;
  }, [snapshots, activeId]);

  // Toggle selection checkbox
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Filter snapshot list
  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(s => {
      const matchCam = cameraFilter === 'ALL' || s.cam === cameraFilter;
      const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
      const matchSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.notes.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCam && matchCat && matchSearch;
    });
  }, [snapshots, cameraFilter, categoryFilter, searchQuery]);

  // Paginate list
  const paginatedSnapshots = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSnapshots.slice(start, start + pageSize);
  }, [filteredSnapshots, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredSnapshots.length / pageSize) || 1;
  }, [filteredSnapshots, pageSize]);

  // Toggle select all on current filtered view
  const isAllSelected = useMemo(() => {
    if (paginatedSnapshots.length === 0) return false;
    return paginatedSnapshots.every(s => selectedIds.includes(s.id));
  }, [paginatedSnapshots, selectedIds]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      const paginatedIds = paginatedSnapshots.map(s => s.id);
      setSelectedIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      const paginatedIds = paginatedSnapshots.map(s => s.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  // Save edited notes
  const handleSaveNotes = () => {
    if (!activeSnapshot) return;
    setSnapshots(prev => prev.map(s => 
      s.id === activeSnapshot.id ? { ...s, notes: tempNotes } : s
    ));
    setNotesEditMode(false);
  };

  // Actions
  const handleDownloadSelected = () => {
    if (selectedIds.length === 0) {
      alert('Select at least one snapshot to download.');
      return;
    }
    alert(`Downloading ${selectedIds.length} snapshot files to your computer.`);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert('Select at least one snapshot to delete.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected snapshots?`)) {
      const remaining = snapshots.filter(s => !selectedIds.includes(s.id));
      setSnapshots(remaining);
      setSelectedIds([]);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      }
    }
  };

  const handleExportGallery = () => {
    alert('Exporting snapshot gallery as a ZIP file containing visual logs and metadata.');
  };

  // Calculate tag counts dynamically from snapshots
  const dynamicTagCounts = useMemo(() => {
    const counts = {
      'Growth': 0,
      'Root Health': 0,
      'Leaf Health': 0,
      'System': 0,
      'Monitoring': 0,
      'Overview': 0
    };
    snapshots.forEach(s => {
      if (counts[s.category] !== undefined) {
        counts[s.category]++;
      }
    });
    return counts;
  }, [snapshots]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full animate-fadeIn pb-12">
      
      {/* LEFT GALLERY PANEL */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {selectedModule && (
          <div className="flex justify-end">
            <ModuleBadge selectedModule={selectedModule} />
          </div>
        )}
        <SnapshotHeader 
          handleSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          snapshotsLength={snapshots.length}
          cameraFilter={cameraFilter}
          setCameraFilter={setCameraFilter}
          setCurrentPage={setCurrentPage}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          availableCameras={availableCameras}
        />

        <SnapshotGrid 
          paginatedSnapshots={paginatedSnapshots}
          setCameraFilter={setCameraFilter}
          setCategoryFilter={setCategoryFilter}
          setSearchQuery={setSearchQuery}
          setCurrentPage={setCurrentPage}
          activeSnapshot={activeSnapshot}
          setActiveId={setActiveId}
          setNotesEditMode={setNotesEditMode}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          setSnapshots={setSnapshots}
        />

        <SnapshotPagination 
          filteredSnapshotsLength={filteredSnapshots.length}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalPages={totalPages}
        />
      </div>

      {/* RIGHT DETAILS SIDEBAR */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
        <SnapshotInfo 
          activeSnapshot={activeSnapshot}
          notesEditMode={notesEditMode}
          setNotesEditMode={setNotesEditMode}
          tempNotes={tempNotes}
          setTempNotes={setTempNotes}
          handleSaveNotes={handleSaveNotes}
        />

        <TagFilter 
          tagCounts={dynamicTagCounts}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />

        <SnapshotActions 
          handleDownloadSelected={handleDownloadSelected}
          selectedIdsLength={selectedIds.length}
          handleDeleteSelected={handleDeleteSelected}
          activeSnapshot={activeSnapshot}
          setTempNotes={setTempNotes}
          setNotesEditMode={setNotesEditMode}
          handleExportGallery={handleExportGallery}
        />
      </div>

    </div>
  );
}

export default Snapshot;
