"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ProjectData } from "../utils/saveProject";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";

type ProjectRow = {
    id: string;
    name: string;
    data: ProjectData;
    created_at: string;
};

export default function ProjectsPage() {
    const router = useRouter();
    const loadProject = useCanvasStore(state => state.loadProject);
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProjects() {
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching projects:", error);
            } else {
                setProjects(data || []);
            }
            setLoading(false);
        }

        fetchProjects();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Saved Projects</h1>
                    <Link href="/" className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition active:scale-95 text-sm">
                        + New Project
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center text-slate-500 py-12">Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="text-center text-slate-400 py-12 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
                        <p className="text-lg font-bold text-slate-600">No projects found.</p>
                        <p className="text-sm mt-1">Create your first wall plan and save it to see it here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onClick={() => {
                                    loadProject(project.id, project.data);
                                    router.push("/");
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProjectCard({ project, onClick }: { project: ProjectRow, onClick: () => void }) {
    const info = project.data?.projectInfo;
    const rab = project.data?.rab;
    const image = project.data?.previewImage;

    const formattedDate = new Date(project.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const formattedTotal = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(rab?.grandTotal || 0);

    return (
        <div onClick={onClick} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group cursor-pointer hover:-translate-y-1">
            <div className="aspect-[4/3] bg-slate-100/50 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
                {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={project.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="text-center opacity-50">
                        <div className="text-4xl mb-2">🖼️</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No Preview</div>
                    </div>
                )}
            </div>
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3 gap-2">
                    <h3 className="font-black text-slate-800 line-clamp-2 leading-tight flex-1">{project.name}</h3>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 bg-slate-100 px-2 py-1 rounded-md">{formattedDate}</span>
                </div>

                <div className="space-y-2 mb-6 flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span className="w-4 text-center">👤</span>
                        <span className="font-semibold truncate">{info?.customerName || "Unknown Customer"}</span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span className="w-4 text-center">📐</span>
                        <span className="truncate">{info?.surveyor || "Unknown Surveyor"}</span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span className="w-4 text-center">📍</span>
                        <span className="truncate">{info?.address || "-"}</span>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Total</div>
                    <div className="text-lg font-black text-emerald-600">{formattedTotal}</div>
                </div>
            </div>
        </div>
    );
}
