import { supabase } from "../../lib/supabase";
import { Wall } from "../store/useCanvasStore";

export type ProjectData = {
    projectInfo: {
        surveyor: string;
        customerName: string;
        phone: string;
        address: string;
    };
    canvas: {
        walls: Wall[];
    };
    rab: {
        materials: Array<{
            id: string;
            name: string;
            quantity: number;
            unit: string;
            unitPrice: number;
            totalPrice: number;
        }>;
        grandTotal: number;
    };
    previewImage?: string;
};

export const saveProjectToDatabase = async (
    projectName: string,
    projectData: ProjectData,
    companyId: string,
    projectId?: string | null
) => {
    try {
        let response;

        if (projectId) {
            response = await supabase
                .from("projects")
                .update({
                    name: projectName,
                    data: projectData,
                    company_id: companyId
                })
                .eq("id", projectId)
                .select();
        } else {
            response = await supabase
                .from("projects")
                .insert([
                    {
                        name: projectName,
                        data: projectData,
                        company_id: companyId,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select();
        }

        const { data, error } = response;

        if (error) {
            console.error("Error saving project:", error);
            throw new Error(error.message);
        }

        return data;
    } catch (error) {
        console.error("Failed to save project:", error);
        throw error;
    }
};
