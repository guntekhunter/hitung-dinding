"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ProjectData } from "../utils/saveProject";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { useAuthStore } from "../store/useAuthStore";
import ProtectedRoute from "../components/ProtectedRoute";

type ProjectRow = {
    id: string;
    name: string;
    data: ProjectData;
    created_at: string;
};

export default function ProjectsPage() {
    const router = useRouter();
    const loadProject = useCanvasStore(state => state.loadProject);
    const company = useAuthStore(state => state.company);
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        async function fetchProjects() {
            if (!company?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);

            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data, error, count } = await supabase
                .from("projects")
                .select("*", { count: "exact" })
                .eq("company_id", company.id)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) {
                console.error("Error fetching projects:", error);
            } else {
                setProjects(data || []);
                setTotalPages(Math.ceil((count || 0) / itemsPerPage));
            }
            setLoading(false);
        }

        fetchProjects();
    }, [company?.id, page]);

    return (
        <ProtectedRoute>
            <div className="p-6 md:p-10">
                <div className="max-w-6xl space-y-6">
                    <div className="flex items-center justify-between pb-4">
                        <h1 className="text-[20px] font-medium text-gray-900">Drafts</h1>
                        <button
                            onClick={() => {
                                useCanvasStore.getState().reset();
                                router.push("/");
                            }}
                            className="px-4 py-2 bg-[#7B6DED] text-white rounded-md font-medium hover:bg-[#A29AF7] transition active:scale-95 text-[14px]">
                            + New Project
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center text-gray-500 py-12">Loading projects...</div>
                    ) : projects.length === 0 ? (
                        <div className="text-center text-gray-400 py-12 bg-gray-50 rounded-xl border border-gray-200 border-dashed shadow-sm">
                            <p className="text-base font-medium text-gray-600">No projects found.</p>
                            <p className="text-sm mt-1">Create your first wall plan and save it to see it here.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                            
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-4 pt-6 mt-6">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="px-4 py-2 text-[14px] bg-white border border-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-[14px] text-gray-600 font-medium">
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="px-4 py-2 text-[14px] bg-white border border-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}

function getRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Edited just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `Edited ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Edited ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `Edited ${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `Edited ${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    const diffInYears = Math.floor(diffInDays / 365);
    return `Edited ${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

function ProjectCard({ project, onClick }: { project: ProjectRow, onClick: () => void }) {
    const router = useRouter();
    const image = project.data?.previewImage;
    const rab = project.data?.rab;
    const timeAgo = getRelativeTime(project.created_at);

    const formattedTotal = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(rab?.grandTotal || 0);

    return (
        <div onClick={onClick} className="bg-white rounded-[12px] border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer w-full">
            <div className="aspect-[16/10] bg-[#f5f5f5] flex items-center justify-center relative overflow-hidden border-b border-gray-100">
                {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={project.name} className="w-full h-full object-contain p-2" />
                ) : (
                    <div className="text-center opacity-40">
                        <div className="text-4xl mb-2">🖼️</div>
                        <div className="text-[10px] font-medium text-gray-500">No Preview</div>
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col overflow-hidden flex-1">
                        <h3 className="font-medium text-gray-900 text-[14px] truncate leading-tight">
                            {project.name || "Untitled"}
                        </h3>
                        <span className="text-[10px] text-gray-500 truncate mt-0.5">
                            {timeAgo}
                        </span>
                    </div>
                </div>

                {rab?.materials && rab.materials.length > 0 && (
                    <div className="flex flex-col gap-1.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {rab.materials.map((m: any) => (
                            <div key={m.id} className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-600 truncate mr-2 flex-1">{m.name} ({m.quantity})</span>
                                <span className="text-gray-800 font-medium">
                                    {new Intl.NumberFormat("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        minimumFractionDigits: 0,
                                    }).format(m.totalPrice || 0)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-1 border-t border-gray-100 flex justify-between items-center mt-1">
                    <span className="text-[11px] font-medium text-gray-500">Grand Total</span>
                    <span className="text-[13px] font-bold text-[#7B6DED]">
                        {formattedTotal}
                    </span>
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/coloring?id=${project.id}`);
                    }} 
                    className="px-4 py-2 bg-[#7B6DED] text-white rounded-md font-medium hover:bg-[#A29AF7] transition active:scale-95 text-[14px]"
                >
                    Coloring
                </button>
            </div>
        </div>
    );
}
