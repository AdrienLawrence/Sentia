'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notebook {
  id: string
  name: string
  style: string
  created_at: string
  user_id: string
  pages: any[]
}

export default function DashboardPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
    fetchNotebooks()
  }

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/notebooks')
      if (!response.ok) {
        throw new Error('Failed to fetch notebooks')
      }
      const notebooks = await response.json()
      setNotebooks(notebooks)
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      setNotebooks([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNotebook = async () => {
    try {
      console.log('Starting notebook creation...')
      
      // Create notebook
      const notebookResponse = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Notebook',
          style: 'standard'
        })
      })
      
      console.log('Notebook response status:', notebookResponse.status)
      console.log('Notebook response ok:', notebookResponse.ok)
      
      if (!notebookResponse.ok) {
        const errorText = await notebookResponse.text()
        console.log('Notebook error response:', errorText)
        throw new Error(`Failed to create notebook: ${notebookResponse.status}`)
      }
      
      const notebook = await notebookResponse.json()
      console.log('Notebook created:', notebook)

      // Create first page
      console.log('Creating first page...')
      const pageResponse = await fetch(`/api/notebooks/${notebook.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Page 1',
          content: { type: 'doc', content: [] },
          page_number: 1
        })
      })
      
      console.log('Page response status:', pageResponse.status)
      console.log('Page response ok:', pageResponse.ok)
      
      if (!pageResponse.ok) {
        const errorText = await pageResponse.text()
        console.log('Page error response:', errorText)
        throw new Error('Failed to create first page')
      }
      
      const page = await pageResponse.json()
      console.log('Page created:', page)

      // Navigate to the new page
      console.log('Navigating to editor...')
      router.push(`/editor/${page.id}`)
    } catch (error) {
      console.error('Error creating notebook:', error)
      alert('Failed to create notebook. Check console for details.')
    }
  }

  const handleNotebookClick = async (notebookId: string) => {
    try {
      // Get the most recently updated page for this notebook
      const response = await fetch(`/api/notebooks/${notebookId}/latest-page`)
      if (!response.ok) throw new Error('Failed to fetch latest page')
      
      const latestPage = await response.json()
      
      if (latestPage) {
        router.push(`/editor/${latestPage.id}`)
      } else {
        // No pages yet, create first page
        const newPageResponse = await fetch(`/api/notebooks/${notebookId}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Page 1',
            content: { type: 'doc', content: [] },
            page_number: 1
          })
        })
        
        if (!newPageResponse.ok) throw new Error('Failed to create page')
        
        const newPage = await newPageResponse.json()
        router.push(`/editor/${newPage.id}`)
      }
    } catch (error) {
      console.error('Error navigating to notebook:', error)
      alert('Failed to open notebook')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-black" 
      onClick={() => showDropdown && setShowDropdown(false)}
    >
      <header className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Your Notebooks</h1>
          
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
              className="flex items-center space-x-2 text-gray-300 cursor-pointer hover:text-white transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-2 border-b border-gray-700">
                  <p className="text-sm text-white font-semibold truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDropdown(false)
                    console.log('Navigate to settings')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Show Create Button at top left ONLY when there are notebooks */}
        {notebooks.length > 0 && (
          <div className="flex gap-4 mb-8">
            <button
              onClick={handleCreateNotebook}
              className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Create New Notebook
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => handleNotebookClick(notebook.id)}
            >
              <h3 className="font-semibold text-white mb-2">{notebook.name}</h3>
              <p className="text-gray-400 text-sm">
                {new Date(notebook.created_at).toLocaleDateString()}
              </p>
              <span className="inline-block mt-2 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                {notebook.pages?.length || 0} pages
              </span>
            </div>
          ))}
          
          {/* Empty state with centered Create button */}
          {notebooks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center min-h-[90vh] -mt-16">
              <p className="text-gray-400 text-lg mb-6">No notebooks yet</p>
              <button
                onClick={handleCreateNotebook}
                className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
              >
                Create Your First Notebook
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}