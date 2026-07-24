'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  const handleLogin = () => {
    // This will navigate to login/signup page
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#080a0e] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0b0e13]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center px-6 py-4">
          <div className="mr-3 h-6 w-1 rounded-full bg-slate-500" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">ScribeAI</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="relative mb-16 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1117] px-6 py-16 text-center shadow-2xl shadow-black/20 sm:px-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-600/10 blur-3xl" />
          <h1 className="relative mb-6 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Finally, a Better Way to Take Notes
          </h1>
          <p className="relative mb-8 mx-auto max-w-2xl text-lg text-slate-400">
            A modern learning experience 
          </p>
          
          <button
            onClick={handleLogin}
            className="relative rounded-lg border border-slate-600 bg-slate-700 px-8 py-3 font-medium text-slate-50 shadow-sm transition-colors cursor-pointer hover:bg-slate-600"
          >
            Sign Up Free
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="rounded-xl border border-slate-800 bg-[#11151c] p-6 shadow-sm shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-slate-600">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-slate-300">
                <path d="M5 4h10a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V4Z" />
                <path d="M8 8h6M8 12h4M17 7l2-2 1 1-2 2" />
              </svg>
            </div>
            <h3 className="mb-2 font-medium text-slate-100">Professional Editor</h3>
            <p className="text-sm leading-6 text-slate-500">Dynamic formatting options. Your notes, your way.</p>
          </div>
          
          <div className="rounded-xl border border-slate-800 bg-[#11151c] p-6 shadow-sm shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-slate-600">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-slate-300">
                <path d="M5 6.5h14M5 12h14M5 17.5h14" />
                <circle cx="7" cy="6.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="7" cy="17.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3 className="mb-2 font-medium text-slate-100">Stay Organized</h3>
            <p className="text-sm leading-6 text-slate-500">No more messy docs, keep your notes in one place.</p>
          </div>
          
          <div className="rounded-xl border border-slate-800 bg-[#11151c] p-6 shadow-sm shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-slate-600">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-slate-300">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10M10 4v6M7 14v6" />
                <circle cx="10" cy="7" r="2" />
                <circle cx="7" cy="17" r="2" />
              </svg>
            </div>
            <h3 className="mb-2 font-medium text-slate-100">Fully Customizable</h3>
            <p className="text-sm leading-6 text-slate-500">Make learning interesting. Choose styles that work for you.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-slate-800 pt-5 text-sm text-slate-600">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Questions, comments, and concerns</p>
          <a
            href="mailto:firestar9jr@gmail.com"
            className="text-slate-500 hover:text-slate-200 hover:underline transition-colors"
          >
            [Email - firestar9jr@gmail.com]
          </a>
          <a
            href="https://github.com/AdrienLawrence"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 text-slate-500 hover:text-slate-200 hover:underline transition-colors"
          >
            [GitHub - AdrienLawrence]
          </a>
          <a
            href="https://www.linkedin.com/in/adrien-lawrence-b1483431b"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 text-slate-500 hover:text-slate-200 hover:underline transition-colors"
          >
            [LinkedIn - Adrien Lawrence]
          </a>
        </div>
      </main>
    </div>
  )
}
