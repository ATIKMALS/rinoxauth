// ============================================
// AUTH USER
// ============================================
export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role?: "admin" | "super_admin" | "user" | "reseller" | "support";
  permissions?: string[];
  plan?: "free" | "starter" | "professional" | "enterprise" | "trial";
  avatar?: string;
  status?: "active" | "inactive" | "banned" | "suspended";
  created_at?: string;
  last_login?: string;
  expiry?: string;
  phone?: string;
  two_factor_enabled?: boolean;
  email_verified?: boolean;
}

// ============================================
// API RESPONSE
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
  };
  errors?: Record<string, string[]>;
}

// ============================================
// PAGINATION
// ============================================
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ============================================
// DASHBOARD
// ============================================
export interface DashboardStats {
  requests_today: number;
  active_users: number;
  /** Total users in database (when provided by backend). */
  total_users?: number;
  failed_logins: number;
  success_rate: number;
  total_licenses?: number;
  active_licenses?: number;
  revenue_estimate?: number;
  new_users_today?: number;
  system_health?: "healthy" | "degraded" | "down";
  avg_response_time?: number;
}

// ============================================
// APPLICATION
// ============================================
export interface AppRecord {
  id: number;
  name: string;
  owner_id?: string;
  app_key?: string;
  app_secret?: string;
  status: "active" | "inactive" | "suspended";
  users: number;
  version: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  icon?: string;
  tags?: string[];
}

export interface AppCredentials {
  app_id: string;
  app_name: string;
  owner_id: string;
  app_key: string;
  app_secret: string;
  version: string;
  client_portal: string;
  created_at?: string;
  expires_at?: string;
}

export interface CreateAppPayload {
  app_name: string;
  version: string;
  owner_id?: string;
  description?: string;
}

// ============================================
// USER
// ============================================
export interface UserRecord {
  id: number;
  username: string;
  email?: string;
  plan: string;
  status: "active" | "inactive" | "banned" | "expired";
  hwid?: string;
  hwid_lock?: boolean;
  expires_at: string;
  created_at: string;
  last_login?: string;
  devices?: number;
  device_limit?: number;
  license_key?: string;
  notes?: string;
  app_id?: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  email?: string;
  plan?: string;
  expires_in_days?: number;
  expires_in_seconds?: number;
  hwid_lock?: boolean;
  app_id?: number;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  plan?: string;
  status?: string;
  expires_at?: string;
  hwid_lock?: boolean;
  device_limit?: number;
  notes?: string;
}

// ============================================
// LICENSE
// ============================================
export interface LicenseRecord {
  id: number;
  key: string;
  issued_to?: string;
  plan: string;
  device_limit: number;
  issued_date: string;
  type?: string;
  expires_at: string;
  status: "active" | "expired" | "revoked" | "suspended";
  note?: string;
  app_id?: number;
  user_id?: number;
  is_lifetime?: boolean;
  hwid_lock?: boolean;
}

export interface CreateLicensePayload {
  key?: string;
  plan?: string;
  expires_in_days?: number;
  is_lifetime?: boolean;
  device_limit?: number;
  issued_to?: string;
  note?: string;
  app_id?: number;
  user_id?: number;
}

// ============================================
// API KEY
// ============================================
export interface ApiKeyRecord {
  id?: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used: string;
  status: "active" | "revoked" | "expired";
  permissions?: string[];
  expires_at?: string;
}

export interface CreateApiKeyPayload {
  name: string;
  app_id?: number;
  permissions?: string[];
  expires_in_days?: number;
}

// ============================================
// ANALYTICS
// ============================================
export interface AnalyticsRecord {
  total_users: number;
  active_licenses: number;
  expired_licenses: number;
  login_activity_24h: number;
  user_growth: Array<{ label: string; value: number }>;
  license_distribution?: Array<{ plan: string; count: number }>;
  device_breakdown?: Array<{ device: string; count: number }>;
  revenue_overview?: Array<{ month: string; amount: number }>;
  success_rate?: number;
  failed_logins?: number;
}

// ============================================
// RESELLER
// ============================================
export interface ResellerRecord {
  id: number;
  username: string;
  email?: string;
  credits: number;
  users_created: number;
  status: "active" | "inactive" | "suspended";
  commission_rate?: number;
  phone?: string;
  notes?: string;
  created_at?: string;
}

export interface CreateResellerPayload {
  username: string;
  email: string;
  password: string;
  credits?: number;
  commission_rate?: number;
  phone?: string;
  notes?: string;
}

// ============================================
// ACTIVITY LOG
// ============================================
export interface ActivityLogRecord {
  id: number;
  category: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  created_at: string;
  user_id?: number;
  ip_address?: string;
  metadata?: Record<string, any>;
}

// ============================================
// SETTINGS
// ============================================
export interface SettingsRecord {
  app_name: string;
  owner_id: string;
  theme: "dark" | "light" | "system";
  session_cookie_name?: string;
  auth_mode: string;
  language?: string;
  timezone?: string;
  date_format?: string;
  notifications_enabled?: boolean;
  two_factor_required?: boolean;
  session_timeout?: number;
}

export interface UpdateSettingsPayload {
  app_name?: string;
  theme?: string;
  language?: string;
  timezone?: string;
  date_format?: string;
  notifications_enabled?: boolean;
  two_factor_required?: boolean;
  session_timeout?: number;
}

// ============================================
// WEBOOK / EVENT
// ============================================
export interface WebhookRecord {
  id: number;
  url: string;
  events: string[];
  status: "active" | "inactive";
  created_at: string;
  last_triggered?: string;
}

// ============================================
// NOTIFICATION
// ============================================
export interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
}

// ============================================
// FILTER & SEARCH
// ============================================
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface SearchParams {
  query?: string;
  category?: string;
  severity?: string;
  status?: string;
  plan?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}