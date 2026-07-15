'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  const handleLogin = () => {
    // This will navigate to login/signup page
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-slate-500 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-white">ScribeAI</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl bg-black mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Finally, a Better Way to Take Notes
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            A modern learning experience 
          </p>
          
          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors cursor-pointer shadow-lg hover:shadow-xl"
          >
            Create a Notebook
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-700">
            <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-blue-400 text-xl">📝</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Professional Editor</h3>
            <p className="text-gray-400">Dynamic formatting options. Your notes, your way.</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-700">
            <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-purple-400 text-xl">📚</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Stay Organized</h3>
            <p className="text-gray-400">No more messy docs, keep your notes in one place.</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-700">
            <div className="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-400 text-xl">🎨</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Fully Customizable</h3>
            <p className="text-gray-400">Make learning interesting. Choose styles that work for you.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-400 mb-4">Ready to step into the future of learning?</p>
          <button
            onClick={handleLogin}
            className="bg-gray-800 hover:bg-gray-700 cursor-pointer text-white font-semibold py-3 px-8 rounded-lg transition-colors border border-gray-700"
          >
            Sign Up Free
          </button>
        </div>

        {/* Footer */}
        <div className="bg-black text-gray-500 h-2px w-100% text-sm mt-16 border-t border-gray-800">
          <p className="text-gray-50 mt-4">For Questions, Comments, and Concerns: </p>
          <a
            href="mailto:firestar9jr@gmail.com"
            className="text-gray-400 hover:text-white hover:underline transition-colors"
          >
            [Email - firestar9jr@gmail.com]
          </a>
          <a
            href="https://github.com/AdrienLawrence"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 text-gray-400 hover:text-white hover:underline transition-colors"
          >
            [GitHub - AdrienLawrence]
          </a>
          <a
            href="https://www.linkedin.com/in/adrien-lawrence-b1483431b"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 text-gray-400 hover:text-white hover:underline transition-colors"
          >
            [LinkedIn - Adrien Lawrence]
          </a>
        </div>
      </main>
    </div>
  )
}