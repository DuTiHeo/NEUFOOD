export interface User {
  id: number;
  email: string;
  full_name: string;
  phone_number?: string;
  student_id?: string;
  role: 'user' | 'admin';
  avatar_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  phone_number?: string;
  student_id?: string;
  avatar_url?: string;
}
