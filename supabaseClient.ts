
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hydyzjdewhxexrzdrigu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZHl6amRld2h4ZXhyemRyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTc0MTYsImV4cCI6MjA4NjM5MzQxNn0.hoht-6naoVf1a-nNgI3D9c5ag8Zmca3G1V8QGmM84RE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
