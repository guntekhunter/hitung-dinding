import re

file_path = "app/mockup/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add Mockup type and states near the beginning of MockupPageContent
mockup_state = """    // Multiple Mockups State
    const [mockupsList, setMockupsList] = useState<{ id: string, name: string, bgImage: string | null, includedWalls: string[], wallCorners: Record<string, { x: number, y: number }[]> }[]>([
        { id: '1', name: 'Mockup 1', bgImage: null, includedWalls: [], wallCorners: {} }
    ]);
    const [activeMockupId, setActiveMockupId] = useState('1');

    // Background Image State
"""
content = re.sub(r'    // Background Image State\n', mockup_state, content, count=1)

# Add Mockup Manager Sidebar Component near the top (outside MockupPageContent)
manager_comp = """
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
"""
content = re.sub(r'function solveHomography', manager_comp + '\nfunction solveHomography', content, count=1)

# Modify initialization in useEffect
init_block = """                    if (data.data.mockupScenes && data.data.mockupScenes.length > 0) {
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
                    } else if (data.data.mockups) {"""
content = re.sub(r'                    if \(data\.data\.mockupScene\) \{\n                        setBgImage\(data\.data\.mockupScene\.bgImage \|\| null\);\n                        setIncludedWalls\(data\.data\.mockupScene\.includedWalls \|\| \[\]\);\n                        setWallCorners\(data\.data\.mockupScene\.wallCorners \|\| \{\}\);\n                    \} else if \(data\.data\.mockups\) \{', init_block, content, count=1)


# Modify saving block
save_block = """            // Save active mockup state into the list before saving
            const finalMockups = mockupsList.map(m => m.id === activeMockupId ? { ...m, bgImage, includedWalls, wallCorners } : m);
            
            currentData.mockupScenes = finalMockups;
            currentData.materialColors = customColors;"""
content = re.sub(r'            currentData\.mockupScene = \{ bgImage, includedWalls, wallCorners \};\n            currentData\.materialColors = customColors;', save_block, content, count=1)

# Add logic for switching mockups inside MockupPageContent, just before return
switch_logic = """
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
"""
content = re.sub(r'    if \(loadingProject\) \{', switch_logic + '\n    if (loadingProject) {', content, count=1)


# Modify JSX structure to inject Sidebar
sidebar_jsx = """            <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-100">
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
                
                {/* Main Mockup Area */}"""
content = re.sub(r'            <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-100">\n                \{\/\* Main Mockup Area \*\/\}', sidebar_jsx, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
