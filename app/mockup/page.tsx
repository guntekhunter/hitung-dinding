"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams, useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";

import TextureSelector from "../components/TextureSelector";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
            <div className="animate-pulse text-slate-400">Loading Mockup...</div>
        </div>
    ),
});

// Helper for solving homography
function solveHomography(src: { x: number, y: number }[], dst: { x: number, y: number }[]) {
    const A: number[][] = [];
    for (let i = 0; i < 4; i++) {
        const x = src[i].x;
        const y = src[i].y;
        const u = dst[i].x;
        const v = dst[i].y;
        A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
        A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
    }

    // Gaussian elimination
    for (let i = 0; i < 8; i++) {
        let maxEl = Math.abs(A[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < 8; k++) {
            if (Math.abs(A[k][i]) > maxEl) {
                maxEl = Math.abs(A[k][i]);
                maxRow = k;
            }
        }

        const tmp = A[maxRow];
        A[maxRow] = A[i];
        A[i] = tmp;

        const pivot = A[i][i];
        if (pivot === 0) return null;

        for (let k = i; k < 9; k++) {
            A[i][k] /= pivot;
        }

        for (let j = 0; j < 8; j++) {
            if (i !== j) {
                const factor = A[j][i];
                for (let k = i; k < 9; k++) {
                    A[j][k] -= factor * A[i][k];
                }
            }
        }
    }

    const H = [
        A[0][8], A[3][8], 0, A[6][8],
        A[1][8], A[4][8], 0, A[7][8],
        0, 0, 1, 0,
        A[2][8], A[5][8], 0, 1
    ];

    return `matrix3d(${H.join(',')})`;
}

import { Plus, Copy, Minus } from 'lucide-react';

const MockupManager = ({ mockups, activeMockupId, addMockup, removeMockup, setActiveMockup, updateMockupName, duplicateMockup }: any) => (
    <div className="w-full md:w-[260px] flex-shrink-0 bg-white border-r border-gray-200 shadow-sm z-10 flex flex-col h-[30vh] md:h-full p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold uppercase text-[12px] text-gray-700 tracking-wider">Mockups</h3>
            <button onClick={addMockup} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition">
                <Plus size={16} />
            </button>
        </div>
        <div className="flex flex-col gap-2">
            {mockups.map((m: any) => (
                <div key={m.id} onClick={() => setActiveMockup(m.id)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${activeMockupId === m.id ? 'bg-[#F5F3FF] border-[#7B6DED] shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <input
                        value={m.name}
                        onChange={(e) => updateMockupName(m.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent border-none text-sm focus:outline-none text-gray-800 font-medium"
                    />
                    <button onClick={(e) => { e.stopPropagation(); duplicateMockup(m.id); }} className="p-1 text-gray-400 hover:text-[#7B6DED] transition">
                        <Copy size={14} />
                    </button>
                    {mockups.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeMockup(m.id); }} className="p-1 text-gray-400 hover:text-red-500 transition">
                            <Minus size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
);

function MockupPageContent() {
    const wallEditorRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const router = useRouter();

    const { loadProject, fetchProducts, walls, activeWallId, setActiveWall, setIsColoringPreview } = useCanvasStore();
    
    // Always start with loading = true to prevent hydration mismatch between server and client
    // (searchParams is empty on server during static generation, but populated on client)
    const [loadingProject, setLoadingProject] = useState(true);

    // Multiple Mockups State
    const [mockupsList, setMockupsList] = useState<{ id: string, name: string, bgImage: string | null, includedWalls: string[], wallCorners: Record<string, { x: number, y: number }[]> }[]>([
        { id: '1', name: 'Mockup 1', bgImage: null, includedWalls: [], wallCorners: {} }
    ]);
    const [activeMockupId, setActiveMockupId] = useState('1');

    // Background Image State
    const [bgImage, setBgImage] = useState<string | null>(null);

    // Scene state
    const [includedWalls, setIncludedWalls] = useState<string[]>([]);
    const [wallCorners, setWallCorners] = useState<Record<string, { x: number, y: number }[]>>({});

    // Keep track of dynamic box sizes for each included wall
    const [boxDimensions, setBoxDimensions] = useState<Record<string, { width: number, height: number, minX: number, minY: number }>>({});

    // History for undo/redo of corners
    const [cornersPast, setCornersPast] = useState<Record<string, { x: number, y: number }[]>[]>([]);
    const [cornersFuture, setCornersFuture] = useState<Record<string, { x: number, y: number }[]>[]>([]);

    const [draggingHandle, setDraggingHandle] = useState<{ wallId: string, index: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [wallDropdownOpen, setWallDropdownOpen] = useState(false);
    const wallDropdownRef = useRef<HTMLDivElement>(null);

    // Close wall dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (wallDropdownRef.current && !wallDropdownRef.current.contains(e.target as Node)) {
                setWallDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);
    const [canvasDims, setCanvasDims] = useState({ width: 3000, height: 3000 });

    useEffect(() => {
        if (!bgImage) {
            setCanvasDims({ width: 3000, height: 3000 });
            return;
        }
        const img = new window.Image();
        img.src = bgImage;
        img.onload = () => {
            if (img.width && img.height) {
                const aspect = img.width / img.height;
                if (aspect > 1) {
                    setCanvasDims({ width: 3000, height: 3000 / aspect });
                } else {
                    setCanvasDims({ width: 3000 * aspect, height: 3000 });
                }
            }
        };
    }, [bgImage]);

    // Initialize/Update bounds when included walls change
    useEffect(() => {
        const newDims = { ...boxDimensions };
        let updatedCorners = { ...wallCorners };
        let changed = false;

        includedWalls.forEach(wallId => {
            const wData = walls.find(w => w.id === wallId);
            if (wData && wData.points.length >= 3 && !newDims[wallId]) {
                const xs = wData.points.map(p => p.x);
                const ys = wData.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);

                const w = Math.max(10, maxX - minX);
                const h = Math.max(10, maxY - minY);

                newDims[wallId] = { width: w, height: h, minX, minY };

                if (!updatedCorners[wallId]) {
                    const scale = Math.min(800 / w, 500 / h, 1);
                    const displayW = w * scale;
                    const displayH = h * scale;

                    // offset slightly based on how many walls are included to avoid full overlap
                    const offset = Object.keys(updatedCorners).length * 40;
                    const startX = Math.max(50, (window.innerWidth - displayW) / 2) + offset;
                    const startY = 100 + offset;

                    updatedCorners[wallId] = [
                        { x: startX, y: startY },
                        { x: startX + displayW, y: startY },
                        { x: startX + displayW, y: startY + displayH },
                        { x: startX, y: startY + displayH }
                    ];
                }
                changed = true;
            }
        });

        if (changed) {
            setBoxDimensions(newDims);
            setWallCorners(updatedCorners);
        }
    }, [includedWalls, walls, boxDimensions, wallCorners]);

    useEffect(() => {
        async function init() {
            await fetchProducts();

            if (id) {
                const { data, error } = await supabase
                    .from("projects")
                    .select("data")
                    .eq("id", id)
                    .single();

                if (data && !error) {
                    loadProject(id, data.data);
                    if (data.data.mockupScenes && data.data.mockupScenes.length > 0) {
                        setMockupsList(data.data.mockupScenes);
                        const first = data.data.mockupScenes[0];
                        setActiveMockupId(first.id);
                        setBgImage(first.bgImage);
                        setIncludedWalls(first.includedWalls);
                        setWallCorners(first.wallCorners);
                    } else if (data.data.mockupScene) {
                        setBgImage(data.data.mockupScene.bgImage || null);
                        setIncludedWalls(data.data.mockupScene.includedWalls || []);
                        setWallCorners(data.data.mockupScene.wallCorners || {});
                        setMockupsList([{ id: '1', name: 'Mockup 1', bgImage: data.data.mockupScene.bgImage || null, includedWalls: data.data.mockupScene.includedWalls || [], wallCorners: data.data.mockupScene.wallCorners || {} }]);
                    } else if (data.data.mockups) {
                        // legacy migration
                        const firstId = Object.keys(data.data.mockups)[0];
                        if (firstId) {
                            setBgImage(data.data.mockups[firstId].bgImage);
                            setIncludedWalls([firstId]);
                            setWallCorners({ [firstId]: data.data.mockups[firstId].corners });
                            setMockupsList([{ id: '1', name: 'Mockup 1', bgImage: data.data.mockups[firstId].bgImage, includedWalls: [firstId], wallCorners: { [firstId]: data.data.mockups[firstId].corners } }]);
                        }
                    }
                }
                setLoadingProject(false);
            }
        }
        init();

        // Enable coloring preview mode for the Mockup to hide labels and sizes
        setIsColoringPreview(true);
        return () => setIsColoringPreview(false);
    }, [id, loadProject, fetchProducts, setIsColoringPreview]);

    // Handle Dragging
    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!draggingHandle || !containerRef.current) return;
            if (e.cancelable && 'touches' in e) {
                e.preventDefault();
            }
            const rect = containerRef.current.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            let x = (clientX - rect.left + containerRef.current.scrollLeft) / zoom;
            let y = (clientY - rect.top + containerRef.current.scrollTop) / zoom;

            // Clamp points within canvas dimensions so they don't get lost
            x = Math.max(0, Math.min(x, canvasDims.width));
            y = Math.max(0, Math.min(y, canvasDims.height));

            setWallCorners(prev => {
                const newCorners = { ...prev };
                if (newCorners[draggingHandle.wallId]) {
                    const arr = [...newCorners[draggingHandle.wallId]];
                    arr[draggingHandle.index] = { x, y };
                    newCorners[draggingHandle.wallId] = arr;
                }
                return newCorners;
            });
        };

        const handleUp = () => {
            setDraggingHandle(null);
        };

        if (draggingHandle) {
            window.addEventListener('mousemove', handleMove, { passive: false });
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [draggingHandle, zoom, canvasDims]);

    // Use a ref for wallCorners so undo/redo closures always have the latest value
    const wallCornersRef = useRef(wallCorners);
    useEffect(() => { wallCornersRef.current = wallCorners; }, [wallCorners]);

    const cornersPastRef = useRef(cornersPast);
    useEffect(() => { cornersPastRef.current = cornersPast; }, [cornersPast]);

    const cornersFutureRef = useRef(cornersFuture);
    useEffect(() => { cornersFutureRef.current = cornersFuture; }, [cornersFuture]);

    // Handle Undo/Redo keydown globally for MockupPage
    useEffect(() => {
        const handleUndoRedo = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' || e.key === 'Z') {
                    if (e.shiftKey) {
                        // Redo
                        if (cornersFutureRef.current.length > 0) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            setCornersFuture(prev => {
                                const next = prev[0];
                                const current = wallCornersRef.current;
                                setCornersPast(past => [...past, current]);
                                setWallCorners(next);
                                return prev.slice(1);
                            });
                        }
                    } else {
                        // Undo
                        if (cornersPastRef.current.length > 0) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            setCornersPast(prev => {
                                const previous = prev[prev.length - 1];
                                const current = wallCornersRef.current;
                                setCornersFuture(future => [current, ...future]);
                                setWallCorners(previous);
                                return prev.slice(0, -1);
                            });
                        }
                    }
                } else if (e.key === 'y' || e.key === 'Y') {
                    if (cornersFutureRef.current.length > 0) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        // Redo
                        setCornersFuture(prev => {
                            const next = prev[0];
                            const current = wallCornersRef.current;
                            setCornersPast(past => [...past, current]);
                            setWallCorners(next);
                            return prev.slice(1);
                        });
                    }
                }
            }

        };

        window.addEventListener('keydown', handleUndoRedo, true); // Use capture phase to intercept before WallEditor
        return () => window.removeEventListener('keydown', handleUndoRedo, true);
    }, []);

    // Zoom Handling
    useEffect(() => {
        let initialDist = 0;
        let initialZoom = 1;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setZoom(z => {
                    const newZoom = e.deltaY < 0 ? z + 0.05 : z - 0.05;
                    return Math.max(0.05, Math.min(5, newZoom));
                });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '+' || e.key === '_')) {
                e.preventDefault();
                setZoom(z => {
                    const newZoom = (e.key === '=' || e.key === '+') ? z + 0.1 : z - 0.1;
                    return Math.max(0.05, Math.min(5, newZoom));
                });
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialDist = dist;
                setZoom(z => {
                    initialZoom = z;
                    return z;
                });
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const newZoom = initialZoom * (dist / initialDist);
                setZoom(Math.max(0.05, Math.min(5, newZoom)));
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                try {
                    const res = await fetch('/api/upload-cloudinary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file: base64 })
                    });

                    const data = await res.json();
                    if (data.url) {
                        setBgImage(data.url);
                    } else {
                        console.error("Cloudinary upload failed:", data.error);
                        alert("Upload failed: " + data.error);
                    }
                } catch (err) {
                    console.error(err);
                    alert("Upload failed due to network error.");
                } finally {
                    setIsUploading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDownload = async () => {
        try {
            // === Canvas-based export to avoid html-to-image 3D transform clipping ===
            const pixelRatio = 2; // High resolution

            // Determine export bounds
            let minX = 0;
            let minY = 0;
            let maxX = canvasDims.width;
            let maxY = canvasDims.height;

            if (!bgImage) {
                minX = 3000;
                minY = 3000;
                maxX = 0;
                maxY = 0;
            }

            includedWalls.forEach(wallId => {
                const corners = wallCorners[wallId];
                if (corners) {
                    corners.forEach(c => {
                        if (c.x < minX) minX = c.x;
                        if (c.y < minY) minY = c.y;
                        if (c.x > maxX) maxX = c.x;
                        if (c.y > maxY) maxY = c.y;
                    });
                }
            });

            if (!bgImage && maxX < minX) {
                minX = 0; minY = 0; maxX = 500; maxY = 500;
            } else {
                minX -= 50;
                minY -= 50;
                maxX += 50;
                maxY += 50;
            }

            // Clamp to valid range
            minX = Math.max(0, minX);
            minY = Math.max(0, minY);

            const exportWidth = maxX - minX;
            const exportHeight = maxY - minY;

            // Create export canvas
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = exportWidth * pixelRatio;
            exportCanvas.height = exportHeight * pixelRatio;
            const ctx = exportCanvas.getContext('2d')!;
            ctx.scale(pixelRatio, pixelRatio);

            // 1. Draw background image
            if (bgImage) {
                const bgImg = new window.Image();
                bgImg.crossOrigin = 'anonymous';
                bgImg.src = bgImage;
                await new Promise<void>((resolve) => {
                    bgImg.onload = () => {
                        ctx.drawImage(bgImg, -minX, -minY, canvasDims.width, canvasDims.height);
                        resolve();
                    };
                    bgImg.onerror = () => resolve();
                });
            } else {
                // Draw dotted pattern background
                ctx.fillStyle = '#e5e5f7';
                ctx.fillRect(0, 0, exportWidth, exportHeight);
                ctx.fillStyle = '#444cf7';
                for (let py = 0; py < canvasDims.height; py += 10) {
                    for (let px = 0; px < canvasDims.width; px += 10) {
                        const drawX = px - minX;
                        const drawY = py - minY;
                        if (drawX >= -1 && drawX <= exportWidth + 1 && drawY >= -1 && drawY <= exportHeight + 1) {
                            ctx.beginPath();
                            ctx.arc(drawX, drawY, 0.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }

            // 2. For each wall, extract the Konva canvas and warp it using perspective triangulation
            for (const wallId of includedWalls) {
                const dims = boxDimensions[wallId];
                const corners = wallCorners[wallId];
                if (!dims || !corners || corners.length !== 4) continue;

                // Find the Konva canvas element for this wall
                // Each WallEditor renders a Konva Stage which creates a canvas
                const wallWrappers = document.querySelectorAll(`[data-wall-id="${wallId}"]`);
                let sourceCanvas: HTMLCanvasElement | null = null;

                if (wallWrappers.length > 0) {
                    sourceCanvas = wallWrappers[0].querySelector('canvas') as HTMLCanvasElement;
                }

                // Fallback: find canvas inside the transformed wall div
                if (!sourceCanvas) {
                    const allTransformedDivs = document.querySelectorAll('#mockup-canvas-inner .origin-top-left');
                    for (const div of Array.from(allTransformedDivs)) {
                        const canvas = div.querySelector('canvas');
                        if (canvas) {
                            // Check if this canvas belongs to the current wall by checking parent's style
                            const parentEl = canvas.closest('.origin-top-left') as HTMLElement;
                            if (parentEl && Math.abs(parentEl.offsetWidth - dims.width) < 5) {
                                sourceCanvas = canvas;
                                break;
                            }
                        }
                    }
                }

                if (!sourceCanvas) continue;

                // Source dimensions: The Konva Stage renders into a canvas with
                // canvas.width = logicalWidth * pixelRatio. To get the correct logical
                // source coordinate space, we need to account for this.
                // The canvas CSS dimensions (set by Konva via style.width/height) 
                // reflect the logical Stage size which may differ from dims.width/height
                // if the WallEditor container size doesn't match exactly.
                // 
                // Use the canvas's CSS dimensions as the definitive source coordinate space,
                // since that's what the Stage actually rendered into.
                const canvasCSSWidth = parseFloat(sourceCanvas.style.width) || sourceCanvas.offsetWidth || dims.width;
                const canvasCSSHeight = parseFloat(sourceCanvas.style.height) || sourceCanvas.offsetHeight || dims.height;
                const srcW = canvasCSSWidth;
                const srcH = canvasCSSHeight;

                // Debug logging to diagnose size discrepancy
                console.log(`[Export Debug] Wall ${wallId}:`, {
                    'dims.width': dims.width,
                    'dims.height': dims.height,
                    'canvas.width (pixels)': sourceCanvas.width,
                    'canvas.height (pixels)': sourceCanvas.height,
                    'canvas.style.width': sourceCanvas.style.width,
                    'canvas.style.height': sourceCanvas.style.height,
                    'canvas.offsetWidth': sourceCanvas.offsetWidth,
                    'canvas.offsetHeight': sourceCanvas.offsetHeight,
                    'srcW used': srcW,
                    'srcH used': srcH,
                });

                // Destination corners (perspective-warped positions), shifted by export offset
                const dst = corners.map(c => ({ x: c.x - minX, y: c.y - minY }));

                // Draw the warped wall using triangle-based affine subdivision
                drawTexturedQuad(ctx, sourceCanvas, srcW, srcH, dst);
            }

            // Convert to PNG and download using Blob to avoid base64 URL length limits
            exportCanvas.toBlob((blob) => {
                if (!blob) {
                    alert("Failed to generate image.");
                    return;
                }
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = 'mockup-scene.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the object URL to free memory
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            }, 'image/png');
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download mockup.");
        }
    };

    // Helper: Draw a textured quad with perspective using triangle subdivision
    function drawTexturedQuad(
        ctx: CanvasRenderingContext2D,
        sourceCanvas: HTMLCanvasElement,
        srcW: number,
        srcH: number,
        dst: { x: number; y: number }[]
    ) {
        // Subdivide the quad into a grid and draw each cell as two triangles
        // More subdivisions = better perspective approximation
        const divisions = 20;

        const src = [
            { x: 0, y: 0 },
            { x: srcW, y: 0 },
            { x: srcW, y: srcH },
            { x: 0, y: srcH }
        ];

        const hParams = getHomographyParams(src, dst);

        for (let row = 0; row < divisions; row++) {
            for (let col = 0; col < divisions; col++) {
                // Source coordinates
                const sx0 = (col / divisions) * srcW;
                const sx1 = ((col + 1) / divisions) * srcW;
                const sy0 = (row / divisions) * srcH;
                const sy1 = ((row + 1) / divisions) * srcH;

                // Project points using true perspective (homography)
                // Fallback to bilinear if homography fails (collinear points etc)
                const p00 = hParams ? applyHomography(sx0, sy0, hParams) : bilinearInterp(dst, col / divisions, row / divisions);
                const p10 = hParams ? applyHomography(sx1, sy0, hParams) : bilinearInterp(dst, (col + 1) / divisions, row / divisions);
                const p01 = hParams ? applyHomography(sx0, sy1, hParams) : bilinearInterp(dst, col / divisions, (row + 1) / divisions);
                const p11 = hParams ? applyHomography(sx1, sy1, hParams) : bilinearInterp(dst, (col + 1) / divisions, (row + 1) / divisions);

                // Triangle 1: top-left
                drawTriangle(ctx, sourceCanvas,
                    sx0, sy0, sx1, sy0, sx0, sy1,
                    p00.x, p00.y, p10.x, p10.y, p01.x, p01.y,
                    srcW, srcH
                );

                // Triangle 2: bottom-right
                drawTriangle(ctx, sourceCanvas,
                    sx1, sy0, sx1, sy1, sx0, sy1,
                    p10.x, p10.y, p11.x, p11.y, p01.x, p01.y,
                    srcW, srcH
                );
            }
        }
    }

    function getHomographyParams(src: { x: number, y: number }[], dst: { x: number, y: number }[]) {
        const A: number[][] = [];
        for (let i = 0; i < 4; i++) {
            const x = src[i].x;
            const y = src[i].y;
            const u = dst[i].x;
            const v = dst[i].y;
            A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
            A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
        }

        for (let i = 0; i < 8; i++) {
            let maxEl = Math.abs(A[i][i]);
            let maxRow = i;
            for (let k = i + 1; k < 8; k++) {
                if (Math.abs(A[k][i]) > maxEl) {
                    maxEl = Math.abs(A[k][i]);
                    maxRow = k;
                }
            }

            const tmp = A[maxRow];
            A[maxRow] = A[i];
            A[i] = tmp;

            const pivot = A[i][i];
            if (pivot === 0) return null;

            for (let k = i; k < 9; k++) {
                A[i][k] /= pivot;
            }

            for (let j = 0; j < 8; j++) {
                if (i !== j) {
                    const factor = A[j][i];
                    for (let k = i; k < 9; k++) {
                        A[j][k] -= factor * A[i][k];
                    }
                }
            }
        }

        return {
            h11: A[0][8], h12: A[1][8], h13: A[2][8],
            h21: A[3][8], h22: A[4][8], h23: A[5][8],
            h31: A[6][8], h32: A[7][8]
        };
    }

    function applyHomography(x: number, y: number, h: any) {
        const w = h.h31 * x + h.h32 * y + 1;
        return {
            x: (h.h11 * x + h.h12 * y + h.h13) / w,
            y: (h.h21 * x + h.h22 * y + h.h23) / w
        };
    }

    function bilinearInterp(corners: { x: number; y: number }[], u: number, v: number) {
        // corners: [topLeft, topRight, bottomRight, bottomLeft]
        const tl = corners[0];
        const tr = corners[1];
        const br = corners[2];
        const bl = corners[3];

        return {
            x: tl.x * (1 - u) * (1 - v) + tr.x * u * (1 - v) + br.x * u * v + bl.x * (1 - u) * v,
            y: tl.y * (1 - u) * (1 - v) + tr.y * u * (1 - v) + br.y * u * v + bl.y * (1 - u) * v,
        };
    }

    function drawTriangle(
        ctx: CanvasRenderingContext2D,
        img: HTMLCanvasElement,
        sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
        dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
        srcW: number, srcH: number
    ) {
        ctx.save();

        // Clip to the destination triangle
        ctx.beginPath();
        ctx.moveTo(dx0, dy0);
        ctx.lineTo(dx1, dy1);
        ctx.lineTo(dx2, dy2);
        ctx.closePath();
        ctx.clip();

        // Calculate affine transform: source triangle -> destination triangle
        // [ a  c  e ] [ sx ]   [ dx ]
        // [ b  d  f ] [ sy ] = [ dy ]
        // [ 0  0  1 ] [ 1  ]   [ 1  ]
        const denom = (sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1));
        if (Math.abs(denom) < 0.001) {
            ctx.restore();
            return;
        }

        const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
        const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
        const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
        const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
        const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;
        const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;

        ctx.transform(a, b, c, d, e, f);
        ctx.drawImage(img, 0, 0, srcW, srcH);
        ctx.restore();
    }

    const handleSaveMockup = async () => {
        if (!id) return;

        try {
            const { data, error } = await supabase.from("projects").select("data").eq("id", id).single();
            if (error || !data) throw new Error("Failed to load project data");

            const currentData = data.data;

            // Also grab the current custom colors to save them with the scene
            const { walls, products } = useCanvasStore.getState();
            const customColors: Record<string, string> = {};
            products.forEach(p => {
                if (p.color && (p.color.startsWith('http') || p.color.startsWith('data:') || p.color.startsWith('#'))) {
                    customColors[p.id] = p.color;
                }
            });

            // Save active mockup state into the list before saving
            const finalMockups = mockupsList.map(m => m.id === activeMockupId ? { ...m, bgImage, includedWalls, wallCorners } : m);
            
            currentData.mockupScenes = finalMockups;
            currentData.materialColors = customColors;

            const { error: saveError } = await supabase.from("projects").update({ data: currentData }).eq("id", id);
            if (saveError) throw saveError;

            alert("Mockup saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to save mockup.");
        }
    };

    const getTransformMatrix = (wallId: string) => {
        const dims = boxDimensions[wallId];
        const corners = wallCorners[wallId];
        if (!dims || !corners || corners.length !== 4) return 'none';
        const src = [
            { x: 0, y: 0 },
            { x: dims.width, y: 0 },
            { x: dims.width, y: dims.height },
            { x: 0, y: dims.height }
        ];
        return solveHomography(src, corners);
    };

    // --- Mockup Manager Actions ---
    const handleAddMockup = () => {
        const newId = Date.now().toString();
        const newMockup = { id: newId, name: `Mockup ${mockupsList.length + 1}`, bgImage: null, includedWalls: [], wallCorners: {} };
        
        // Save current state first
        setMockupsList(prev => [...prev.map(m => m.id === activeMockupId ? { ...m, bgImage, includedWalls, wallCorners } : m), newMockup]);
        
        setActiveMockupId(newId);
        setBgImage(null);
        setIncludedWalls([]);
        setWallCorners({});
        setCornersPast([]);
        setCornersFuture([]);
    };

    const handleDuplicateMockup = (idToDup: string) => {
        const newId = Date.now().toString();
        // ensure current state is synced
        const syncedList = mockupsList.map(m => m.id === activeMockupId ? { ...m, bgImage, includedWalls, wallCorners } : m);
        const source = syncedList.find(m => m.id === idToDup);
        if (!source) return;

        const duplicated = { ...source, id: newId, name: `${source.name} (Copy)` };
        setMockupsList([...syncedList, duplicated]);
        
        setActiveMockupId(newId);
        setBgImage(duplicated.bgImage);
        setIncludedWalls([...duplicated.includedWalls]);
        setWallCorners(JSON.parse(JSON.stringify(duplicated.wallCorners)));
        setCornersPast([]);
        setCornersFuture([]);
    };

    const handleRemoveMockup = (idToRemove: string) => {
        if (mockupsList.length <= 1) return;
        const newList = mockupsList.filter(m => m.id !== idToRemove);
        setMockupsList(newList);
        if (activeMockupId === idToRemove) {
            const next = newList[0];
            setActiveMockupId(next.id);
            setBgImage(next.bgImage);
            setIncludedWalls(next.includedWalls);
            setWallCorners(next.wallCorners);
            setCornersPast([]);
            setCornersFuture([]);
        }
    };

    const handleSetActiveMockup = (newId: string) => {
        if (newId === activeMockupId) return;
        // save current
        const syncedList = mockupsList.map(m => m.id === activeMockupId ? { ...m, bgImage, includedWalls, wallCorners } : m);
        setMockupsList(syncedList);

        // load new
        const target = syncedList.find(m => m.id === newId) || syncedList[0];
        setActiveMockupId(target.id);
        setBgImage(target.bgImage);
        setIncludedWalls(target.includedWalls);
        setWallCorners(target.wallCorners);
        setCornersPast([]);
        setCornersFuture([]);
    };

    const handleUpdateMockupName = (idToUpdate: string, newName: string) => {
        setMockupsList(prev => prev.map(m => m.id === idToUpdate ? { ...m, name: newName } : m));
    };

    if (loadingProject) {
        return (
            <div className="w-full h-[calc(100vh-60px)] md:h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-[#7B6DED] border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-500 font-medium">Loading project mockup...</div>
                </div>
            </div>
        );
    }

    return (
        <main className="flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden bg-slate-50">
            {/* Top Header & Dropdown */}
            <div className="relative h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-[200]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/projects')}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-medium text-gray-800 hidden md:flex">Perspective Mockup</h1>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={handleSaveMockup}
                        title="Save Mockup"
                        className="text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 w-9 h-9 md:w-auto md:px-4 md:py-1.5 rounded-lg flex items-center justify-center hover:bg-gray-50 transition shadow-sm active:scale-95"
                    >
                        <svg className="w-4 h-4 md:mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        <span className="hidden md:inline">Save</span>
                    </button>
                    <button
                        onClick={handleDownload}
                        title="Download Mockup"
                        className="text-sm font-medium text-white cursor-pointer bg-[#7B6DED] w-9 h-9 md:w-auto md:px-4 md:py-1.5 rounded-lg flex items-center justify-center hover:bg-[#6A5ED4] transition shadow-sm active:scale-95"
                    >
                        <svg className="w-4 h-4 md:mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="hidden md:inline">Download PNG</span>
                    </button>
                    <label title="Upload Background" className={`text-sm font-medium text-gray-600 cursor-pointer bg-gray-100 w-9 h-9 md:w-auto md:px-3 md:py-1.5 rounded-lg flex items-center justify-center hover:bg-gray-200 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <svg className={`w-4 h-4 md:mr-2 shrink-0 ${isUploading ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="hidden md:inline">{isUploading ? 'Uploading...' : 'Background'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                    <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
                    <label className="text-sm font-medium text-gray-600 hidden md:block">Walls:</label>
                    <div className="relative" ref={wallDropdownRef}>
                        <button
                            title="Select Walls"
                            onClick={() => setWallDropdownOpen(prev => !prev)}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#7B6DED] focus:border-[#7B6DED] flex items-center justify-center p-2 outline-none min-w-[2.25rem] md:min-w-[120px] md:justify-between"
                        >
                            <span className="flex items-center">
                                <svg className="w-4 h-4 md:mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <span className="hidden md:inline">{includedWalls.length} selected</span>
                                <span className="md:hidden ml-1 font-semibold">{includedWalls.length}</span>
                            </span>
                            <svg className={`w-4 h-4 ml-2 shrink-0 transition-transform ${wallDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        {wallDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[250]">
                                <ul className="py-1">
                                    {walls.map((wall) => (
                                        <li key={wall.id} className="px-4 py-2 hover:bg-gray-100 active:bg-gray-200 flex items-center cursor-pointer" onClick={() => {
                                            setIncludedWalls(prev => prev.includes(wall.id) ? prev.filter(id => id !== wall.id) : [...prev, wall.id]);
                                        }}>
                                            <input type="checkbox" checked={includedWalls.includes(wall.id)} readOnly className="mr-2 rounded text-[#7B6DED] focus:ring-[#7B6DED]" />
                                            <span className="text-sm text-gray-700">{wall.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-100">
                {/* Left Sidebar: Mockup Manager */}
                <MockupManager 
                    mockups={mockupsList}
                    activeMockupId={activeMockupId}
                    addMockup={handleAddMockup}
                    removeMockup={handleRemoveMockup}
                    setActiveMockup={handleSetActiveMockup}
                    updateMockupName={handleUpdateMockupName}
                    duplicateMockup={handleDuplicateMockup}
                />
                
                {/* Main Mockup Area */}
                <div
                    ref={containerRef}
                    className="flex-1 min-h-0 min-w-0 relative overflow-auto bg-[#e5e5f7]"
                >
                    <div style={{ width: canvasDims.width * zoom, height: canvasDims.height * zoom, position: 'relative', margin: '0 auto', minHeight: '100%' }}>
                        <div
                            id="mockup-canvas-inner"
                            className="absolute top-0 left-0"
                            style={{
                                width: `${canvasDims.width}px`,
                                height: `${canvasDims.height}px`,
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                transformStyle: 'preserve-3d'
                            }}
                        >
                            {/* Background Image Layer - Separated to prevent mobile 3D transform clipping bugs */}
                            {bgImage ? (
                                <img 
                                    src={bgImage} 
                                    alt="Background" 
                                    className="absolute top-0 left-0 pointer-events-none"
                                    style={{ width: `${canvasDims.width}px`, height: `${canvasDims.height}px`, objectFit: 'fill', transform: 'translateZ(-1px)' }}
                                    crossOrigin="anonymous"
                                />
                            ) : (
                                <div 
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                        backgroundImage: `radial-gradient(#444cf7 0.5px, #e5e5f7 0.5px)`,
                                        backgroundSize: '10px 10px',
                                        backgroundPosition: 'top left',
                                        backgroundRepeat: 'no-repeat',
                                        transform: 'translateZ(-1px)'
                                    }}
                                />
                            )}
                            {includedWalls.map(wallId => {
                                const dims = boxDimensions[wallId];
                                const corners = wallCorners[wallId];
                                if (!dims || !corners) return null;

                                return (
                                    <div key={wallId} data-wall-id={wallId}>
                                        {/* Transformed Wall Wrapper */}
                                        <div
                                            className="absolute top-0 left-0 origin-top-left pointer-events-auto"
                                            style={{
                                                width: dims.width,
                                                height: dims.height,
                                                transform: getTransformMatrix(wallId) || 'none',
                                                zIndex: 10
                                            }}
                                        >
                                            <div className="w-full h-full shadow-2xl opacity-90 overflow-visible bg-transparent pointer-events-auto">
                                                <WallEditor
                                                    wallId={wallId}
                                                    overrideZoom={1}
                                                    overrideOffset={{ x: -dims.minX, y: -dims.minY }}
                                                    readOnly={true}
                                                />
                                            </div>
                                        </div>

                                        {/* Draggable Corner Handles */}
                                        {corners.map((corner, i) => (
                                            <div
                                                key={`${wallId}-corner-${i}`}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setCornersPast(prev => [...prev, wallCorners]);
                                                    setCornersFuture([]);
                                                    setDraggingHandle({ wallId, index: i });
                                                }}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation();
                                                    setCornersPast(prev => [...prev, wallCorners]);
                                                    setCornersFuture([]);
                                                    setDraggingHandle({ wallId, index: i });
                                                }}
                                                className="absolute w-6 h-6 bg-white border-[3px] border-[#7B6DED] rounded-full shadow-md cursor-move -ml-3 -mt-3 hover:scale-110 active:scale-95 transition-transform touch-none"
                                                style={{ left: corner.x, top: corner.y, zIndex: 50 + (includedWalls.indexOf(wallId) * 10) }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}

                            {!bgImage && includedWalls.length === 0 && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                                    <p className="text-gray-500 font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm">
                                        Drag the corner points to perspective-warp the wall design.<br />
                                        Upload a background photo of a room for a realistic mockup!
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Texture Selector */}
                <div className="w-full md:w-[320px] h-[30vh] md:h-full flex-shrink-0 border-l border-gray-200 shadow-sm z-0">
                    <TextureSelector />
                </div>
            </div>
        </main>
    );
}

export default function MockupPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-slate-50">Loading project...</div>}>
                <MockupPageContent />
            </Suspense>
        </ProtectedRoute>
    );
}
