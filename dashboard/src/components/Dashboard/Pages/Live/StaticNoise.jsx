import { useEffect, useRef } from 'react';

function StaticNoise({ opacity = 15 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const resize = () => {
      canvas.width = 150; // Keep canvas small for low GPU overhead
      canvas.height = 100;
    };
    resize();

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = opacity; 
      }
      ctx.putImageData(imgData, 0, 0);
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [opacity]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50 mix-blend-screen" />;
}

export default StaticNoise;
