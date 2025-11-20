import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ewlwkasjtwsfemqnkrkp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHdrYXNqdHdzZmVtcW5rcmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4ODM3MjQsImV4cCI6MjA3ODQ1OTcyNH0.mG3gJVhSZiGTZx6MFwV0GYq5Xon6dCNsSQLYd230itc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
