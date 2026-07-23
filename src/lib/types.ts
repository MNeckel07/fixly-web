import type { Role, ProfileStatus } from "./brand";

export type RequestStatus =
  | "buscando"
  | "proposta_enviada"
  | "aceito"
  | "a_caminho"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export type ProposalStatus = "enviada" | "aceita" | "recusada" | "expirada";
export type PaymentStatus = "retido" | "liberado" | "reembolsado";

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  base_price: number;
}

export interface Profile {
  id: string;
  role: Role;
  status: ProfileStatus;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  city: string | null;
  category_id: string | null;
  bio: string | null;
  service_radius_km: number | null;
  base_price: number | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  jobs_done: number | null;
  avatar_url: string | null;
  avatar_path: string | null;
  advance_pct: number | null;
  specialties: string | null;
  headline: string | null;
  handle: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
  // v2
  active: boolean;
  birth_date: string | null;
  rg: string | null;
  gender: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  state: string | null;
  zip_code: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
}

export interface ServiceRequest {
  id: string;
  client_id: string;
  category_id: string | null;
  provider_id: string | null;
  description: string;
  urgent: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_price: number | null;
  final_price: number | null;
  status: RequestStatus;
  rating: number | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  eta_minutes: number | null;
  message: string | null;
  status: ProposalStatus;
  created_at: string;
}
