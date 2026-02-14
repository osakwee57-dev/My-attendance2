
export type UserRole = 'HOC' | 'student';

export interface Profile {
  id: string;
  created_at?: string;
  full_name: string;
  matric_no: string;
  level: string;
  department: string;
  role: UserRole;
  signature: string; // base64
  password?: string;
}

export interface Session {
  id: string;
  created_at: string;
  course_code: string;
  unique_code: string; // The 6-digit PIN
  department: string;
  hoc_id: string;
  title?: string;
  is_active?: boolean;
}

export interface Attendance {
  id: string;
  created_at?: string;
  student_id: string; // Changed from profile_id
  session_id: string;
  status: 'present' | 'absent' | 'late';
  signed_at: string;
  department?: string; // Added as per snippet
  profiles?: {
    full_name: string;
    matric_no: string;
    signature: string;
  };
}

export interface TableStatus {
  name: string;
  count: number | null;
  status: 'loading' | 'success' | 'error';
  error?: string;
}
