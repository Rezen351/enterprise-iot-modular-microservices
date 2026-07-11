export const INITIAL_SNAPSHOTS = [
  {
    id: 1,
    title: 'Grow Chamber 1',
    category: 'Growth',
    tagColor: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 17:30:21',
    cam: 'CAM 01',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.24 MB',
    notes: 'Plants look healthy. Good growth observed.'
  },
  {
    id: 2,
    title: 'Root Zone',
    category: 'Root Health',
    tagColor: 'text-fuchsia-400 bg-fuchsia-950/80 border-fuchsia-500/30',
    dotColor: 'bg-fuchsia-400',
    image: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 16:45:10',
    cam: 'CAM 02',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.18 MB',
    notes: 'Root system expanding nicely. No discoloration.'
  },
  {
    id: 3,
    title: 'Nutrient Tank',
    category: 'System',
    tagColor: 'text-blue-400 bg-blue-950/80 border-blue-500/30',
    dotColor: 'bg-blue-400',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 15:20:05',
    cam: 'CAM 03',
    resolution: '1280 x 720 (720p)',
    fileSize: '820 KB',
    notes: 'Nutrient solution level stable. pH sensor cleaned.'
  },
  {
    id: 4,
    title: 'Greenhouse Overview',
    category: 'Overview',
    tagColor: 'text-cyan-400 bg-cyan-950/80 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 14:10:33',
    cam: 'CAM 04',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.45 MB',
    notes: 'Overview clean. Sunlight distribution is uniform.'
  },
  {
    id: 5,
    title: 'Leaf Close-up',
    category: 'Leaf Health',
    tagColor: 'text-lime-400 bg-lime-950/80 border-lime-500/30',
    dotColor: 'bg-lime-400',
    image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 13:05:47',
    cam: 'CAM 01',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.05 MB',
    notes: 'No signs of leaf burn or nutrient deficiency.'
  },
  {
    id: 6,
    title: 'System Overview',
    category: 'System',
    tagColor: 'text-blue-400 bg-blue-950/80 border-blue-500/30',
    dotColor: 'bg-blue-400',
    image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 12:30:12',
    cam: 'CAM 03',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.31 MB',
    notes: 'Pump pressure registered at 60 PSI.'
  },
  {
    id: 7,
    title: 'Seedling Tray',
    category: 'Growth',
    tagColor: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    image: 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 11:15:09',
    cam: 'CAM 01',
    resolution: '1280 x 720 (720p)',
    fileSize: '750 KB',
    notes: 'Sprouts showing first true leaves. High germination rate.'
  },
  {
    id: 8,
    title: 'pH Sensor',
    category: 'Monitoring',
    tagColor: 'text-indigo-400 bg-indigo-950/80 border-indigo-500/30',
    dotColor: 'bg-indigo-400',
    image: 'https://images.unsplash.com/photo-1607619056574-7b8f30413736?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 10:05:22',
    cam: 'CAM 03',
    resolution: '1280 x 720 (720p)',
    fileSize: '680 KB',
    notes: 'pH reading calibrated. Checked against buffer solutions.'
  },
  {
    id: 9,
    title: 'Reservoir Water Level',
    category: 'System',
    tagColor: 'text-blue-400 bg-blue-950/80 border-blue-500/30',
    dotColor: 'bg-blue-400',
    image: 'https://images.unsplash.com/photo-1574689049868-e94ed5301745?auto=format&fit=crop&w=600&q=80',
    date: '17 May 2024, 09:25:31',
    cam: 'CAM 02',
    resolution: '1920 x 1080 (1080p)',
    fileSize: '1.12 MB',
    notes: 'Water level at 85%. Top-up not required today.'
  }
];

export const TAG_COUNTS = {
  'Growth': 28,
  'Root Health': 16,
  'Leaf Health': 14,
  'System': 22,
  'Monitoring': 10,
  'Overview': 18
};

export const getDotColor = (category) => {
  switch (category) {
    case 'Growth': return 'bg-emerald-400';
    case 'Root Health': return 'bg-fuchsia-400';
    case 'Leaf Health': return 'bg-lime-400';
    case 'System': return 'bg-blue-400';
    case 'Monitoring': return 'bg-indigo-400';
    case 'Overview': return 'bg-cyan-400';
    default: return 'bg-slate-400';
  }
};
