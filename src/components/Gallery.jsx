import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { collection, query, orderBy, limit, startAfter, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import Masonry from 'react-masonry-css'
import GalleryItem from './GalleryItem'

const PAGE_SIZE = 12

export default function Gallery() {
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const loaderRef = useRef(null)

  const fetchItems = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      let q = query(
        collection(db, 'gallery'), 
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )

      if (lastDoc && !isInitial) {
        q = query(
          collection(db, 'gallery'), 
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        )
      }

      const snapshot = await getDocs(q)
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      if (isInitial) {
        setItems(newItems)
      } else {
        setItems(prev => [...prev, ...newItems])
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1])
      setHasMore(snapshot.docs.length === PAGE_SIZE)
      setLoading(false)
      setLoadingMore(false)
      setInitialLoad(false)
    } catch (error) {
      console.error('Error fetching items:', error)
      setLoading(false)
      setLoadingMore(false)
      setInitialLoad(false)
    }
  }, [lastDoc])

  useEffect(() => {
    fetchItems(true)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const galleryItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      if (initialLoad) {
        setItems(galleryItems)
        setLoading(false)
        setInitialLoad(false)
      }
    })

    return unsubscribe
  }, [initialLoad])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchItems(false)
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, fetchItems])

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items
    const term = searchTerm.toLowerCase()
    return items.filter(item => 
      item.tags?.some(tag => tag.toLowerCase().includes(term)) ||
      item.title?.toLowerCase().includes(term)
    )
  }, [items, searchTerm])

  const breakpointColumns = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  }

  const SkeletonCard = () => (
    <div className="mb-4 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md">
      <div className="animate-pulse bg-gray-300 dark:bg-gray-700" style={{ height: Math.random() * 100 + 150 }}></div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded-full w-16"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded-full w-16"></div>
        </div>
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded-lg w-full"></div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search by tags..."
            disabled
            className="w-full px-6 py-4 rounded-xl bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-400 text-base"
          />
        </div>
        <Masonry
          breakpointCols={breakpointColumns}
          className="masonry-grid"
          columnClassName="masonry-grid_column"
        >
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Masonry>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-6 py-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white text-base outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {searchTerm ? 'No images found matching your search.' : 'No images yet. Be the first to upload!'}
          </p>
        </div>
      ) : (
        <>
          <Masonry
            breakpointCols={breakpointColumns}
            className="masonry-grid"
            columnClassName="masonry-grid_column"
          >
            {filteredItems.map(item => (
              <GalleryItem key={item.id} item={item} />
            ))}
          </Masonry>
          
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-8">
              {loadingMore ? (
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
              ) : (
                <p className="text-gray-500">Scroll for more...</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
