import { create } from "zustand";

export type User = {
    id: string;
    company_id: string;
    name: string;
    role: string;
};

export type Company = {
    id: string;
    name: string;
    logo_url: string;
};

type AuthState = {
    user: User | null;
    company: Company | null;
    setSession: (user: User, company: Company) => void;
    clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    company: null,
    setSession: (user, company) => set({ user, company }),
    clearSession: () => set({ user: null, company: null }),
}));
