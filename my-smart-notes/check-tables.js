import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are required')
}

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
  console.log(`Found ${data.length} notes`)
}

checkTables()
