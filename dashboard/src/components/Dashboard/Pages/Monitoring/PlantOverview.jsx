import { useEffect, useState } from 'react';
import { Calendar, Sprout, Leaf, Target, PlusCircle } from 'lucide-react';
import plantHero from '../../../../assets/aeroponic_hero.png';

function PlantOverview({ selectedModule, setActiveTab }) {
  const [activeCrop, setActiveCrop] = useState(null);
  const [loading, setLoading] = useState(true);

  const moduleId = selectedModule?._dbId || 'module-01';

  useEffect(() => {
    let isMounted = true;
    const fetchActiveCrop = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`/api/v1/iot/modules/${moduleId}/crops/active`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.status === 404) {
          if (isMounted) setActiveCrop(null);
        } else if (response.ok) {
          const data = await response.json();
          if (isMounted) setActiveCrop(data);
        } else {
          if (isMounted) setActiveCrop(null);
        }
      } catch (err) {
        console.warn("Failed to fetch active crop batch", err);
        if (isMounted) setActiveCrop(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchActiveCrop();
    return () => {
      isMounted = false;
    };
  }, [moduleId]);

  // Calculate dynamic properties if crop exists
  let cropName = 'No Active Crop';
  let quantity = '-';
  let ageDays = '-';
  let stage = '-';
  let progress = 0;
  let nextHarvestText = 'Planting required';

  if (activeCrop) {
    cropName = activeCrop.crop_name;
    quantity = activeCrop.quantity;
    
    const plantingDate = new Date(activeCrop.planting_date);
    const now = new Date();
    const diffTime = Math.max(0, now - plantingDate);
    ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    progress = Math.min(100, Math.round((ageDays / activeCrop.estimated_cycle_days) * 100));
    
    if (progress >= 75) {
      stage = 'Mature';
    } else if (progress >= 15) {
      stage = 'Vegetative';
    } else {
      stage = 'Seedling';
    }

    const harvestDate = new Date(plantingDate.getTime() + activeCrop.estimated_cycle_days * 24 * 60 * 60 * 1000);
    const harvestDateString = harvestDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const daysLeft = activeCrop.estimated_cycle_days - ageDays;
    
    if (daysLeft > 0) {
      nextHarvestText = `${harvestDateString} (${daysLeft} Days Left)`;
    } else {
      nextHarvestText = `${harvestDateString} (Ready to Harvest)`;
    }
  }

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3 sm:p-4 flex flex-col h-auto md:h-[246px] justify-between relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex items-center justify-between z-10 border-b border-emerald-500/10 pb-2">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            Plant Overview {activeCrop ? `— ${cropName}` : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center z-10 py-4">
          <div className="animate-spin h-6 w-6 border-b-2 border-emerald-400"></div>
        </div>
      ) : !activeCrop ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-3 my-2 border border-dashed border-emerald-500/10 bg-[#020604]/30 z-10">
          <Sprout className="w-8 h-8 text-emerald-500/40 mb-1 animate-pulse" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">No Crop</p>
          <button
            onClick={() => setActiveTab('setting')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-white text-[10px] font-bold transition-all duration-300 group/btn"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Start Batch</span>
          </button>
        </div>
      ) : (
        <>
          {/* Plant stats rows */}
          <div className="grid grid-cols-3 gap-2.5 my-2.5 z-10">
            <div className="p-2 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
              <Sprout className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Plants</span>
              <span className="text-xs font-black text-white mt-0.5">{quantity}</span>
            </div>
            <div className="p-2 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Age</span>
              <span className="text-xs font-black text-white mt-0.5">{ageDays}</span>
            </div>
            <div className="p-2 border border-slate-900 bg-[#020604]/60 flex flex-col items-center">
              <Leaf className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Stage</span>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wide mt-1 truncate max-w-full">
                {stage}
              </span>
            </div>
          </div>

          {/* Progress & estimation */}
          <div className="z-10 flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-400">
                <span>Progress</span>
                <span className="text-emerald-400">{progress}%</span>
              </div>
              {/* Progress bar wrapper */}
              <div className="w-full h-1.5 bg-slate-950 border border-slate-900 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Harvest Estimation */}
            <div className="flex items-center justify-between p-2 border border-emerald-500/10 bg-[#020604]/50">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-emerald-400" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Harvest</span>
              </div>
              <span className="text-[8px] font-black text-white uppercase tracking-wider">
                {nextHarvestText}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PlantOverview;
