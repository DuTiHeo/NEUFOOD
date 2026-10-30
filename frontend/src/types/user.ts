export interface User {
  id: number;
  email: string;
  full_name: string;
  phone_number?: string;
  student_id?: string | null;
  role: 'customer' | 'staff' | 'manager' | 'admin' | 'user';
  avatar_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  phone_number?: string;
  student_id?: string | null;
  avatar_url?: string;
}
