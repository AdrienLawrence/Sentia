import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aqjowqstohczytiocifl.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxam93cXN0b2hjenl0aW9jaWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3OTE3NTksImV4cCI6MjA3MTM2Nzc1OX0.Us2vfF7oPn64-hn0070sC79V2q2xGG73tnR0e7LEYMI'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  // Let's just select everything from your 'notes' table
  const { data, error } = await supabase
    .from('notes')
    .select('*')

  if (error) {
    console.error('Error fetching notes:', error)
    return
  }
  console.log('Notes in your table:', data)
}

checkTables()