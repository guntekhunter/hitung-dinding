"use client";

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, Maximize2, Settings2, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { CeilingInput, optimizeCeiling, TrapConfig } from '../utils/ceilingOptimizer';

export default function CeilingCalculator() {
  const [roomWidth, setRoomWidth] = useState(500);
  const [roomLength, setRoomLength] = useState(400);
  const [panelWidth, setPanelWidth] = useState(20);
  const [panelLength, setPanelLength] = useState(400);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [traps, setTraps] = useState<TrapConfig[]>([]);

  const addTrap = () => {
    setTraps([...traps, { width: 40, dropHeight: 15, gap: 40 }]);
  };

  const updateTrap = (index: number, field: keyof TrapConfig, value: number) => {
    const newTraps = [...traps];
    newTraps[index] = { ...newTraps[index], [field]: value };
    setTraps(newTraps);
  };

  const removeTrap = (index: number) => {
    setTraps(traps.filter((_, i) => i !== index));
  };

  const optimization = useMemo(() => {
    const input: CeilingInput = {
      roomWidth,
      roomLength,
      panelWidth,
      panelLength,
      direction,
      traps,
    };
    return optimizeCeiling(input);
  }, [roomWidth, roomLength, panelWidth, panelLength, direction, traps]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans">
      <div className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">PVC Ceiling Optimizer</h1>
          <p className="text-sm text-gray-500">Advanced 1D Cutting Stock Optimization</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" /> Room Dimensions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Room Width (cm)</label>
                <input type="number" value={roomWidth} onChange={(e) => setRoomWidth(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Room Length (cm)</label>
                <input type="number" value={roomLength} onChange={(e) => setRoomLength(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Panel Settings
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Panel Width (cm)</label>
                <input type="number" value={panelWidth} onChange={(e) => setPanelWidth(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Panel Length (cm)</label>
                <select value={panelLength} onChange={(e) => setPanelLength(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value={400}>400 cm (4m)</option>
                  <option value={600}>600 cm (6m)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Installation Direction</label>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setDirection('horizontal')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${direction === 'horizontal' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => setDirection('vertical')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${direction === 'vertical' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" /> Trap Levels
              </h2>
              <button onClick={addTrap} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {traps.map((trap, index) => (
                <div key={index} className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg relative">
                  <button onClick={() => removeTrap(index)} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <h3 className="text-xs font-bold text-indigo-900 mb-3">Trap Level {index + 1}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Width (cm)</label>
                      <input type="number" value={trap.width} onChange={(e) => updateTrap(index, 'width', Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-1.5 text-xs focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Drop (cm)</label>
                      <input type="number" value={trap.dropHeight} onChange={(e) => updateTrap(index, 'dropHeight', Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-1.5 text-xs focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Gap (cm)</label>
                      <input type="number" value={trap.gap} onChange={(e) => updateTrap(index, 'gap', Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-1.5 text-xs focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>
              ))}
              {traps.length === 0 && (
                <p className="text-xs text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Flat ceiling. Click + to add trap levels.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visualization & Results */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Panels</span>
              <span className="text-4xl font-bold text-indigo-600">{optimization.totalPanels}</span>
              <span className="text-xs text-gray-500 mt-1">{panelLength / 100}m length</span>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Waste</span>
              <span className="text-4xl font-bold text-red-500">{(optimization.totalWasteCm / 100).toFixed(2)}</span>
              <span className="text-xs text-gray-500 mt-1">meters</span>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Efficiency</span>
              <span className="text-4xl font-bold text-emerald-500">{(100 - optimization.wastePercentage).toFixed(1)}%</span>
              <span className="text-xs text-gray-500 mt-1">material used</span>
            </div>
          </div>

          {/* Visualization */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-6">Cut List & Optimization Visualizer</h2>
            
            <div className="space-y-6">
              {optimization.panels.map((panel) => (
                <div key={panel.id} className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-gray-700">Panel {panel.id}</span>
                    <span className="text-xs font-bold text-red-400">Waste: {panel.remaining} cm</span>
                  </div>
                  
                  {/* Panel Bar */}
                  <div className="h-10 bg-gray-200 rounded-md overflow-hidden flex w-full ring-1 ring-inset ring-black/10">
                    {panel.cuts.map((cut, cutIdx) => {
                      const widthPct = (cut.length / panel.originalLength) * 100;
                      return (
                        <div 
                          key={cutIdx} 
                          style={{ width: `${widthPct}%` }}
                          className={`h-full border-r border-white/40 flex items-center justify-center relative group ${cut.isReuse ? 'bg-blue-500' : 'bg-emerald-500'}`}
                        >
                          <span className="text-[10px] font-bold text-white drop-shadow-md">
                            {cut.length}
                          </span>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap">
                            {cut.isReuse ? `Reused offcut (${cut.length}cm)` : `Main cut (${cut.length}cm)`}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Remaining Waste */}
                    {panel.remaining > 0 && (
                      <div 
                        style={{ width: `${(panel.remaining / panel.originalLength) * 100}%` }}
                        className="h-full bg-gray-300 flex items-center justify-center pattern-diagonal-lines pattern-gray-400 pattern-bg-gray-300 pattern-size-2 pattern-opacity-20"
                      >
                         <span className="text-[10px] font-bold text-gray-500">
                            {panel.remaining}
                          </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 flex items-center justify-center gap-6 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
                <span className="text-xs font-medium text-gray-600">Fresh Cut</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                <span className="text-xs font-medium text-gray-600">Reused Offcut</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300 rounded-sm pattern-diagonal-lines pattern-gray-400 pattern-bg-gray-300 pattern-size-2 pattern-opacity-20"></div>
                <span className="text-xs font-medium text-gray-600">Final Waste</span>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
