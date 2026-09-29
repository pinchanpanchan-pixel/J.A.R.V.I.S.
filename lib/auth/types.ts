export interface AuthUser {
  id: string;
  email: string;
  provider: "google" | "apple" | "email" | "mock";
}

export interface EnsureProfileResult {
  is_owner: boolean;
  subscription: string;
  subscription_period: string | null;
}
