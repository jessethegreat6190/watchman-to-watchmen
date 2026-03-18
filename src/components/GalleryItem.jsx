import { useState } from 'react'

export default function GalleryItem({ item }) {
  const [loaded, setLoaded] = useState(false)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = item.url
    link.download = item.title || 'watchmen-image'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="mb-4 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-shadow">
      <div className="relative">
        {!loaded && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" style={{ minHeight: '200px' }}></div>
        )}
        <img
          src={item.url}
          alt={item.title || 'Gallery image'}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      
      <div className="p-4">
        {item.title && (
          <h3 className="font-semibold text-gray-800 dark:text-white mb-2">{item.title}</h3>
        )}
        
        {item.dimensions && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {item.dimensions.width} × {item.dimensions.height}
          </p>
        )}
        
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.map((tag, index) => (
              <span 
                key={index} 
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <button
          onClick={handleDownload}
          className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          style={{ minHeight: '44px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>
    </div>
  )
}
