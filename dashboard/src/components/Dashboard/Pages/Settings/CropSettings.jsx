import { useState, useEffect } from 'react';
import { Sprout, Calendar, CheckCircle2, XCircle, Loader2, AlertCircle, FileText } from 'lucide-react';

function CropSettings({ selectedModule }) {
  const moduleId = selectedModule?._dbId || 'module-01';

  // Crop States
  const [activeCrop, setActiveCrop] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form States
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [cycleDays, setCycleDays] = useState(30);
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const fetchCropData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      
      // 1. Fetch active crop from Go-DAL
      const activeRes = await fetch(`/api/v1/iot/modules/${moduleId}/crops/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (activeRes.status === 404) {
        setActiveCrop(null);
      } else if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveCrop(activeData);
      } else {
        setActiveCrop(null);
      }

      // 2. Fetch history from Go-DAL
      const historyRes = await fetch(`/api/v1/iot/modules/${moduleId}/crops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData || []);
      }
    } catch (err) {
      console.error("Failed to load crop batch settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCropData();
  }, [moduleId]);

  const handleStartCrop = async (e) => {
    e.preventDefault();
    if (!cropName.trim()) {
      setFormError("Crop name is required");
      return;
    }
    if (quantity <= 0) {
      setFormError("Quantity must be greater than zero");
      return;
    }
    if (cycleDays <= 0) {
      setFormError("Estimated cycle days must be greater than zero");
      return;
    }

    setFormError(null);
    setActionLoading(true);

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/v1/iot/modules/${moduleId}/crops`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          crop_name: cropName,
          planting_date: new Date(plantingDate).toISOString(),
          quantity: parseInt(quantity),
          estimated_cycle_days: parseInt(cycleDays)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Status ${response.status}`);
      }

      setFormSuccess(true);
      setCropName('');
      setQuantity(100);
      setCycleDays(30);
      setPlantingDate(new Date().toISOString().split('T')[0]);
      
      await fetchCropData();
      
      setTimeout(() => setFormSuccess(false), 4000);
    } catch (err) {
      setFormError(err.message || "Failed to start crop batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (cropId, newStatus) => {
    if (!confirm(`Are you sure you want to mark this crop batch as ${newStatus}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/v1/iot/crops/${cropId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      await fetchCropData();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 border border-emerald-500/10 bg-[#020604]/30">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Crop Data...</span>
      </div>
    );
  }

  // Calculate Active Crop Details
  let ageDays = 0;
  let progress = 0;
  let harvestDateString = '';
  if (activeCrop) {
    const plantingDateObj = new Date(activeCrop.planting_date);
    const now = new Date();
    const diffTime = Math.max(0, now - plantingDateObj);
    ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    progress = Math.min(100, Math.round((ageDays / activeCrop.estimated_cycle_days) * 100));
    
    const harvestDate = new Date(plantingDateObj.getTime() + activeCrop.estimated_cycle_days * 24 * 60 * 60 * 1000);
    harvestDateString = harvestDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn">
      
      {/* Grid: Form vs Active Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        
        {/* Panel 1: Active Crop Status */}
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-emerald-500/10 pb-3 mb-4 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-400" />
              Active Crop Status
            </h3>

            {activeCrop ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-[#020604]/50 border border-slate-900 p-2.5 sm:p-3.5">
                  <div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Crop Species / Name</div>
                    <div className="text-base font-black text-white mt-0.5">{activeCrop.crop_name}</div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    {progress >= 75 ? 'Mature' : progress >= 15 ? 'Vegetative' : 'Seedling'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Plants</span>
                    <span className="text-lg font-black text-white mt-1">{activeCrop.quantity}</span>
                  </div>
                  <div className="p-2 sm:p-3 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Age</span>
                    <span className="text-lg font-black text-white mt-0.5">{ageDays} Days</span>
                  </div>
                  <div className="p-2 sm:p-3 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Cycle</span>
                    <span className="text-lg font-black text-white mt-1">{activeCrop.estimated_cycle_days}d</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Growth Progress</span>
                    <span className="text-emerald-400">{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 border border-slate-900 overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 text-right">
                    Estimated Harvest: {harvestDateString}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-emerald-500/10 bg-[#020604]/30 my-4">
                <Sprout className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active crop batch running</p>
                <p className="text-[10px] text-slate-500 max-w-[280px] mt-1 font-medium">
                  Use the registration form on the right to plant a new batch in this Module container.
                </p>
              </div>
            )}
          </div>

          {activeCrop && (
            <div className="grid grid-cols-2 gap-3 mt-6 border-t border-emerald-500/10 pt-4">
              <button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus(activeCrop.id, 'harvested')}
                className="flex items-center justify-center gap-1.5 h-10 sm:h-12 px-3 sm:px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-[11px] sm:text-xs tracking-wider uppercase cursor-pointer transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Harvested
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus(activeCrop.id, 'failed')}
                className="flex items-center justify-center gap-1.5 h-10 sm:h-12 px-3 sm:px-4 border border-red-500/20 bg-red-950/20 hover:bg-red-900/30 disabled:opacity-50 text-red-400 font-black text-[11px] sm:text-xs tracking-wider uppercase cursor-pointer transition-all active:scale-[0.98]"
              >
                <XCircle className="w-4 h-4" />
                Crop Failed
              </button>
            </div>
          )}
        </div>

        {/* Panel 2: Register New Batch Form */}
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 flex flex-col justify-between">
          <form onSubmit={handleStartCrop} className="flex flex-col gap-4">
            <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-emerald-500/10 pb-3 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Start New Crop Batch
            </h3>

            {activeCrop && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 flex gap-3 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  <strong>Note:</strong> Starting a new crop batch will not auto-harvest the current one, but you should mark it harvested first to avoid multi-batch calculation overlap.
                </p>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider">
                Error: {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                New batch registered successfully!
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Crop Species / Variant</label>
              <input
                type="text"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                placeholder="e.g. Green Lettuce Lollo Bionda"
                className="w-full bg-[#020604]/80 border border-slate-900 focus:border-emerald-500/40 p-2.5 sm:p-3.5 text-xs sm:text-sm text-white focus:outline-none transition-colors"
                disabled={actionLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity (Plants)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#020604]/80 border border-slate-900 focus:border-emerald-500/40 p-2.5 sm:p-3.5 text-xs sm:text-sm text-white focus:outline-none transition-colors"
                  disabled={actionLoading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cycle Days (Duration)</label>
                <input
                  type="number"
                  value={cycleDays}
                  onChange={(e) => setCycleDays(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#020604]/80 border border-slate-900 focus:border-emerald-500/40 p-2.5 sm:p-3.5 text-xs sm:text-sm text-white focus:outline-none transition-colors"
                  disabled={actionLoading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Planting Date</label>
              <input
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
                className="w-full bg-[#020604]/80 border border-slate-900 focus:border-emerald-500/40 p-2.5 sm:p-3.5 text-xs sm:text-sm text-white focus:outline-none transition-colors"
                disabled={actionLoading}
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="mt-2 w-full h-11 sm:h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-black font-black uppercase tracking-wider text-[11px] sm:text-xs cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-black" />}
              <span>Plant & Start Batch</span>
            </button>
          </form>
        </div>

      </div>

      {/* Historical logs list */}
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
        <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-emerald-500/10 pb-3 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Crop Batch History
        </h3>

        {history.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-emerald-500/10 text-slate-400 font-black uppercase tracking-wider">
                  <th className="py-2.5 px-2 sm:py-3 sm:px-4">Crop Name</th>
                  <th className="py-2.5 px-2 sm:py-3 sm:px-4">Planting Date</th>
                  <th className="py-2.5 px-2 sm:py-3 sm:px-4">Cycle</th>
                  <th className="py-2.5 px-2 sm:py-3 sm:px-4">Quantity</th>
                  <th className="py-2.5 px-2 sm:py-3 sm:px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/5 font-medium text-slate-300">
                {history.map((batch) => {
                  const pDate = new Date(batch.planting_date);
                  const plantingStr = pDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                  
                  let harvestStr = '-';
                  let cycleText = `${batch.estimated_cycle_days} Days (Est)`;
                  
                  if (batch.actual_harvest_date) {
                    const hDate = new Date(batch.actual_harvest_date);
                    harvestStr = hDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                    
                    const diff = Math.max(0, hDate - pDate);
                    const actualDays = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const diffDays = actualDays - batch.estimated_cycle_days;
                    
                    let comparison = '';
                    if (diffDays < 0) {
                      comparison = ` (${Math.abs(diffDays)}d faster)`;
                    } else if (diffDays > 0) {
                      comparison = ` (${diffDays}d slower)`;
                    } else {
                      comparison = ' (on time)';
                    }
                    cycleText = `${actualDays} Days${comparison}`;
                  }

                  return (
                    <tr key={batch.id} className="hover:bg-emerald-950/5 transition-colors">
                      <td className="py-2.5 px-2 sm:py-3.5 sm:px-4 font-bold text-white">{batch.crop_name}</td>
                      <td className="py-2.5 px-2 sm:py-3.5 sm:px-4">
                        <div className="text-slate-300 text-[11px] sm:text-xs">P: {plantingStr}</div>
                        {batch.actual_harvest_date && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            H: {harvestStr}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 sm:py-3.5 sm:px-4 font-semibold">{cycleText}</td>
                      <td className="py-2.5 px-2 sm:py-3.5 sm:px-4">{batch.quantity}</td>
                      <td className="py-2.5 px-2 sm:py-3.5 sm:px-4 uppercase tracking-wider font-bold">
                      {batch.status === 'active' && (
                        <span className="text-blue-400 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 text-[10px]">
                          Active
                        </span>
                      )}
                      {batch.status === 'harvested' && (
                        <span className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 text-[10px]">
                          Harvested
                        </span>
                      )}
                      {batch.status === 'failed' && (
                        <span className="text-red-400 bg-red-500/5 border border-red-500/20 px-2 py-0.5 text-[10px]">
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 uppercase font-black tracking-widest text-[10px]">
            No historical records for this container.
          </div>
        )}
      </div>

    </div>
  );
}

export default CropSettings;
