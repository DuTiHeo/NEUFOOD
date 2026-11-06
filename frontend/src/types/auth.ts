import { User } from './user';

export interface LoginPayload {
  email: string;
  password: string;
  device_token?: string;
  device_name?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone_number: string;
  student_id?: string;
  otp?: string;
}

export interface RegisterOtpPayload {
  email: string;
  phone_number?: string;
  full_name?: string;
  student_id?: string;
}

export interface ForgotPasswordData {
  email: string;
  otp_debug?: string;
  expires_in_seconds?: number;
  daily_count?: number;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  old_password?: string;
  otp?: string;
  new_password: string;
}

export interface ChangePasswordOtpResponse {
  email: string;
  expires_in_seconds?: number;
  daily_count?: number;
  otp_debug?: string;
}

export interface OtpLoginRequestPayload {
  email: string;
}

export interface OtpLoginVerifyPayload {
  email: string;
  otp: string;
  device_name?: string;
}

export interface OtpLoginRequestData {
  email: string;
  expires_in_seconds?: number;
  otp_debug?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  device_token?: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  errors?: any[];
}
