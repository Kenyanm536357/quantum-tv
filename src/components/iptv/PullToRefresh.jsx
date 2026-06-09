import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault();
      setDistance(Math.min(dy * 0.5, THRESHOLD + 20));
      setPulling(true);
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (distance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setDistance(THRESHOLD);
      await onRefresh?.();
      setRefreshing(false);
    }
    setPulling(false);
    setDistance(0);
    startY.current = null;
  }, [distance, refreshing, onRefresh]);

  const progress = Math.min(distance / THRESHOLD, 1);

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-all duration-200 pointer-events-none"
        style={{ height: distance, opacity: pulling || refreshing ? 1 : 0 }}
      >
        <div className={`w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shadow-md ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${progress * 360}deg)` }}>
          <RefreshCw className="w-4 h-4 text-primary" />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{ transform: `translateY(${distance}px)`, transition: pulling ? 'none' : 'transform 0.25s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}